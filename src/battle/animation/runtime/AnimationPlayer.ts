/**
 * Script/task interpreter from public/pokeemerald/src/battle_anim.c.
 * Frame order: BattleMainCB1 commands, then BattleMainCB2 sprites/OAM, then tasks.
 * See docs/features/battle/animation-implementation-plan.md.
 */
import { GBA_FRAME_MS, MAX_CATCHUP_STEPS_PER_TICK, RESUME_RESET_THRESHOLD_MS } from '../../../config/timing.ts';
import type { AnimationAsset, AnimationBackground, AnimationColorBlend, AnimationHandle, AnimationInstruction, AnimationParticle, AnimationPose, AnimationProgram, AnimationRequest, AnimationStatus, AnimationTemplate, AnimationTrace, BattlerSlot } from '../types.ts';
import { SilentAnimationAudio, type AnimationAudio, type AnimationAudioCue, type AnimationSoundHandle } from '../audio/AnimationAudio.ts';
import type { EffectContext, EffectFactory, EffectInstance } from '../effects/types.ts';
import { FrameAnimation } from './FrameAnimation.ts';

export interface AnimationPlayerOptions {
  program: AnimationProgram;
  templates: Readonly<Record<string, AnimationTemplate>>;
  assets: Readonly<Record<number, AnimationAsset>>;
  effects: Readonly<Record<string, EffectFactory>>;
  backgrounds?: Readonly<Record<number, AnimationBackground>>;
  preload?: (tags: readonly number[], backgrounds: readonly number[]) => Promise<void> | void;
  audio?: AnimationAudio;
  trace?: boolean;
}
const COMMANDS = new Set(['loadspritegfx', 'unloadspritegfx', 'createsprite', 'createvisualtask', 'delay',
  'waitforvisualfinish', 'end', 'call', 'return', 'goto', 'setarg', 'jumpargeq', 'jumpifmoveturn',
  'monbg', 'clearmonbg', 'setalpha', 'blendoff', 'playsewithpan', 'playse', 'waitsound', 'stopsound', 'createsoundtask', 'loopsewithpan', 'waitplaysewithpan',
  'splitbgprio', 'splitbgprio_foes', 'fadetobg', 'restorebg', 'waitbgfadeout', 'waitbgfadein']);
const MAX_EFFECTS = 64;
const MAX_FRAMES = 1800;
class PlaybackHandle implements AnimationHandle {
  status: AnimationStatus = 'loading';
  reason?: string;
  finished: Promise<AnimationStatus>;
  private settle!: (status: AnimationStatus) => void;
  constructor() { this.finished = new Promise((resolve) => { this.settle = resolve; }); }
  finish(status: AnimationStatus, reason?: string): void {
    if (this.status !== 'running' && this.status !== 'loading') return;
    this.status = status; this.reason = reason; this.settle(status);
  }
}
function numberArg(ins: AnimationInstruction, index: number): number {
  const value = ins.args[index];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Expected numeric argument ${index} of ${ins.op}`);
  return value;
}
function symbolArg(ins: AnimationInstruction, index: number): string {
  const value = ins.args[index];
  if (typeof value !== 'string') throw new Error(`Expected symbol argument ${index} of ${ins.op}`);
  return value;
}
const idleStep = () => {};
export class AnimationPlayer implements EffectContext {
  readonly args = new Int16Array(8);
  readonly poses: AnimationPose[] = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
  readonly particles: AnimationParticle[] = [];
  readonly monBackgroundSlots = new Set<BattlerSlot>();
  readonly trace: AnimationTrace[] = [];
  readonly paletteBlends = new Map<number, AnimationColorBlend>();
  readonly hiddenSlots = new Set<BattlerSlot>();
  backgroundId: number | null = null;
  backgroundCycle = 0;
  backgroundDarkness = 0;
  private backgroundFade: { next: number | null; frame: number } | null = null;
  private scheduledSounds: Array<{ frame: number; id: number; pan: number; remaining: number; interval: number }> = [];
  alpha: readonly [number, number] | null = null;
  frame = 0;
  request!: AnimationRequest;
  private options: AnimationPlayerOptions;
  private audio: AnimationAudio;
  private handle: PlaybackHandle | null = null;
  private pc = 0;
  private stack: number[] = [];
  private waitFrames: number | null = null;
  private accumulator = 0;
  private loadingElapsed = 0;
  private nextId = 1;
  private sounds: Array<{ kind: 'effect' | 'cry'; handle: AnimationSoundHandle }> = [];
  private pool: EffectInstance[] = Array.from({ length: MAX_EFFECTS }, () => ({
    id: 0, symbol: '', kind: 'sprite', priority: 0, alive: false, data: new Int16Array(16),
    phase: 0, pose: { x: 0, y: 0 }, step: idleStep,
  }));
  private tasks: EffectInstance[] = [];
  private renderParticlePool: AnimationParticle[] = [];
  constructor(options: AnimationPlayerOptions) { this.options = options; this.audio = options.audio ?? new SilentAnimationAudio(); }
  get status(): AnimationStatus { return this.handle?.status ?? 'completed'; }
  get active(): boolean { return this.status === 'loading' || this.status === 'running'; }
  get activeEffectCount(): number { return this.pool.reduce((count, effect) => count + Number(effect.alive), 0); }

  private get visualEffectCount(): number { return this.pool.reduce((count, effect) => count + Number(effect.alive && effect.waitGroup === 'visual'), 0); }

  /** Checks the reachable program and declared callback children before any visual starts. */
  preflight(moveId: number): { supported: boolean; reason?: string; tags: number[]; backgrounds?: number[] } {
    const program = this.options.program;
    const label = program.moveEntries[moveId];
    if (!label) return { supported: false, reason: `Move ${moveId} is outside the enabled rollout`, tags: [] };
    const pending = [program.labels[label]], seen = new Set<number>(), tags = new Set<number>(), behaviors = new Set<string>(), backgrounds = new Set<number>();
    const checkBehavior = (symbol: string) => {
      if (behaviors.has(symbol)) return;
      behaviors.add(symbol);
      const template = this.options.templates[symbol];
      const factory = this.options.effects[template?.callback ?? symbol];
      if (!factory) throw new Error(`Missing behavior ${template?.callback ?? symbol}`);
      if (template?.tag) tags.add(template.tag);
      if (template) {
        for (const table of [...template.frames, ...template.affineFrames]) {
          if (table.some((command) => !['FRAME', 'JUMP', 'END', 'END_ALT'].includes(command.op))) throw new Error(`Unsupported frame table ${symbol}`);
        }
      }
      for (const child of factory.children) checkBehavior(child);
    };
    try {
      while (pending.length) {
        const pc = pending.pop()!;
        if (seen.has(pc)) continue; seen.add(pc);
        const ins = program.instructions[pc];
        if (!ins) throw new Error(`Invalid instruction address ${pc}`);
        if (!COMMANDS.has(ins.op)) throw new Error(`Unsupported command ${ins.op} at line ${ins.line}`);
        if (ins.op === 'createsprite') {
          const name = symbolArg(ins, 0);
          if (!this.options.templates[name]) throw new Error(`Missing template ${name}`);
          checkBehavior(name);
        }
        if (ins.op === 'createvisualtask' || ins.op === 'createsoundtask') checkBehavior(symbolArg(ins, 0));
        if (ins.op === 'loadspritegfx') tags.add(numberArg(ins, 0));
        if (ins.op === 'monbg' && ![0, 1, 2, 3].includes(numberArg(ins, 0))) throw new Error(`Unsupported monbg group at line ${ins.line}`);
        if (ins.op === 'fadetobg') {
          const id = numberArg(ins, 0);
          if (!this.options.backgrounds?.[id]) throw new Error(`Missing background ${id}`);
          backgrounds.add(id);
        }
        if (['call', 'goto', 'jumpargeq', 'jumpifmoveturn'].includes(ins.op)) {
          const target = symbolArg(ins, ins.op === 'jumpargeq' ? 2 : ins.op === 'jumpifmoveturn' ? 1 : 0);
          if (program.labels[target] === undefined) throw new Error(`Missing helper ${target}`);
          pending.push(program.labels[target]);
        }
        if (!['end', 'return', 'goto'].includes(ins.op)) pending.push(pc + 1);
      }
      for (const tag of tags) if (!this.options.assets[tag]) throw new Error(`Missing visual asset ${tag}`);
      return { supported: true, tags: [...tags], backgrounds: [...backgrounds] };
    } catch (error) { return { supported: false, reason: String(error), tags: [] }; }
  }
  start(request: AnimationRequest, enabled = true): AnimationHandle {
    this.cancel('Replaced by another animation');
    const handle = this.handle = new PlaybackHandle();
    this.frame = 0; this.accumulator = 0; this.loadingElapsed = 0; this.trace.length = 0;
    this.args.fill(0); this.stack.length = 0; this.waitFrames = null; this.nextId = 1;
    this.request = Object.freeze({ ...request, battlers: Object.freeze(request.battlers.map((mon) => Object.freeze({ ...mon }))) });
    if (!enabled) { handle.finish('skipped', 'Battle scene option disabled'); return handle; }
    const check = this.preflight(request.moveId);
    if (!check.supported) { handle.finish('skipped', check.reason); return handle; }
    if (!this.resolve(0) || !this.resolve(1)) { handle.finish('failed', 'Missing attacker or target'); return handle; }
    this.pc = this.options.program.labels[this.options.program.moveEntries[request.moveId]];
    try {
      const pending = this.options.preload?.(check.tags, check.backgrounds ?? []);
      if (pending) {
        void pending.then(() => { if (this.handle === handle && handle.status === 'loading') handle.status = 'running'; },
          (error) => { if (this.handle === handle && handle.status === 'loading') this.finish('failed', String(error)); });
      } else handle.status = 'running';
    } catch (error) { this.finish('failed', String(error)); }
    return handle;
  }
  advance(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    if (deltaMs >= RESUME_RESET_THRESHOLD_MS) { this.accumulator = 0; return; }
    if (this.status === 'loading') {
      this.loadingElapsed += deltaMs;
      if (this.loadingElapsed >= 15000) this.finish('failed', 'Animation asset loading timed out');
      return;
    }
    if (!this.active) return;
    this.accumulator += deltaMs;
    for (let steps = 0; this.accumulator + 1e-8 >= GBA_FRAME_MS && steps < MAX_CATCHUP_STEPS_PER_TICK && this.active; steps++) {
      this.accumulator -= GBA_FRAME_MS; this.stepFrame();
    }
  }
  stepFrame(): void {
    if (this.status !== 'running') return;
    try {
      if (this.frame >= MAX_FRAMES) throw new Error('Animation lifetime limit exceeded');
      this.sounds = this.sounds.filter((sound) => !sound.handle.completed);
      this.advanceSceneTimers();
      if (this.waitFrames !== null) {
        if (this.waitFrames <= 0) this.waitFrames = null;
        else this.waitFrames--;
      } else this.runCommands();
      if (!this.active) return;
      for (const effect of this.pool) {
        if (!effect.alive || effect.kind !== 'sprite') continue;
        effect.step(this, effect);
        if (effect.alive) { effect.frames?.step(); effect.affine?.step(); }
      }
      this.captureScene(); // GBA BuildOamBuffer occurs before RunTasks.
      this.tasks.length = 0;
      for (const effect of this.pool) if (effect.alive && effect.kind === 'task') this.tasks.push(effect);
      this.tasks.sort((a, b) => a.priority - b.priority || a.id - b.id);
      for (const effect of this.tasks) if (effect.alive) effect.step(this, effect);
      this.frame++;
    } catch (error) {
      const line = this.options.program.instructions[this.pc]?.line;
      this.finish('failed', `${String(error)}${line ? ` (source line ${line})` : ''}`);
    }
  }
  cancel(reason = 'Cancelled'): void { if (this.active) this.finish('cancelled', reason); }
  resolve(role: number) {
    const slot = role === 0 ? this.request.attacker : role === 1 ? this.request.target
      : role === 2 ? this.request.attacker ^ 2 : role === 3 ? this.request.target ^ 2 : -1;
    return this.request.battlers.find((mon) => mon.slot === slot);
  }
  sound(cue: Omit<AnimationAudioCue, 'frame'>): AnimationSoundHandle {
    const handle = this.audio.play({ ...cue, frame: this.frame });
    this.sounds.push({ kind: cue.kind, handle }); this.record('sound', `${cue.kind}:${cue.id}:${cue.mode ?? ''}`);
    return handle;
  }
  criesComplete(): boolean { return this.sounds.every((sound) => sound.kind !== 'cry' || sound.handle.completed); }
  setPalette(mask: number, blend: AnimationColorBlend): void {
    // F_PAL_BG/ATTACKER/TARGET/PARTNERS from include/constants/battle_anim.h.
    if (mask & 1) this.paletteBlends.set(-1, { ...blend });
    for (let role = 0; role < 4; role++) if (mask & (2 << role)) {
      const mon = this.resolve(role); if (mon) this.paletteBlends.set(mon.slot, { ...blend });
    }
  }
  setHidden(slot: BattlerSlot, hidden: boolean): void { if (hidden) this.hiddenSlots.add(slot); else this.hiddenSlots.delete(slot); }
  cycleBackground(): void { this.backgroundCycle = (this.backgroundCycle + 1) % 11; }
  spawnSprite(template: string, options: { x: number; y: number; width: number; height: number; tileOffset: number; mode: number }): void {
    this.createEffect({ op: 'createsprite', args: [template, 1, 2], line: 0 }, options);
  }
  destroy(effect: EffectInstance): void {
    if (!effect.alive) return;
    effect.alive = false; effect.pose.x = effect.pose.y = 0;
    this.record('destroy', effect.symbol);
  }
  private finish(status: AnimationStatus, reason?: string): void {
    for (const effect of this.pool) effect.alive = false;
    for (const pose of this.poses) { pose.x = pose.y = 0; delete pose.scaleX; delete pose.scaleY; }
    this.stopSounds();
    this.sounds.length = 0; this.particles.length = 0; this.tasks.length = 0;
    this.monBackgroundSlots.clear(); this.alpha = null; this.stack.length = 0;
    this.paletteBlends.clear(); this.hiddenSlots.clear(); this.backgroundId = null; this.backgroundCycle = 0;
    this.backgroundDarkness = 0; this.backgroundFade = null; this.scheduledSounds.length = 0;
    this.record(status, reason ?? ''); this.handle?.finish(status, reason);
  }
  private stopSounds(): void {
    for (const sound of this.sounds) {
      // A future audio backend must not prevent visual cleanup or leave a battle waiting.
      try { sound.handle.stop(); } catch (error) { this.record('audio-error', String(error)); }
    }
    this.sounds.length = 0;
  }
  private record(kind: string, symbol: string, line?: number): void {
    if (!this.options.trace) return;
    if (this.trace.length >= 256) this.trace.shift();
    this.trace.push({ frame: this.frame, kind, symbol, line });
  }
  private createEffect(ins: AnimationInstruction, child?: { x: number; y: number; width: number; height: number; tileOffset: number; mode: number }): void {
    const effect = this.pool.find((entry) => !entry.alive);
    if (!effect) throw new Error('Animation effect pool exhausted');
    const symbol = symbolArg(ins, 0), sprite = ins.op === 'createsprite';
    const template = sprite ? this.options.templates[symbol] : undefined;
    const factory = this.options.effects[template?.callback ?? symbol];
    if (!factory) throw new Error(`Unregistered effect ${symbol}`);
    const argStart = sprite ? 3 : ins.op === 'createsoundtask' ? 1 : 2;
    if (ins.args.length - argStart > this.args.length) throw new Error('Too many callback arguments');
    for (let i = argStart; i < ins.args.length; i++) this.args[i - argStart] = numberArg(ins, i);
    effect.id = this.nextId++; effect.symbol = symbol; effect.alive = true;
    effect.kind = sprite ? 'sprite' : 'task'; effect.priority = sprite || ins.op === 'createsoundtask' ? 0 : numberArg(ins, 1);
    effect.waitGroup = child ? 'detached' : ins.op === 'createsoundtask' ? 'sound' : 'visual';
    effect.data.fill(0); effect.phase = 0; effect.slot = undefined; effect.pose.x = effect.pose.y = 0;
    delete effect.pose.scaleX; delete effect.pose.scaleY;
    effect.step = idleStep; effect.particle = undefined; effect.frames = undefined; effect.affine = undefined;
    if (template) {
      effect.frames = new FrameAnimation(template.frames[0]);
      if (template.affine) effect.affine = new FrameAnimation(template.affineFrames[0], true);
      const anchor = this.resolve(numberArg(ins, 1)) ?? this.resolve(0)!;
      const offset = numberArg(ins, 2);
      effect.particle = template.tag ? {
        id: effect.id, template: symbol, x: this.resolve(1)!.x, y: this.resolve(1)!.pictureY,
        tileOffset: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, flipY: false,
        subpriority: Math.max(3, (anchor.side === 'player' ? 30 : 40) + (offset >= 64 ? offset - 64 : -offset)),
      } : undefined;
    }
    if (child && effect.particle) { Object.assign(effect.particle, child, { subpriority: 2 }); effect.data[0] = child.mode; }
    this.record('create', symbol, ins.line);
    factory.initialize(this, effect, template);
    if (sprite && effect.alive) { effect.frames?.step(); effect.affine?.step(); }
  }
  private captureScene(): void {
    for (const pose of this.poses) { pose.x = pose.y = 0; delete pose.scaleX; delete pose.scaleY; }
    this.particles.length = 0;
    for (const effect of this.pool) {
      if (!effect.alive) continue;
      if (effect.slot !== undefined) {
        this.poses[effect.slot].x += effect.pose.x; this.poses[effect.slot].y += effect.pose.y;
        if (effect.pose.scaleX !== undefined) this.poses[effect.slot].scaleX = effect.pose.scaleX;
        if (effect.pose.scaleY !== undefined) this.poses[effect.slot].scaleY = effect.pose.scaleY;
      }
      const particle = effect.particle;
      if (!particle || particle.hidden) continue;
      const index = this.particles.length;
      const output = this.renderParticlePool[index] ??= { ...particle };
      Object.assign(output, particle);
      // A reused output may previously have held a dynamically sized bolt segment.
      output.width = particle.width; output.height = particle.height;
      output.x += effect.pose.x; output.y += effect.pose.y;
      output.tileOffset += effect.frames?.tileOffset ?? 0;
      if (effect.frames?.hFlip) output.flipX = !output.flipX;
      if (effect.frames?.vFlip) output.flipY = !output.flipY;
      output.scaleX = (effect.affine?.scaleX ?? 256) / 256;
      output.scaleY = (effect.affine?.scaleY ?? 256) / 256;
      output.rotation = (effect.affine?.rotation ?? 0) * 360 / 256;
      this.particles.push(output);
    }
    this.particles.sort((a, b) => b.subpriority - a.subpriority || b.id - a.id);
  }
  private advanceSceneTimers(): void {
    for (const sound of this.scheduledSounds) if (this.frame >= sound.frame && sound.remaining > 0) {
      this.sound({ kind: 'effect', id: sound.id, pan: sound.pan }); sound.remaining--; sound.frame += sound.interval;
    }
    this.scheduledSounds = this.scheduledSounds.filter((sound) => sound.remaining > 0);
    const fade = this.backgroundFade;
    if (fade) {
      fade.frame++;
      if (fade.frame <= 16) this.backgroundDarkness = fade.frame / 16;
      else if (fade.frame === 17) { this.backgroundId = fade.next; this.backgroundCycle = 0; }
      else this.backgroundDarkness = Math.max(0, (34 - fade.frame) / 16);
      if (fade.frame >= 34) this.backgroundFade = null;
    }
  }
  private runCommands(): void {
    const program = this.options.program;
    for (let budget = 0; budget < 256; budget++) {
      const ins = program.instructions[this.pc];
      if (!ins) throw new Error(`Invalid program counter ${this.pc}`);
      this.record('command', ins.op, ins.line);
      switch (ins.op) {
        case 'loadspritegfx': this.pc++; this.waitFrames = 1; return;
        case 'unloadspritegfx': break; // Battle-scoped cache; animation never owns the shared GPU texture.
        case 'createsprite': case 'createvisualtask': case 'createsoundtask': this.createEffect(ins); break;
        case 'delay': this.pc++; this.waitFrames = numberArg(ins, 0); return;
        case 'waitforvisualfinish': if (this.visualEffectCount) return; break;
        case 'waitsound': if (this.sounds.some((sound) => !sound.handle.completed)) return; break;
        case 'end':
          if (this.visualEffectCount || this.pool.some((effect) => effect.alive && effect.waitGroup === 'sound')
            || this.scheduledSounds.length || this.backgroundFade || this.sounds.some((sound) => !sound.handle.completed)) return;
          this.finish('completed'); return;
        case 'call':
          if (this.stack.length >= 16) throw new Error('Animation call stack exceeded');
          this.stack.push(this.pc + 1); this.pc = program.labels[symbolArg(ins, 0)]; continue;
        case 'return': {
          const next = this.stack.pop(); if (next === undefined) throw new Error('Animation return without call');
          this.pc = next; continue;
        }
        case 'goto': this.pc = program.labels[symbolArg(ins, 0)]; continue;
        case 'setarg': {
          const index = numberArg(ins, 0); if (index < 0 || index >= this.args.length) throw new Error('Invalid argument register');
          this.args[index] = numberArg(ins, 1); break;
        }
        case 'jumpargeq':
          if (this.args[numberArg(ins, 0)] === (numberArg(ins, 1) << 16 >> 16)) { this.pc = program.labels[symbolArg(ins, 2)]; continue; }
          break;
        case 'jumpifmoveturn':
          if ((this.request.turn ?? 0) === numberArg(ins, 0)) { this.pc = program.labels[symbolArg(ins, 1)]; continue; }
          break;
        case 'monbg': { const mon = this.resolve(numberArg(ins, 0) % 2); if (mon) this.monBackgroundSlots.add(mon.slot); break; }
        case 'clearmonbg': { const mon = this.resolve(numberArg(ins, 0) % 2); if (mon) this.monBackgroundSlots.delete(mon.slot); break; }
        case 'setalpha': this.alpha = [Math.min(16, Math.max(0, numberArg(ins, 0))), Math.min(16, Math.max(0, numberArg(ins, 1)))]; break;
        case 'blendoff': this.alpha = null; break;
        case 'playse': case 'playsewithpan': {
          const pan = ins.op === 'playse' ? 0 : numberArg(ins, 1);
          this.sound({ kind: 'effect', id: numberArg(ins, 0), pan: this.resolve(0)!.side === 'player' ? pan : Math.max(-64, Math.min(63, -pan)) }); break;
        }
        case 'splitbgprio': case 'splitbgprio_foes':
          // Singles place the complete target in the background group; no partner priority split is needed.
          break;
        case 'fadetobg': case 'restorebg':
          this.backgroundFade = { next: ins.op === 'restorebg' ? null : numberArg(ins, 0), frame: 0 }; break;
        case 'waitbgfadeout': if (this.backgroundFade && this.backgroundFade.frame < 17) return; break;
        case 'waitbgfadein': if (this.backgroundFade) return; break;
        case 'loopsewithpan': case 'waitplaysewithpan': {
          const pan = numberArg(ins, 1) * (this.resolve(0)!.side === 'player' ? 1 : -1);
          const interval = Math.max(1, numberArg(ins, 2));
          this.scheduledSounds.push({ frame: this.frame + (ins.op === 'loopsewithpan' ? 1 : interval),
            id: numberArg(ins, 0), pan: Math.max(-64, Math.min(63, pan)),
            remaining: ins.op === 'loopsewithpan' ? numberArg(ins, 3) : 1, interval });
          break;
        }
        case 'stopsound': this.stopSounds(); this.scheduledSounds.length = 0; break;
        default: throw new Error(`Unsupported animation command ${ins.op}`);
      }
      this.pc++;
    }
    throw new Error('Animation instruction budget exceeded');
  }
}

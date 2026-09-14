import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnimationPlayer } from '../createAnimationPlayer.ts';
import { AnimationPlayer } from '../runtime/AnimationPlayer.ts';
import { FrameAnimation } from '../runtime/FrameAnimation.ts';
import { BattleAnimationScene, createAnimationBattler } from '../scene/BattleAnimationScene.ts';
import type { SpriteInstance } from '../../../rendering/types.ts';
import { BATTLE_ANIMATION_PROGRAM, BATTLE_ANIMATION_TEMPLATES } from '../../../data/battleAnimationPrograms.gen.ts';
import { MOVES } from '../../../data/moves.ts';
import { SPECIES } from '../../../data/species.ts';
import { GBA_FRAME_MS } from '../../../config/timing.ts';
import type { AnimationProgram, AnimationRequest } from '../types.ts';
import type { AnimationAudioCue } from '../audio/AnimationAudio.ts';
function request(moveId = MOVES.TACKLE, attacker: 0 | 1 = 0): AnimationRequest {
  return { moveId, attacker, target: attacker === 0 ? 1 : 0, seed: 7, battlers: [
    { slot: 0, side: 'player', identity: 'p', species: SPECIES.MUDKIP, x: 72, y: 80, pictureY: 88 },
    { slot: 1, side: 'opponent', identity: 'e', species: SPECIES.POOCHYENA, x: 176, y: 40, pictureY: 48 },
  ] };
}
function until(player: AnimationPlayer, frame: number) { while (player.active && player.frame < frame) player.stepFrame(); }
function finish(player: AnimationPlayer) { for (let i = 0; player.active && i < 2000; i++) player.stepFrame(); assert(!player.active); }
function tiny(instructions: AnimationProgram['instructions'], labels = { test: 0 }) {
  return new AnimationPlayer({ program: { instructions, labels, moveEntries: { 33: 'test' }, sourceHash: 'fixture' }, templates: {}, assets: {}, effects: {}, trace: true });
}
test('Tackle follows C load/delay timing, mirrored lunge, impact affine and cleanup', async () => {
  for (const side of [0, 1] as const) {
    const player = createAnimationPlayer({ trace: true }), handle = player.start(request(MOVES.TACKLE, side));
    until(player, 4); assert.equal(player.poses[side].x, side === 0 ? 4 : -4);
    until(player, 7); assert.equal(player.poses[side].x, side === 0 ? 16 : -16);
    until(player, 12);
    assert.equal(player.particles.length, 1);
    assert.equal(player.particles[0].scaleX, 176 / 256);
    assert.equal(player.particles[0].x, side === 0 ? 176 : 72);
    assert.equal(player.particles[0].y, side === 0 ? 48 : 88);
    assert.deepEqual(player.alpha, [12, 8]);
    assert(player.monBackgroundSlots.has(side === 0 ? 1 : 0));
    finish(player);
    assert.equal(await handle.finished, 'completed');
    assert.equal(player.frame, 22);
    assert.deepEqual(player.trace.filter((trace) => trace.kind === 'create').map((trace) => trace.frame), [3, 11, 11]);
    assert.equal(player.activeEffectCount, 0); assert.equal(player.particles.length, 0);
    assert(player.poses.every((pose) => pose.x === 0 && pose.y === 0)); assert.equal(player.alpha, null);
  }
});
test('Growl calls RoarEffect twice, mirrors fixed-point waves, and silent cry tasks finish', () => {
  for (const side of [0, 1] as const) {
    const cues: AnimationAudioCue[] = [];
    const player = createAnimationPlayer({ trace: true, audio: { play(cue) { cues.push(cue); return { completed: true, stop() {} }; } } });
    player.start(request(MOVES.GROWL, side)); until(player, 8);
    const upper = player.particles.find((node) => !node.flipY && node.y < (side === 0 ? 80 : 40))!;
    assert.equal(upper.x, side === 0 ? 108 : 139); // Signed right shift floors the negative fixed-point offset.
    assert.equal(upper.flipX, side === 1);
    assert.deepEqual(cues.map(({ mode }) => mode), [9, 10]);
    finish(player); assert.equal(player.frame, 51);
    const waves = player.trace.filter((trace) => trace.kind === 'create' && trace.symbol === 'gRoarNoiseLineSpriteTemplate');
    assert.deepEqual(waves.map((trace) => trace.frame), [3, 3, 3, 20, 20, 20]);
    assert.equal(player.activeEffectCount, 0);
  }
});
test('frame tables loop at the original three-frame cadence', () => {
  const frames = new FrameAnimation(BATTLE_ANIMATION_TEMPLATES.gRoarNoiseLineSpriteTemplate.frames[0]);
  const output = [];
  for (let i = 0; i < 10; i++) { frames.step(); output.push(frames.tileOffset); }
  assert.deepEqual(output, [0, 0, 0, 16, 16, 16, 0, 0, 0, 16]);
});
test('opponent impacts remain above the player backsprite and retain GBA blend coefficients', () => {
  const player = createAnimationPlayer(); player.start(request(MOVES.TACKLE, 1)); until(player, 12);
  const scene = new BattleAnimationScene({ getFrame: () => ({ atlas: 'impact', y: 0, width: 32, height: 32 }), getBackground: () => { throw new Error('No background expected'); } });
  const back: SpriteInstance = { worldX: 40, worldY: 48, width: 64, height: 64, atlasName: 'pokemon',
    atlasX: 0, atlasY: 0, atlasWidth: 64, atlasHeight: 64, flipX: false, flipY: false,
    alpha: 1, tintR: 1, tintG: 1, tintB: 1, sortKey: 30, isReflection: false };
  scene.applyPose(back, 0, player);
  const sprites = [back]; scene.appendSprites(sprites, player);
  assert.equal(sprites[0], back); assert.equal(sprites[1].atlasName, 'impact');
  assert.deepEqual(sprites[1].gbaBlend, [12, 8]);
});
test('audio adapter errors cannot prevent cancellation and visual cleanup', async () => {
  const player = createAnimationPlayer({ audio: { play: () => ({ completed: false, stop() { throw new Error('backend unavailable'); } }) } });
  const handle = player.start(request()); until(player, 12); player.cancel();
  assert.equal(await handle.finished, 'cancelled'); assert.equal(player.activeEffectCount, 0);
  assert.equal(player.particles.length, 0); assert.equal(player.alpha, null);
});
test('delay zero/one retain interpreter callback handoff frames', () => {
  for (const delay of [0, 1]) {
    const player = tiny([{ op: 'delay', args: [delay], line: 1 }, { op: 'end', args: [], line: 2 }]);
    player.start(request()); finish(player); assert.equal(player.frame, delay + 2);
  }
});
test('cancel, disabled option, unsupported entries and callback failures always settle and clear effects', async () => {
  const player = createAnimationPlayer();
  const cancelled = player.start(request()); until(player, 12); player.cancel(); player.cancel();
  assert.equal(await cancelled.finished, 'cancelled'); assert.equal(player.activeEffectCount, 0); assert.equal(player.alpha, null);
  assert.equal(await player.start(request(), false).finished, 'skipped');
  assert.equal(await player.start(request(MOVES.SURF)).finished, 'skipped');
  const invalid = tiny([{ op: 'return', args: [], line: 12 }]);
  const handle = invalid.start(request()); invalid.stepFrame();
  assert.equal(await handle.finished, 'failed'); assert.match(handle.reason!, /without call/);
});
test('loading can fail or be cancelled without reviving a replaced animation', async () => {
  let resolve!: () => void;
  const player = createAnimationPlayer({ preload: () => new Promise<void>((done) => { resolve = done; }) });
  const handle = player.start(request()); assert.equal(handle.status, 'loading');
  player.cancel(); resolve(); await Promise.resolve(); assert.equal(await handle.finished, 'cancelled'); assert.equal(player.activeEffectCount, 0);
  const failing = createAnimationPlayer({ preload: () => Promise.reject(new Error('missing texture')) });
  const failed = failing.start(request()); assert.equal(await failed.finished, 'failed'); assert.match(failed.reason!, /missing texture/);
});
test('unknown capabilities fail preflight before particles or asset loading', () => {
  const instructions = [{ op: 'mystery', args: [], line: 91 }];
  const player = tiny(instructions); const handle = player.start(request());
  assert.equal(handle.status, 'skipped'); assert.match(handle.reason!, /mystery.*91/); assert.equal(player.activeEffectCount, 0);
});
test('runaway control flow is bounded and cannot deadlock the battle', () => {
  const player = tiny([{ op: 'goto', args: ['test'], line: 1 }]);
  const handle = player.start(request()); player.stepFrame();
  assert.equal(handle.status, 'failed'); assert.match(handle.reason!, /instruction budget/);
});
test('render rates and bounded catch-up produce identical traces; tab resume preserves the logical frame', () => {
  const traces = [30, 60, 144].map((fps) => {
    const player = createAnimationPlayer({ trace: true }); player.start(request(MOVES.GROWL));
    for (let i = 0; player.active && i < 2000; i++) player.advance(1000 / fps);
    return player.trace;
  });
  assert.deepEqual(traces[0], traces[1]); assert.deepEqual(traces[1], traces[2]);
  const player = createAnimationPlayer(); player.start(request());
  player.advance(500); assert.equal(player.frame, 8);
  player.advance(GBA_FRAME_MS); assert.equal(player.frame, 16);
  const frame = player.frame; player.advance(10000); assert.equal(player.frame, frame);
  player.advance(GBA_FRAME_MS); assert.equal(player.frame, frame + 1);
});
test('100 repeated mixed replays release all active effects and overrides', () => {
  const player = createAnimationPlayer();
  for (let i = 0; i < 100; i++) {
    player.start(request(i % 2 ? MOVES.GROWL : MOVES.TACKLE, i % 2 ? 1 : 0)); finish(player);
    assert.equal(player.activeEffectCount, 0); assert.equal(player.monBackgroundSlots.size, 0);
    assert.equal(player.particles.length, 0); assert.equal(player.alpha, null);
  }
});
test('shipped roots retain separate helper addresses and compact program metadata', () => {
  assert.notEqual(BATTLE_ANIMATION_PROGRAM.labels.Move_GROWL, BATTLE_ANIMATION_PROGRAM.labels.RoarEffect);
  assert(BATTLE_ANIMATION_PROGRAM.instructions.length < 400);
  assert.equal(Object.keys(BATTLE_ANIMATION_PROGRAM.moveEntries).length, 12);
});

test('Pound has its own immediate impact on either target, with no Tackle lunge', () => {
  for (const side of [0, 1] as const) {
    const player = createAnimationPlayer({ trace: true }); player.start(request(MOVES.POUND, side));
    until(player, 5);
    const impact = player.particles.find((node) => node.template === 'gBasicHitSplatSpriteTemplate')!;
    assert(impact); assert.equal(impact.x, side ? 72 : 176); assert.equal(impact.y, side ? 88 : 48);
    assert.equal(player.poses[side].x, 0);
    finish(player); assert.equal(player.status, 'completed');
    assert(!player.trace.some((entry) => entry.symbol === 'DoHorizontalLunge'));
  }
});

test('all twelve moves prepare every rendered frame and release state over 100 mixed replays', () => {
  const player = createAnimationPlayer();
  // Dynamic bolt dimensions must not carry over into the next animation's reused outputs.
  const moves = [MOVES.THUNDERBOLT, MOVES.SHADOW_BALL, ...Object.keys(BATTLE_ANIMATION_PROGRAM.moveEntries).map(Number)];
  let peak = 0;
  for (let run = 0; run < 100; run++) {
    const move = moves[run % moves.length];
    assert(player.preflight(move).supported);
    player.start(request(move, run % 2 ? 1 : 0));
    for (let i = 0; player.active && i < 600; i++) {
      player.stepFrame(); peak = Math.max(peak, player.activeEffectCount);
      for (const node of player.particles) {
        for (const value of [node.x, node.y, node.scaleX, node.scaleY, node.rotation]) assert(Number.isFinite(value));
        const template = BATTLE_ANIMATION_TEMPLATES[node.template];
        const defaultOffsets = new Set([0, ...template.frames.flatMap((table) => table.filter((cmd) => cmd.op === 'FRAME').map((cmd) => cmd.args[0]))]);
        const width = node.width ?? template.width, height = node.height ?? template.height;
        const prepared = (width === template.width && height === template.height && defaultOffsets.has(node.tileOffset))
          || template.extraFrames?.some((frame) => frame.tileOffset === node.tileOffset && frame.width === width && frame.height === height);
        assert(prepared, `${node.template} unprepared ${node.tileOffset}:${width}x${height} after move ${move}`);
      }
    }
    assert.equal(player.status, 'completed', `Move ${move}`);
    assertBaseline(player);
  }
  assert(peak >= 10 && peak < 64, `Bounded active peak: ${peak}`);
});

function assertBaseline(player: AnimationPlayer) {
  assert.equal(player.activeEffectCount, 0); assert.equal(player.particles.length, 0);
  assert.equal(player.paletteBlends.size, 0); assert.equal(player.hiddenSlots.size, 0);
  assert.equal(player.monBackgroundSlots.size, 0); assert.equal(player.backgroundId, null);
  assert.equal(player.backgroundDarkness, 0); assert.equal(player.backgroundCycle, 0); assert.equal(player.alpha, null);
  assert(player.poses.every((pose) => pose.x === 0 && pose.y === 0 && pose.scaleX === undefined && pose.scaleY === undefined));
}

test('background, visibility and scale effects restore baseline after cancellation at every phase', async () => {
  const player = createAnimationPlayer();
  for (const move of [MOVES.CALM_MIND, MOVES.PSYCHIC, MOVES.SHADOW_BALL, MOVES.THUNDERBOLT, MOVES.ABSORB]) {
    for (const frame of [1, 12, 25, 45, 65, 90, 110]) {
      const handle = player.start(request(move)); until(player, frame); player.cancel();
      assert(['completed', 'cancelled'].includes(await handle.finished)); assertBaseline(player);
    }
  }
  player.start(request(MOVES.CALM_MIND)); until(player, 45);
  assert(player.hiddenSlots.has(1)); assert(!player.hiddenSlots.has(0));
  assert.equal(player.paletteBlends.get(-1)?.amount, 1);
  assert(player.particles.some((node) => node.template === 'gThinRingShrinkingSpriteTemplate'));
  const skip = player.start(request(MOVES.CALM_MIND), false);
  assert.equal(await skip.finished, 'skipped'); assertBaseline(player);
});

test('Psychic background task cycles without blocking visual waits and restores the original scene', () => {
  const player = createAnimationPlayer(); player.start(request(MOVES.PSYCHIC)); until(player, 44);
  assert.notEqual(player.backgroundId, null); const cycle = player.backgroundCycle;
  until(player, 48); assert.notEqual(player.backgroundCycle, cycle);
  until(player, 64); assert((player.poses[1].scaleX ?? 1) > 1);
  finish(player); assert.equal(player.status, 'completed'); assertBaseline(player);
});

test('Thunderbolt declares its dynamically spawned segments and makes both segment shapes available', () => {
  const player = createAnimationPlayer({ trace: true }); player.start(request(MOVES.THUNDERBOLT));
  const shapes = new Set<string>();
  while (player.active) {
    player.stepFrame();
    for (const node of player.particles) if (node.template === 'gElectricBoltSegmentSpriteTemplate') shapes.add(`${node.width}x${node.height}`);
  }
  assert.deepEqual([...shapes].sort(), ['16x16', '8x16']);
  assert.equal(player.trace.filter((entry) => entry.kind === 'create' && entry.symbol === 'gElectricBoltSegmentSpriteTemplate').length, 15);
  assert.equal(player.status, 'completed'); assertBaseline(player);
});

test('Shadow Ball pauses halfway before reaching the exact target, mirrored for either attacker', () => {
  for (const side of [0, 1] as const) {
    const player = createAnimationPlayer(); player.start(request(MOVES.SHADOW_BALL, side));
    const points: Array<readonly [number, number]> = [];
    while (player.active) {
      player.stepFrame();
      const node = player.particles.find((node) => node.template === 'gShadowBallSpriteTemplate');
      if (node) points.push([node.x, node.y]);
    }
    assert.equal(points.length, 40);
    assert.deepEqual(points[15], points[30]);
    assert.deepEqual(points.at(-1), side ? [72, 88] : [176, 48]);
  }
});

test('background dependencies preload before playback and cannot revive a cancelled replacement', async () => {
  const loaded: number[][] = []; let resolve!: () => void;
  const player = createAnimationPlayer({ preload: (_tags, backgrounds) => {
    loaded.push([...backgrounds]); return new Promise<void>((done) => { resolve = done; });
  } });
  const handle = player.start(request(MOVES.PSYCHIC));
  assert.equal(handle.status, 'loading'); assert.equal(loaded[0].length, 1);
  player.stepFrame(); assert.equal(player.frame, 0); assertBaseline(player);
  player.start(request(MOVES.POUND), false); resolve(); await Promise.resolve();
  assert.equal(await handle.finished, 'cancelled'); assert.equal(player.status, 'skipped'); assertBaseline(player);
});

test('dummy frame tables remain idle while real affine endings and frame flips are preserved', () => {
  const dummy = new FrameAnimation([{ op: 'END', args: [] }]);
  for (let i = 0; i < 60; i++) dummy.step();
  assert(!dummy.ended);
  const flip = new FrameAnimation([{ op: 'FRAME', args: [4, 2], hFlip: true }, { op: 'END', args: [] }]);
  flip.step(); assert(flip.hFlip); assert.equal(flip.tileOffset, 4); flip.step(); assert(!flip.ended); flip.step(); assert(flip.ended);
  const affine = new FrameAnimation([{ op: 'FRAME', args: [512, 512, 0, 0] }, { op: 'FRAME', args: [-16, -16, 0, 30] }, { op: 'END_ALT', args: [1] }], true);
  for (let i = 0; i < 32; i++) affine.step();
  assert(affine.ended); assert.equal(affine.scaleX, 32);
});

test('species anchors work for small, tall and elevated battlers on either side', () => {
  for (const species of [SPECIES.MUDKIP, SPECIES.GARDEVOIR, SPECIES.RAYQUAZA]) for (const side of [0, 1] as const) {
    for (const move of [MOVES.POUND, MOVES.WATER_GUN, MOVES.SHADOW_BALL]) {
      const player = createAnimationPlayer(), input = request(move, side);
      const battlers = [createAnimationBattler(0, species, 'p'), createAnimationBattler(1, species, 'e')];
      player.start({ ...input, battlers });
      let reachedTarget = false;
      while (player.active) {
        player.stepFrame();
        for (const node of player.particles) {
          const target = battlers[input.target];
          if (Math.abs(node.x - target.x) <= 1 && Math.abs(node.y - target.pictureY) <= 1) reachedTarget = true;
        }
      }
      assert.equal(player.status, 'completed'); assert(reachedTarget, `${species} / ${move} / ${side}`); assertBaseline(player);
    }
  }
});

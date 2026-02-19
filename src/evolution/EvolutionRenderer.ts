/**
 * Evolution scene renderer with Emerald-inspired timings and sparkle motion.
 *
 * C refs:
 * - public/pokeemerald/src/evolution_scene.c
 * - public/pokeemerald/src/evolution_graphics.c
 */

import { getSpeciesName } from '../data/species';
import { loadImageCanvasAsset, makeCanvasTransparent } from '../utils/assetLoader';
import type { EvolutionAnimationPhase, EvolutionAnimationStatus } from './types';

const SCENE_WIDTH = 240;
const SCENE_HEIGHT = 160;
const MON_CENTER_X = 120;
const MON_CENTER_Y = 64;
const MON_BASE_SIZE = 64;
const FRAME_MS = 1000 / 60;

const MON_MAX_SCALE = 256;
const MON_MIN_SCALE = 16;

type SparkleKind = 'spiral' | 'arc' | 'circle' | 'spray';

interface SparkleParticle {
  kind: SparkleKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  trig: number;
  amplitude: number;
  timer: number;
  speed: number;
  subpriority: number;
  visible: boolean;
}

interface CycleState {
  preScale: number;
  postScale: number;
  showingPost: boolean;
  scaleSpeed: number;
  mode: 'tryEnd' | 'update' | 'done';
}

function normalizeAngle(value: number): number {
  return value & 0xff;
}

function sin256(angle: number, amplitude: number): number {
  return Math.sin((normalizeAngle(angle) * Math.PI) / 128) * amplitude;
}

function cos256(angle: number, amplitude: number): number {
  return Math.cos((normalizeAngle(angle) * Math.PI) / 128) * amplitude;
}

function speciesIdToDirectoryName(speciesId: number): string {
  return getSpeciesName(speciesId).toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function hasTransparentPixels(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return false;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}

async function loadPokemonFrontSpriteCanvas(speciesId: number): Promise<HTMLCanvasElement> {
  const dirName = speciesIdToDirectoryName(speciesId);
  const basePath = `/pokeemerald/graphics/pokemon/${dirName}`;

  let canvas: HTMLCanvasElement;
  try {
    canvas = await loadImageCanvasAsset(`${basePath}/anim_front.png`);
  } catch {
    canvas = await loadImageCanvasAsset(`${basePath}/front.png`);
  }

  if (!hasTransparentPixels(canvas)) {
    return makeCanvasTransparent(canvas, { type: 'top-left' });
  }
  return canvas;
}

/**
 * Practical-parity evolution scene renderer.
 * The state machine owns message flow and this renderer owns visual animation.
 */
export class EvolutionRenderer {
  private static bgCanvasPromise: Promise<HTMLCanvasElement> | null = null;
  private static sparkleCanvasPromise: Promise<HTMLCanvasElement> | null = null;

  private preMonCanvas: HTMLCanvasElement | null = null;
  private postMonCanvas: HTMLCanvasElement | null = null;
  private bgCanvas: HTMLCanvasElement | null = null;
  private sparkleCanvas: HTMLCanvasElement | null = null;

  private running = false;
  private phase: EvolutionAnimationPhase = 'idle';
  private canStop = true;
  private canceled = false;
  private complete = false;

  private frameAccumulatorMs = 0;
  private phaseTimer = 0;
  private bgAngle = 0;
  private rngState = 0x45d9f3b;

  private particles: SparkleParticle[] = [];
  private cycle: CycleState = {
    preScale: MON_MAX_SCALE,
    postScale: MON_MIN_SCALE,
    showingPost: false,
    scaleSpeed: 8,
    mode: 'tryEnd',
  };

  async load(preSpeciesId: number, postSpeciesId: number): Promise<void> {
    this.preMonCanvas = await loadPokemonFrontSpriteCanvas(preSpeciesId);
    this.postMonCanvas = await loadPokemonFrontSpriteCanvas(postSpeciesId);
    this.bgCanvas = await EvolutionRenderer.loadBackgroundCanvas();
    this.sparkleCanvas = await EvolutionRenderer.loadSparkleCanvas();
  }

  private static async loadBackgroundCanvas(): Promise<HTMLCanvasElement> {
    if (!EvolutionRenderer.bgCanvasPromise) {
      EvolutionRenderer.bgCanvasPromise = loadImageCanvasAsset('/pokeemerald/graphics/evolution_scene/bg.png');
    }
    return EvolutionRenderer.bgCanvasPromise;
  }

  private static async loadSparkleCanvas(): Promise<HTMLCanvasElement> {
    if (!EvolutionRenderer.sparkleCanvasPromise) {
      EvolutionRenderer.sparkleCanvasPromise = loadImageCanvasAsset(
        '/pokeemerald/graphics/misc/evo_sparkle.png',
        { transparency: { type: 'top-left' } },
      );
    }
    return EvolutionRenderer.sparkleCanvasPromise;
  }

  start(canStop: boolean): void {
    this.canStop = canStop;
    this.running = true;
    this.phase = 'spiral';
    this.canceled = false;
    this.complete = false;
    this.frameAccumulatorMs = 0;
    this.phaseTimer = 0;
    this.bgAngle = 0;
    this.particles = [];
    this.cycle = {
      preScale: MON_MAX_SCALE,
      postScale: MON_MIN_SCALE,
      showingPost: false,
      scaleSpeed: 8,
      mode: 'tryEnd',
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): EvolutionAnimationStatus {
    return {
      phase: this.phase,
      canCancel: this.phase === 'cycle' && !this.canceled && this.canStop && this.cycle.mode !== 'done',
      canceled: this.canceled,
      complete: this.complete,
    };
  }

  update(dt: number, bHeld: boolean): EvolutionAnimationStatus {
    if (!this.running || this.phase === 'idle' || this.phase === 'done') {
      return this.getStatus();
    }

    this.frameAccumulatorMs += dt;
    while (this.frameAccumulatorMs >= FRAME_MS) {
      this.frameAccumulatorMs -= FRAME_MS;
      this.tickFrame(bHeld);
      if (!this.running) {
        break;
      }
    }

    return this.getStatus();
  }

  render(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, SCENE_WIDTH, SCENE_HEIGHT);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#000000';
    ctx.fillRect(offsetX, offsetY, SCENE_WIDTH, SCENE_HEIGHT);
    this.drawBackground(ctx, offsetX, offsetY);

    this.drawSparkles(ctx, offsetX, offsetY, true);
    this.drawMonSprites(ctx, offsetX, offsetY);
    this.drawSparkles(ctx, offsetX, offsetY, false);

    ctx.restore();
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
  ): void {
    const bg = this.bgCanvas;
    if (!bg) {
      return;
    }

    const innerX = cos256(this.bgAngle, 4) + 8;
    const innerY = sin256(this.bgAngle, 4) + 16;
    const outerX = cos256(this.bgAngle + 0x80, 4) + 8;
    const outerY = sin256(this.bgAngle + 0x80, 4) + 16;

    this.drawTiledBackgroundLayer(ctx, bg, offsetX, offsetY, outerX, outerY, 0.55);
    this.drawTiledBackgroundLayer(ctx, bg, offsetX, offsetY, innerX, innerY, 0.78);

    const pulse = 0.07 + (Math.sin((this.bgAngle * Math.PI) / 128) * 0.03);
    ctx.fillStyle = `rgba(170, 224, 255, ${Math.max(0.02, pulse)})`;
    ctx.fillRect(offsetX, offsetY, SCENE_WIDTH, SCENE_HEIGHT);
  }

  private drawTiledBackgroundLayer(
    ctx: CanvasRenderingContext2D,
    bg: HTMLCanvasElement,
    offsetX: number,
    offsetY: number,
    scrollX: number,
    scrollY: number,
    alpha: number,
  ): void {
    const tileW = bg.width;
    const tileH = bg.height;
    const wrappedX = ((scrollX % tileW) + tileW) % tileW;
    const wrappedY = ((scrollY % tileH) + tileH) % tileH;
    const startX = -wrappedX - tileW;
    const startY = -wrappedY - tileH;

    ctx.globalAlpha = alpha;
    for (let y = startY; y < SCENE_HEIGHT + tileH; y += tileH) {
      for (let x = startX; x < SCENE_WIDTH + tileW; x += tileW) {
        ctx.drawImage(bg, offsetX + Math.floor(x), offsetY + Math.floor(y));
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawMonSprites(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
  ): void {
    const pre = this.preMonCanvas;
    const post = this.postMonCanvas;
    if (!pre || !post) {
      return;
    }

    let preScale = 1;
    let postScale = 0;
    let preAlpha = 1;
    let postAlpha = 0;

    switch (this.phase) {
      case 'spiral':
      case 'arc':
        preScale = 1;
        postScale = 0;
        preAlpha = 1;
        postAlpha = 0;
        break;
      case 'cycle':
        preScale = this.cycle.preScale / MON_MAX_SCALE;
        postScale = this.cycle.postScale / MON_MAX_SCALE;
        preAlpha = preScale > 0.08 ? 1 : 0;
        postAlpha = postScale > 0.08 ? 1 : 0;
        break;
      case 'circle':
      case 'spray':
      case 'reveal':
        preScale = 0;
        postScale = this.phase === 'reveal'
          ? Math.min(1.08, 0.8 + ((this.phaseTimer / 42) * 0.28))
          : 1;
        preAlpha = 0;
        postAlpha = 1;
        break;
      case 'cancel':
        preScale = 1;
        postScale = 0;
        preAlpha = 1;
        postAlpha = 0;
        break;
      default:
        preScale = 1;
        postScale = 0;
        preAlpha = 1;
        postAlpha = 0;
        break;
    }

    if (preScale > 0.01 && preAlpha > 0) {
      this.drawMonSprite(ctx, pre, offsetX, offsetY, preScale, preAlpha);
    }
    if (postScale > 0.01 && postAlpha > 0) {
      this.drawMonSprite(ctx, post, offsetX, offsetY, postScale, postAlpha);
    }
  }

  private drawMonSprite(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    offsetX: number,
    offsetY: number,
    scale: number,
    alpha: number,
  ): void {
    const sourceW = Math.min(MON_BASE_SIZE, canvas.width);
    const sourceH = Math.min(MON_BASE_SIZE, canvas.height);
    const drawW = Math.max(1, Math.round(sourceW * scale));
    const drawH = Math.max(1, Math.round(sourceH * scale));
    const drawX = offsetX + MON_CENTER_X - Math.floor(drawW / 2);
    const drawY = offsetY + MON_CENTER_Y - Math.floor(drawH / 2);

    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(canvas, 0, 0, sourceW, sourceH, drawX, drawY, drawW, drawH);
    ctx.globalAlpha = 1;
  }

  private drawSparkles(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    backLayer: boolean,
  ): void {
    if (!this.sparkleCanvas) {
      return;
    }

    for (const particle of this.particles) {
      if (!particle.visible) {
        continue;
      }
      const isBack = particle.subpriority <= 1;
      if (backLayer !== isBack) {
        continue;
      }

      const drawX = offsetX + Math.round(particle.x + particle.x2 - 4);
      const drawY = offsetY + Math.round(particle.y + particle.y2 - 4);
      ctx.drawImage(this.sparkleCanvas, drawX, drawY);
    }
  }

  private tickFrame(bHeld: boolean): void {
    this.bgAngle = normalizeAngle(this.bgAngle + 5);

    if (this.phase === 'cycle' && this.canStop && !this.canceled && this.cycle.mode !== 'done' && bHeld) {
      this.canceled = true;
      this.particles = [];
      this.phase = 'cancel';
      this.phaseTimer = 0;
      return;
    }

    this.updateParticles();

    switch (this.phase) {
      case 'spiral':
        this.tickSpiralPhase();
        break;
      case 'arc':
        this.tickArcPhase();
        break;
      case 'cycle':
        this.tickCyclePhase();
        break;
      case 'circle':
        this.tickCirclePhase();
        break;
      case 'spray':
        this.tickSprayPhase();
        break;
      case 'reveal':
        this.tickRevealPhase();
        break;
      case 'cancel':
        this.tickCancelPhase();
        break;
      default:
        break;
    }
  }

  private tickSpiralPhase(): void {
    if (this.phaseTimer < 64) {
      if ((this.phaseTimer & 7) === 0) {
        for (let i = 0; i < 4; i++) {
          this.createSpiralSparkle(((this.phaseTimer & 120) * 2) + (i * 64));
        }
      }
    }
    this.phaseTimer++;

    if (this.phaseTimer >= 96) {
      this.phase = 'arc';
      this.phaseTimer = 0;
    }
  }

  private tickArcPhase(): void {
    if (this.phaseTimer < 6) {
      for (let i = 0; i < 9; i++) {
        this.createArcSparkle(i * 16);
      }
    }
    this.phaseTimer++;

    if (this.phaseTimer >= 96) {
      this.phase = 'cycle';
      this.phaseTimer = 0;
    }
  }

  private tickCyclePhase(): void {
    if (this.cycle.mode === 'tryEnd') {
      if (this.cycle.scaleSpeed === 128) {
        this.cycle.mode = 'done';
        this.cycle.preScale = MON_MIN_SCALE;
        this.cycle.postScale = MON_MAX_SCALE;
        this.phase = 'circle';
        this.phaseTimer = 0;
        return;
      }

      this.cycle.scaleSpeed += 2;
      this.cycle.showingPost = !this.cycle.showingPost;
      this.cycle.mode = 'update';
      this.phaseTimer++;
      return;
    }

    if (this.cycle.mode === 'update') {
      let finished = 0;
      if (!this.cycle.showingPost) {
        if (this.cycle.preScale < MON_MAX_SCALE - this.cycle.scaleSpeed) {
          this.cycle.preScale += this.cycle.scaleSpeed;
        } else {
          this.cycle.preScale = MON_MAX_SCALE;
          finished++;
        }

        if (this.cycle.postScale > MON_MIN_SCALE + this.cycle.scaleSpeed) {
          this.cycle.postScale -= this.cycle.scaleSpeed;
        } else {
          this.cycle.postScale = MON_MIN_SCALE;
          finished++;
        }
      } else {
        if (this.cycle.postScale < MON_MAX_SCALE - this.cycle.scaleSpeed) {
          this.cycle.postScale += this.cycle.scaleSpeed;
        } else {
          this.cycle.postScale = MON_MAX_SCALE;
          finished++;
        }

        if (this.cycle.preScale > MON_MIN_SCALE + this.cycle.scaleSpeed) {
          this.cycle.preScale -= this.cycle.scaleSpeed;
        } else {
          this.cycle.preScale = MON_MIN_SCALE;
          finished++;
        }
      }

      if (finished === 2) {
        this.cycle.mode = 'tryEnd';
      }
      this.phaseTimer++;
    }
  }

  private tickCirclePhase(): void {
    if (this.phaseTimer === 0) {
      for (let i = 0; i < 16; i++) {
        this.createCircleSparkle(i * 16, 4);
      }
    }
    if (this.phaseTimer === 32) {
      for (let i = 0; i < 16; i++) {
        this.createCircleSparkle(i * 16, 8);
      }
    }

    this.phaseTimer++;
    if (this.phaseTimer >= 48) {
      this.phase = 'spray';
      this.phaseTimer = 0;
    }
  }

  private tickSprayPhase(): void {
    if (this.phaseTimer === 0) {
      for (let i = 0; i < 8; i++) {
        this.createSpraySparkle(i);
      }
    } else if (this.phaseTimer < 50) {
      this.createSpraySparkle(this.nextRandom() & 7);
    }

    this.phaseTimer++;
    if (this.phaseTimer >= 128 && this.particles.length === 0) {
      this.phase = 'reveal';
      this.phaseTimer = 0;
    }
  }

  private tickRevealPhase(): void {
    this.phaseTimer++;
    if (this.phaseTimer >= 42) {
      this.complete = true;
      this.running = false;
      this.phase = 'done';
    }
  }

  private tickCancelPhase(): void {
    this.phaseTimer++;
    if (this.phaseTimer >= 26) {
      this.complete = true;
      this.running = false;
      this.phase = 'done';
    }
  }

  private updateParticles(): void {
    const nextParticles: SparkleParticle[] = [];

    for (const particle of this.particles) {
      let keep = true;
      switch (particle.kind) {
        case 'spiral':
          keep = this.updateSpiralParticle(particle);
          break;
        case 'arc':
          keep = this.updateArcParticle(particle);
          break;
        case 'circle':
          keep = this.updateCircleParticle(particle);
          break;
        case 'spray':
          keep = this.updateSprayParticle(particle);
          break;
      }
      if (keep) {
        nextParticles.push(particle);
      }
    }

    this.particles = nextParticles;
  }

  private updateSpiralParticle(particle: SparkleParticle): boolean {
    if (particle.y <= 8) {
      return false;
    }

    particle.y = 88 - ((particle.timer * particle.timer) / 80);
    particle.y2 = sin256(particle.trig, particle.amplitude) / 4;
    particle.x2 = cos256(particle.trig, particle.amplitude);
    particle.trig += 4;
    if ((particle.timer & 1) !== 0) {
      particle.amplitude--;
    }
    particle.timer++;
    particle.subpriority = particle.y2 > 0 ? 1 : 20;
    particle.visible = true;
    return true;
  }

  private updateArcParticle(particle: SparkleParticle): boolean {
    if (particle.y >= 88) {
      return false;
    }

    particle.y = 8 + ((particle.timer * particle.timer) / 5);
    particle.y2 = sin256(particle.trig, particle.amplitude) / 4;
    particle.x2 = cos256(particle.trig, particle.amplitude);
    particle.amplitude = 8 + sin256(particle.timer * 4, 40);
    particle.timer++;
    particle.visible = true;
    particle.subpriority = 1;
    return true;
  }

  private updateCircleParticle(particle: SparkleParticle): boolean {
    if (particle.amplitude <= 8) {
      return false;
    }

    particle.y2 = sin256(particle.trig, particle.amplitude);
    particle.x2 = cos256(particle.trig, particle.amplitude);
    particle.amplitude -= particle.speed;
    particle.trig += 4;
    particle.visible = true;
    particle.subpriority = 1;
    return true;
  }

  private updateSprayParticle(particle: SparkleParticle): boolean {
    if ((particle.timer & 3) === 0) {
      particle.y += 1;
    }
    if (particle.trig >= 128) {
      return false;
    }

    particle.y2 = -sin256(particle.trig, particle.amplitude);
    particle.x = (SCENE_WIDTH / 2) + ((particle.speed * particle.timer) / 3);
    particle.trig++;
    if (particle.trig > 64) {
      particle.subpriority = 1;
      particle.visible = true;
    } else {
      particle.subpriority = 20;
      particle.visible = true;
      if (particle.trig > 112 && (particle.trig & 1) !== 0) {
        particle.visible = false;
      }
    }
    particle.timer++;
    return true;
  }

  private createSpiralSparkle(trig: number): void {
    this.particles.push({
      kind: 'spiral',
      x: SCENE_WIDTH / 2,
      y: 88,
      x2: 0,
      y2: 0,
      trig,
      amplitude: 48,
      timer: 0,
      speed: 0,
      subpriority: 20,
      visible: true,
    });
  }

  private createArcSparkle(trig: number): void {
    this.particles.push({
      kind: 'arc',
      x: SCENE_WIDTH / 2,
      y: 8,
      x2: 0,
      y2: 0,
      trig,
      amplitude: 8,
      timer: 0,
      speed: 0,
      subpriority: 1,
      visible: true,
    });
  }

  private createCircleSparkle(trig: number, speed: number): void {
    this.particles.push({
      kind: 'circle',
      x: SCENE_WIDTH / 2,
      y: 56,
      x2: 0,
      y2: 0,
      trig,
      amplitude: 120,
      timer: 0,
      speed,
      subpriority: 1,
      visible: true,
    });
  }

  private createSpraySparkle(_id: number): void {
    this.particles.push({
      kind: 'spray',
      x: SCENE_WIDTH / 2,
      y: 56,
      x2: 0,
      y2: 0,
      trig: 0,
      amplitude: 48 + (this.nextRandom() & 0x3f),
      timer: 0,
      speed: 3 - (this.nextRandom() % 7),
      subpriority: 20,
      visible: true,
    });
  }

  private nextRandom(): number {
    this.rngState = (Math.imul(this.rngState, 1103515245) + 12345) & 0x7fffffff;
    return this.rngState;
  }
}

/** Graphics tags/palettes from public/pokeemerald/src/data/battle_anim.h; GBA 1D OBJ tile layout. */
import { BATTLE_ANIMATION_ASSETS, BATTLE_ANIMATION_BACKGROUNDS, BATTLE_ANIMATION_TEMPLATES } from '../../../data/battleAnimationPrograms.gen.ts';
import { loadTilesetImage } from '../../../utils/mapLoader';
import { loadBinaryAsset } from '../../../utils/assetLoader';
import { decodeGbaBgTilemap, drawGbaBgTilemap } from '../../../rendering/gbaTilemap';
import type { BattleWebGLContext } from '../../render/BattleWebGLContext';
export interface AnimationFrameRegion { atlas: string; y: number; width: number; height: number }
const frameKey = (tile: number, width: number, height: number) => `${tile}:${width}:${height}`;
export class AnimationAssets {
  private webgl: BattleWebGLContext;
  private frames = new Map<string, Map<string, AnimationFrameRegion>>();
  private backgrounds = new Map<number, AnimationFrameRegion[]>();
  private pending = new Map<number, Promise<void>>();
  private atlases = new Set<string>();
  private disposed = false;
  constructor(webgl: BattleWebGLContext) { this.webgl = webgl; }
  preload(tags: readonly number[], backgrounds: readonly number[] = []): Promise<void> | void {
    if (this.disposed) throw new Error('Animation assets disposed');
    const work: Promise<void>[] = [];
    const schedule = (key: number, load: () => Promise<void>) => {
      let pending = this.pending.get(key);
      if (!pending) { pending = load().finally(() => { this.pending.delete(key); }); this.pending.set(key, pending); }
      work.push(pending);
    };
    for (const tag of new Set(tags)) {
      const templates = Object.entries(BATTLE_ANIMATION_TEMPLATES).filter(([, template]) => template.tag === tag);
      if (templates.length && templates.every(([name]) => this.frames.has(name))) continue;
      schedule(tag, () => this.load(tag));
    }
    for (const id of new Set(backgrounds)) if (!this.backgrounds.has(id)) schedule(-id - 1, () => this.loadBackground(id));
    if (work.length) return Promise.all(work).then(() => {});
  }
  getFrame(template: string, tileOffset: number, width?: number, height?: number): AnimationFrameRegion {
    const definition = BATTLE_ANIMATION_TEMPLATES[template];
    const frame = this.frames.get(template)?.get(frameKey(tileOffset, width ?? definition.width, height ?? definition.height));
    if (!frame) throw new Error(`Unprepared animation frame ${template}:${tileOffset}`);
    return frame;
  }
  getBackground(id: number, cycle: number): AnimationFrameRegion {
    const frames = this.backgrounds.get(id);
    if (!frames) throw new Error(`Unprepared animation background ${id}`);
    return frames[cycle % frames.length];
  }
  dispose(): void {
    this.disposed = true;
    for (const atlas of this.atlases) this.webgl.removeSpriteSheet(atlas);
    this.atlases.clear(); this.frames.clear(); this.backgrounds.clear(); this.pending.clear();
  }
  private upload(atlas: string, canvas: HTMLCanvasElement): void {
    if (this.disposed) throw new Error('Animation asset load cancelled');
    this.webgl.uploadSpriteSheet(atlas, canvas, { width: canvas.width, height: canvas.height });
    this.atlases.add(atlas);
  }
  private async load(tag: number): Promise<void> {
    const asset = BATTLE_ANIMATION_ASSETS[tag];
    if (!asset) throw new Error(`Unknown animation asset ${tag}`);
    const sources = await Promise.all((asset.parts ?? [asset.path]).map((path) => loadTilesetImage(path, true)));
    if (this.disposed) throw new Error('Animation asset load cancelled');
    // Concatenated graphics follow graphics_file_rules.mk in tile order, not PNG row order.
    const tiles = new Uint8Array(sources.reduce((count, source) => count + source.width * source.height, 0));
    let cursor = 0;
    for (const source of sources) for (let ty = 0; ty < source.height; ty += 8) for (let tx = 0; tx < source.width; tx += 8)
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) tiles[cursor++] = source.data[(ty + y) * source.width + tx + x];
    for (const [name, template] of Object.entries(BATTLE_ANIMATION_TEMPLATES)) {
      if (template.tag !== tag) continue;
      const offsets = [...new Set([0, ...template.frames.flatMap((table) => table.filter((cmd) => cmd.op === 'FRAME').map((cmd) => cmd.args[0]))])];
      const shapes = [...offsets.map((tileOffset) => ({ tileOffset, width: template.width, height: template.height })), ...(template.extraFrames ?? [])];
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(...shapes.map((shape) => shape.width)); canvas.height = shapes.reduce((height, shape) => height + shape.height, 0);
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Cannot prepare animation atlas');
      const image = ctx.createImageData(canvas.width, canvas.height);
      const regions = new Map<string, AnimationFrameRegion>();
      const atlas = `battle_anim_${name}`;
      let frameY = 0;
      for (const shape of shapes) {
        for (let y = 0; y < shape.height; y++) for (let x = 0; x < shape.width; x++) {
          const tile = shape.tileOffset + Math.floor(y / 8) * (shape.width / 8) + Math.floor(x / 8);
          const sourceIndex = tile * 64 + (y % 8) * 8 + x % 8;
          if (sourceIndex >= tiles.length || tile < 0) throw new Error(`Animation tile out of bounds ${name}:${tile}`);
          const index = tiles[sourceIndex]; if (index === 0) continue;
          const color = asset.palette[index]; if (!color) throw new Error(`Missing animation palette index ${index}`);
          const dest = ((frameY + y) * canvas.width + x) * 4;
          image.data[dest] = color[0]; image.data[dest + 1] = color[1]; image.data[dest + 2] = color[2]; image.data[dest + 3] = 255;
        }
        regions.set(frameKey(shape.tileOffset, shape.width, shape.height), { atlas, y: frameY, width: shape.width, height: shape.height });
        frameY += shape.height;
      }
      ctx.putImageData(image, 0, 0); this.upload(atlas, canvas); this.frames.set(name, regions);
    }
  }
  private async loadBackground(id: number): Promise<void> {
    const bg = BATTLE_ANIMATION_BACKGROUNDS[id]; if (!bg) throw new Error(`Unknown background ${id}`);
    const [source, binary] = await Promise.all([loadTilesetImage(bg.path, true), loadBinaryAsset(bg.tilemap)]);
    if (this.disposed) throw new Error('Animation background load cancelled');
    const tilemap = decodeGbaBgTilemap(binary), variants = Math.max(1, bg.cycleColors);
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 160 * variants;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Cannot prepare animation background');
    const atlas = `battle_anim_bg_${id}`, frames: AnimationFrameRegion[] = [];
    for (let cycle = 0; cycle < variants; cycle++) {
      const palette = bg.palette.map((_, i) => {
        const color = bg.palette[i > 0 && i <= bg.cycleColors ? 1 + ((i - 1 - cycle + bg.cycleColors) % bg.cycleColors) : i];
        return `#${color.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
      });
      ctx.save(); ctx.translate(0, cycle * 160);
      drawGbaBgTilemap(ctx, { kind: 'indexed', pixels: source.data, width: source.width, height: source.height }, tilemap,
        { mapWidthTiles: 32, mapHeightTiles: 32, visibleWidthPx: 240, visibleHeightPx: 160,
          paletteBanks: [palette], paletteBankOffset: 2, transparentColorIndexZero: false });
      ctx.restore(); frames.push({ atlas, y: cycle * 160, width: 240, height: 160 });
    }
    this.upload(atlas, canvas); this.backgrounds.set(id, frames);
  }
}

/** Bitmap glyph rendering from public/pokeemerald/src/text.c and tools/gbagfx/font.c. */
import { GBA_FONT_WIDTHS, GBA_GLYPHS } from '../data/gbaFonts.gen';
import { loadImageCanvasAsset } from '../utils/assetLoader';

export type GbaFont = keyof typeof GBA_FONT_WIDTHS;
export interface GbaTextStyle {
  font?: GbaFont;
  color?: string;
  shadow?: string;
  scale?: number;
  align?: 'left' | 'right';
}

const masks = new Map<GbaFont, { foreground: HTMLCanvasElement; shadow: HTMLCanvasElement }>();
const atlases = new Map<string, HTMLCanvasElement>();
let preload: Promise<void> | undefined;

function canvas(width: number, height: number): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  return result;
}

export function preloadGbaFonts(): Promise<void> {
  return preload ??= Promise.all((['small', 'normal', 'narrow'] as const).map(async (font) => {
    const source = await loadImageCanvasAsset(`/pokeemerald/graphics/fonts/latin_${font}.png`);
    const ctx = source.getContext('2d')!;
    const pixels = ctx.getImageData(0, 0, source.width, source.height);
    const layers = [56, 216].map((red) => {
      const layer = canvas(source.width, source.height);
      const layerCtx = layer.getContext('2d')!;
      const data = layerCtx.createImageData(source.width, source.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        // The font tooling distinguishes ink/shadow from blue padding and white boxes.
        if (pixels.data[i] === red && pixels.data[i + 1] === red && pixels.data[i + 2] === red) {
          data.data.set([255, 255, 255, 255], i);
        }
      }
      layerCtx.putImageData(data, 0, 0);
      return layer;
    });
    masks.set(font, { foreground: layers[0], shadow: layers[1] });
  })).then(() => undefined);
}

function atlasFor(font: GbaFont, color: string, shadow: string): HTMLCanvasElement | undefined {
  const key = `${font}:${color}:${shadow}`;
  const cached = atlases.get(key);
  if (cached) return cached;
  const mask = masks.get(font);
  if (!mask) return undefined;
  const atlas = canvas(mask.foreground.width, mask.foreground.height);
  const ctx = atlas.getContext('2d')!;
  for (const [source, tint] of [[mask.shadow, shadow], [mask.foreground, color]] as const) {
    const layer = canvas(atlas.width, atlas.height);
    const layerCtx = layer.getContext('2d')!;
    layerCtx.drawImage(source, 0, 0);
    layerCtx.globalCompositeOperation = 'source-in';
    layerCtx.fillStyle = tint;
    layerCtx.fillRect(0, 0, layer.width, layer.height);
    ctx.drawImage(layer, 0, 0);
  }
  atlases.set(key, atlas);
  return atlas;
}

function glyphId(character: string): number {
  return GBA_GLYPHS[character] ?? GBA_GLYPHS['?'];
}

export function measureGbaText(text: string, font: GbaFont = 'normal'): number {
  return [...text].reduce((width, character) => width + GBA_FONT_WIDTHS[font][glyphId(character)], 0);
}

export function drawGbaText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: GbaTextStyle = {},
): void {
  const { font = 'normal', color = '#414141', shadow = '#d5d5cd', scale = 1, align = 'left' } = style;
  const atlas = atlasFor(font, color, shadow);
  if (!atlas) return;
  let cursor = align === 'right' ? x - measureGbaText(text, font) * scale : x;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  for (const character of text) {
    const id = glyphId(character);
    const width = GBA_FONT_WIDTHS[font][id];
    ctx.drawImage(atlas, (id % 16) * 16, Math.floor(id / 16) * 16, width, 16,
      Math.round(cursor), Math.round(y), width * scale, 16 * scale);
    cursor += width * scale;
  }
  ctx.imageSmoothingEnabled = smoothing;
}

/** Optional painter for the shared prompt renderer; keeps battle text metrics and drawing identical. */
export const battleMessageTextPainter = {
  measure: (text: string) => measureGbaText(text),
  draw: (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, scale: number) =>
    drawGbaText(ctx, text, x, y, { color: '#ffffff', shadow: '#6a5a73', scale }),
};

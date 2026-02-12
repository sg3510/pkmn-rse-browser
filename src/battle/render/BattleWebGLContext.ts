/**
 * Offscreen WebGL2 context for rendering the battle scene at GBA resolution (240×160).
 *
 * The overworld uses the same pattern: WebGL canvas renders at native resolution,
 * then gets composited onto the main ctx2d via drawImage().
 *
 * C ref: GBA hardware renders at 240×160 pixels.
 */
import { WebGLSpriteRenderer } from '../../rendering/webgl/WebGLSpriteRenderer';
import type { SpriteInstance, WorldCameraView, SpriteSheetInfo } from '../../rendering/types';

/** GBA native resolution */
export const BATTLE_WIDTH = 240;
export const BATTLE_HEIGHT = 160;

/**
 * Battle-scene camera view — a fixed camera (no scrolling) at GBA resolution.
 * Sprites use screen coordinates directly (worldX = screenX).
 */
function createBattleCameraView(): WorldCameraView {
  return {
    worldStartTileX: 0,
    worldStartTileY: 0,
    cameraWorldX: 0,
    cameraWorldY: 0,
    pixelWidth: BATTLE_WIDTH,
    pixelHeight: BATTLE_HEIGHT,
    // These aren't used for battle but are needed by the interface
    startTileX: 0,
    startTileY: 0,
    widthInTiles: BATTLE_WIDTH / 16,
    heightInTiles: BATTLE_HEIGHT / 16,
  };
}

export class BattleWebGLContext {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly spriteRenderer: WebGLSpriteRenderer;
  readonly cameraView: WorldCameraView;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = BATTLE_WIDTH;
    this.canvas.height = BATTLE_HEIGHT;

    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      throw new Error('WebGL2 not available for battle rendering');
    }
    this.gl = gl;

    // Pixel-perfect filtering (no smoothing)
    gl.viewport(0, 0, BATTLE_WIDTH, BATTLE_HEIGHT);

    this.spriteRenderer = new WebGLSpriteRenderer(gl);
    this.spriteRenderer.initialize();

    this.cameraView = createBattleCameraView();
  }

  /** Upload a sprite sheet (PNG image pre-rendered to canvas or ImageData). */
  uploadSpriteSheet(
    name: string,
    source: HTMLCanvasElement | ImageData,
    info?: Partial<SpriteSheetInfo>,
  ): void {
    this.spriteRenderer.uploadSpriteSheet(name, source, info);
  }

  /** Check if a sprite sheet is already uploaded. */
  hasSpriteSheet(name: string): boolean {
    return this.spriteRenderer.hasSpriteSheet(name);
  }

  /** Remove a sprite sheet. */
  removeSpriteSheet(name: string): void {
    this.spriteRenderer.removeSpriteSheet(name);
  }

  /** Clear the WebGL canvas. */
  clear(r = 0, g = 0, b = 0, a = 1): void {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /** Render a batch of sprites. */
  renderSprites(sprites: SpriteInstance[]): void {
    if (sprites.length === 0) return;
    this.spriteRenderer.renderBatch(sprites, this.cameraView);
  }

  /**
   * Composite the WebGL canvas onto a 2D canvas context.
   * If the viewport is larger than 240×160, centers the battle scene.
   */
  compositeOnto(
    ctx2d: CanvasRenderingContext2D,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    const offsetX = Math.floor((viewportWidth - BATTLE_WIDTH) / 2);
    const offsetY = Math.floor((viewportHeight - BATTLE_HEIGHT) / 2);

    // If viewport > battle size, darken borders
    if (viewportWidth > BATTLE_WIDTH || viewportHeight > BATTLE_HEIGHT) {
      ctx2d.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx2d.fillRect(0, 0, viewportWidth, viewportHeight);
    }

    ctx2d.drawImage(this.canvas, offsetX, offsetY);
  }

  /** Release WebGL resources. */
  dispose(): void {
    this.spriteRenderer.dispose();
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}

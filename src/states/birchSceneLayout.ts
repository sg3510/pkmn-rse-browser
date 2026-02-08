/**
 * Shared Birch intro scene layout helpers.
 *
 * The original cutscene is composed on a 240x160 GBA framebuffer.
 * We keep that virtual scene fixed, then fit it responsively in any viewport.
 *
 * When the viewport aspect ratio differs from 3:2, the outermost pixel
 * rows/columns of the scene are stretched to fill the extra space
 * (clamp-to-edge), so there are never black letterbox bars.
 */

export const BIRCH_SCENE_WIDTH = 240;
export const BIRCH_SCENE_HEIGHT = 160;

export interface BirchSceneFit {
  /** Scale factor applied to the 240x160 scene */
  scale: number;
  /** Scaled scene width in viewport pixels */
  width: number;
  /** Scaled scene height in viewport pixels */
  height: number;
  /** X offset of the scene within the viewport */
  x: number;
  /** Y offset of the scene within the viewport */
  y: number;
}

/**
 * Compute how the 240x160 GBA scene fits (cover) inside the viewport.
 * Uses cover scaling so the scene fills the entire viewport with minimal
 * cropping, matching GBA behavior where the scene fills the whole screen.
 */
export function getBirchSceneFit(viewportWidth: number, viewportHeight: number): BirchSceneFit {
  const scale = Math.max(viewportWidth / BIRCH_SCENE_WIDTH, viewportHeight / BIRCH_SCENE_HEIGHT);
  const width = Math.max(1, Math.round(BIRCH_SCENE_WIDTH * scale));
  const height = Math.max(1, Math.round(BIRCH_SCENE_HEIGHT * scale));
  const x = Math.floor((viewportWidth - width) / 2);
  const y = Math.floor((viewportHeight - height) / 2);
  return { scale, width, height, x, y };
}

/**
 * Draw the pre-rendered 240x160 scene into the viewport with edge-extension
 * so the background fills the entire viewport (no black letterbox bars).
 *
 * The technique stretches the outermost pixel rows/columns of the scene to
 * cover any gap between the fitted scene and the viewport edges — similar
 * to OpenGL GL_CLAMP_TO_EDGE or CSS border-image stretch.
 */
export function drawSceneWithEdgeExtension(
  ctx: CanvasRenderingContext2D,
  scene: HTMLCanvasElement,
  viewportWidth: number,
  viewportHeight: number,
  fit: BirchSceneFit,
): void {
  const rightX = fit.x + fit.width;
  const bottomY = fit.y + fit.height;

  // --- Extend top edge ---
  if (fit.y > 0) {
    ctx.drawImage(
      scene, 0, 0, BIRCH_SCENE_WIDTH, 1,
      fit.x, 0, fit.width, fit.y,
    );
  }

  // --- Extend bottom edge ---
  if (bottomY < viewportHeight) {
    ctx.drawImage(
      scene, 0, BIRCH_SCENE_HEIGHT - 1, BIRCH_SCENE_WIDTH, 1,
      fit.x, bottomY, fit.width, viewportHeight - bottomY,
    );
  }

  // --- Extend left edge ---
  if (fit.x > 0) {
    ctx.drawImage(
      scene, 0, 0, 1, BIRCH_SCENE_HEIGHT,
      0, fit.y, fit.x, fit.height,
    );
    // Top-left corner
    if (fit.y > 0) {
      ctx.drawImage(scene, 0, 0, 1, 1, 0, 0, fit.x, fit.y);
    }
    // Bottom-left corner
    if (bottomY < viewportHeight) {
      ctx.drawImage(
        scene, 0, BIRCH_SCENE_HEIGHT - 1, 1, 1,
        0, bottomY, fit.x, viewportHeight - bottomY,
      );
    }
  }

  // --- Extend right edge ---
  if (rightX < viewportWidth) {
    const rightW = viewportWidth - rightX;
    ctx.drawImage(
      scene, BIRCH_SCENE_WIDTH - 1, 0, 1, BIRCH_SCENE_HEIGHT,
      rightX, fit.y, rightW, fit.height,
    );
    // Top-right corner
    if (fit.y > 0) {
      ctx.drawImage(
        scene, BIRCH_SCENE_WIDTH - 1, 0, 1, 1,
        rightX, 0, rightW, fit.y,
      );
    }
    // Bottom-right corner
    if (bottomY < viewportHeight) {
      ctx.drawImage(
        scene, BIRCH_SCENE_WIDTH - 1, BIRCH_SCENE_HEIGHT - 1, 1, 1,
        rightX, bottomY, rightW, viewportHeight - bottomY,
      );
    }
  }

  // --- Draw the main scene on top ---
  ctx.drawImage(
    scene,
    0, 0, BIRCH_SCENE_WIDTH, BIRCH_SCENE_HEIGHT,
    fit.x, fit.y, fit.width, fit.height,
  );
}

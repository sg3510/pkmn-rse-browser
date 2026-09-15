/**
 * DialogFrame - 9-slice frame renderer for dialog boxes
 *
 * Renders Pokemon Emerald style dialog frames using the authentic
 * 24x24 (3x3 tile) source graphics with proper 9-slice scaling.
 *
 * Source graphics: /pokeemerald/graphics/text_window/{1-20}.png
 * Each frame is 24x24 pixels (3x3 tiles of 8x8 each)
 */

import React, { useEffect, useRef, useState } from 'react';
import { TILE_SIZE, getFramePath } from './types';
import { loadImageCanvasAsset } from '../../utils/assetLoader';

interface DialogFrameProps {
  /** Width in pixels (will be rounded to tile boundary) */
  width: number;
  /** Height in pixels (will be rounded to tile boundary) */
  height: number;
  /** Frame style 1-20 */
  style?: number;
  /** Zoom level for scaling */
  zoom?: number;
  /** Children to render inside the frame */
  children?: React.ReactNode;
}

// Cache for loaded frame canvases (with transparency applied)
const frameCache = new Map<number, HTMLCanvasElement>();

/**
 * Load a frame image and apply transparency (remove background color)
 */
async function loadFrameImage(style: number): Promise<HTMLCanvasElement> {
  if (frameCache.has(style)) {
    return frameCache.get(style)!;
  }

  const canvas = await loadImageCanvasAsset(getFramePath(style), {
    transparency: { type: 'top-left' },
  });
  frameCache.set(style, canvas);
  return canvas;
}

export const DialogFrame: React.FC<DialogFrameProps> = ({
  width,
  height,
  style = 1,
  zoom = 1,
  children,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Round dimensions to tile boundaries
  const scaledTileSize = TILE_SIZE * zoom;
  const roundedWidth = Math.round(width / scaledTileSize) * scaledTileSize;
  const roundedHeight = Math.round(height / scaledTileSize) * scaledTileSize;

  const nativeWidth = Math.round(width / scaledTileSize) * TILE_SIZE;
  const nativeHeight = Math.round(height / scaledTileSize) * TILE_SIZE;

  useEffect(() => {
    let cancelled = false;

    async function renderFrame() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const img = await loadFrameImage(style);
        if (cancelled) return;

        // Set canvas size
        canvas.width = nativeWidth;
        canvas.height = nativeHeight;

        // Disable smoothing for pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;

        // Clear canvas
        ctx.clearRect(0, 0, nativeWidth, nativeHeight);

        // Source tile size (always 8px in source image)
        const srcTile = TILE_SIZE;
        // Compose at native resolution; CSS scales the complete frame.
        const dstTile = TILE_SIZE;

        // Draw 9-slice frame
        // The source image is 24x24 (3x3 tiles)
        // Layout: [TL][T][TR]
        //         [L][C][R]
        //         [BL][B][BR]

        // === Corners (no tiling, just scale) ===
        // Top-left
        ctx.drawImage(img, 0, 0, srcTile, srcTile, 0, 0, dstTile, dstTile);
        // Top-right
        ctx.drawImage(img, srcTile * 2, 0, srcTile, srcTile, nativeWidth - dstTile, 0, dstTile, dstTile);
        // Bottom-left
        ctx.drawImage(img, 0, srcTile * 2, srcTile, srcTile, 0, nativeHeight - dstTile, dstTile, dstTile);
        // Bottom-right
        ctx.drawImage(img, srcTile * 2, srcTile * 2, srcTile, srcTile, nativeWidth - dstTile, nativeHeight - dstTile, dstTile, dstTile);

        // === Edges (tile to fill) ===
        // Top edge
        for (let x = dstTile; x < nativeWidth - dstTile; x += dstTile) {
          const drawWidth = Math.min(dstTile, nativeWidth - dstTile - x);
          ctx.drawImage(img, srcTile, 0, srcTile, srcTile, x, 0, drawWidth, dstTile);
        }
        // Bottom edge
        for (let x = dstTile; x < nativeWidth - dstTile; x += dstTile) {
          const drawWidth = Math.min(dstTile, nativeWidth - dstTile - x);
          ctx.drawImage(img, srcTile, srcTile * 2, srcTile, srcTile, x, nativeHeight - dstTile, drawWidth, dstTile);
        }
        // Left edge
        for (let y = dstTile; y < nativeHeight - dstTile; y += dstTile) {
          const drawHeight = Math.min(dstTile, nativeHeight - dstTile - y);
          ctx.drawImage(img, 0, srcTile, srcTile, srcTile, 0, y, dstTile, drawHeight);
        }
        // Right edge
        for (let y = dstTile; y < nativeHeight - dstTile; y += dstTile) {
          const drawHeight = Math.min(dstTile, nativeHeight - dstTile - y);
          ctx.drawImage(img, srcTile * 2, srcTile, srcTile, srcTile, nativeWidth - dstTile, y, dstTile, drawHeight);
        }

        // === Center (tile to fill interior) ===
        for (let y = dstTile; y < nativeHeight - dstTile; y += dstTile) {
          for (let x = dstTile; x < nativeWidth - dstTile; x += dstTile) {
            const drawWidth = Math.min(dstTile, nativeWidth - dstTile - x);
            const drawHeight = Math.min(dstTile, nativeHeight - dstTile - y);
            ctx.drawImage(img, srcTile, srcTile, srcTile, srcTile, x, y, drawWidth, drawHeight);
          }
        }

        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to load dialog frame:', err);
      }
    }

    renderFrame();

    return () => {
      cancelled = true;
    };
  }, [style, nativeWidth, nativeHeight]);

  return (
    <div
      style={{
        position: 'relative',
        width: roundedWidth,
        height: roundedHeight,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: roundedWidth,
          height: roundedHeight,
          imageRendering: 'pixelated',
        }}
      />
      {/* Content area (inside the frame border) */}
      {isLoaded && (
        <div
          style={{
            position: 'absolute',
            top: scaledTileSize,
            left: scaledTileSize,
            width: roundedWidth - 2 * scaledTileSize,
            height: roundedHeight - 2 * scaledTileSize,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default DialogFrame;

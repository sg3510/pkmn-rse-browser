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

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Create canvas and apply transparency
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      // Get image data and remove background color (top-left pixel)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      // Replace all matching pixels with transparent
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
          data[i + 3] = 0; // Alpha 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      frameCache.set(style, canvas);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = getFramePath(style);
  });
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
        canvas.width = roundedWidth;
        canvas.height = roundedHeight;

        // Disable smoothing for pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;

        // Clear canvas
        ctx.clearRect(0, 0, roundedWidth, roundedHeight);

        // Source tile size (always 8px in source image)
        const srcTile = TILE_SIZE;
        // Destination tile size (scaled by zoom)
        const dstTile = scaledTileSize;

        // Draw 9-slice frame
        // The source image is 24x24 (3x3 tiles)
        // Layout: [TL][T][TR]
        //         [L][C][R]
        //         [BL][B][BR]

        // === Corners (no tiling, just scale) ===
        // Top-left
        ctx.drawImage(img, 0, 0, srcTile, srcTile, 0, 0, dstTile, dstTile);
        // Top-right
        ctx.drawImage(img, srcTile * 2, 0, srcTile, srcTile, roundedWidth - dstTile, 0, dstTile, dstTile);
        // Bottom-left
        ctx.drawImage(img, 0, srcTile * 2, srcTile, srcTile, 0, roundedHeight - dstTile, dstTile, dstTile);
        // Bottom-right
        ctx.drawImage(img, srcTile * 2, srcTile * 2, srcTile, srcTile, roundedWidth - dstTile, roundedHeight - dstTile, dstTile, dstTile);

        // === Edges (tile to fill) ===
        // Top edge
        for (let x = dstTile; x < roundedWidth - dstTile; x += dstTile) {
          const drawWidth = Math.min(dstTile, roundedWidth - dstTile - x);
          ctx.drawImage(img, srcTile, 0, srcTile, srcTile, x, 0, drawWidth, dstTile);
        }
        // Bottom edge
        for (let x = dstTile; x < roundedWidth - dstTile; x += dstTile) {
          const drawWidth = Math.min(dstTile, roundedWidth - dstTile - x);
          ctx.drawImage(img, srcTile, srcTile * 2, srcTile, srcTile, x, roundedHeight - dstTile, drawWidth, dstTile);
        }
        // Left edge
        for (let y = dstTile; y < roundedHeight - dstTile; y += dstTile) {
          const drawHeight = Math.min(dstTile, roundedHeight - dstTile - y);
          ctx.drawImage(img, 0, srcTile, srcTile, srcTile, 0, y, dstTile, drawHeight);
        }
        // Right edge
        for (let y = dstTile; y < roundedHeight - dstTile; y += dstTile) {
          const drawHeight = Math.min(dstTile, roundedHeight - dstTile - y);
          ctx.drawImage(img, srcTile * 2, srcTile, srcTile, srcTile, roundedWidth - dstTile, y, dstTile, drawHeight);
        }

        // === Center (tile to fill interior) ===
        for (let y = dstTile; y < roundedHeight - dstTile; y += dstTile) {
          for (let x = dstTile; x < roundedWidth - dstTile; x += dstTile) {
            const drawWidth = Math.min(dstTile, roundedWidth - dstTile - x);
            const drawHeight = Math.min(dstTile, roundedHeight - dstTile - y);
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
  }, [style, roundedWidth, roundedHeight, scaledTileSize, zoom]);

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

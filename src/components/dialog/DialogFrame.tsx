import React, { useMemo } from 'react';
import { TILE_SIZE, FRAME_STYLES_COUNT } from './types';

interface DialogFrameProps {
  frameStyle: number;           // 1-20 for authentic frames
  children: React.ReactNode;
  zoom: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * DialogFrame - Renders a 9-slice border around content
 *
 * Uses CSS border-image for efficient rendering.
 * The frame graphics are 24x24 pixels (3x3 grid of 8x8 tiles).
 *
 * Frame styles 1-20 available at:
 * /pokeemerald/graphics/text_window/{1-20}.png
 */
export const DialogFrame: React.FC<DialogFrameProps> = ({
  frameStyle,
  children,
  zoom,
  className = '',
  style = {},
}) => {
  // Clamp frame style to valid range
  const validFrameStyle = Math.max(1, Math.min(FRAME_STYLES_COUNT, frameStyle));

  // Calculate scaled border width
  const borderWidth = TILE_SIZE * zoom;

  // Build frame style with border-image
  const frameStyles = useMemo((): React.CSSProperties => ({
    position: 'relative',
    boxSizing: 'border-box',
    borderWidth: `${borderWidth}px`,
    borderStyle: 'solid',
    borderImageSource: `url('/pokeemerald/graphics/text_window/${validFrameStyle}.png')`,
    borderImageSlice: '8 fill',
    borderImageRepeat: 'round',
    imageRendering: 'pixelated',
    // The fill keyword in border-image-slice means the center is also drawn
    // We use the frame's center tile as background
    ...style,
  }), [validFrameStyle, borderWidth, style]);

  return (
    <div className={`dialog-frame ${className}`} style={frameStyles}>
      {children}
    </div>
  );
};

/**
 * Alternative: Canvas-based 9-slice for more control
 * Use this if border-image has issues with certain zoom levels
 */
export const DialogFrameCanvas: React.FC<DialogFrameProps & {
  width: number;
  height: number;
}> = ({
  frameStyle,
  children,
  zoom,
  width,
  height,
  className = '',
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const validFrameStyle = Math.max(1, Math.min(FRAME_STYLES_COUNT, frameStyle));

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = `/pokeemerald/graphics/text_window/${validFrameStyle}.png`;

    img.onload = () => {
      ctx.imageSmoothingEnabled = false;

      // First, process the source image to make background transparent
      // GBA frame images use indexed color with first color as background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(img, 0, 0);

      // Get pixel data and make background color transparent
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;
      // Top-left pixel is the background color
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
          data[i + 3] = 0; // Make transparent
        }
      }
      tempCtx.putImageData(imageData, 0, 0);

      const s = TILE_SIZE; // Source tile size (8px)
      const d = TILE_SIZE * zoom; // Dest tile size (scaled)

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw corners (no scaling needed, just zoom)
      // Top-left
      ctx.drawImage(tempCanvas, 0, 0, s, s, 0, 0, d, d);
      // Top-right
      ctx.drawImage(tempCanvas, s * 2, 0, s, s, width - d, 0, d, d);
      // Bottom-left
      ctx.drawImage(tempCanvas, 0, s * 2, s, s, 0, height - d, d, d);
      // Bottom-right
      ctx.drawImage(tempCanvas, s * 2, s * 2, s, s, width - d, height - d, d, d);

      // Draw edges (tiled)
      // Top edge
      for (let x = d; x < width - d; x += d) {
        const w = Math.min(d, width - d - x);
        ctx.drawImage(tempCanvas, s, 0, s, s, x, 0, w, d);
      }
      // Bottom edge
      for (let x = d; x < width - d; x += d) {
        const w = Math.min(d, width - d - x);
        ctx.drawImage(tempCanvas, s, s * 2, s, s, x, height - d, w, d);
      }
      // Left edge
      for (let y = d; y < height - d; y += d) {
        const h = Math.min(d, height - d - y);
        ctx.drawImage(tempCanvas, 0, s, s, s, 0, y, d, h);
      }
      // Right edge
      for (let y = d; y < height - d; y += d) {
        const h = Math.min(d, height - d - y);
        ctx.drawImage(tempCanvas, s * 2, s, s, s, width - d, y, d, h);
      }

      // Draw center (tiled)
      for (let y = d; y < height - d; y += d) {
        for (let x = d; x < width - d; x += d) {
          const w = Math.min(d, width - d - x);
          const h = Math.min(d, height - d - y);
          ctx.drawImage(tempCanvas, s, s, s, s, x, y, w, h);
        }
      }
    };
  }, [validFrameStyle, zoom, width, height]);

  return (
    <div className={`dialog-frame-canvas ${className}`} style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          imageRendering: 'pixelated',
        }}
      />
      <div
        style={{
          position: 'relative',
          padding: TILE_SIZE * zoom,
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default DialogFrame;

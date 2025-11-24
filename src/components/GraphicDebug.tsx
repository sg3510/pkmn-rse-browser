/**
 * GraphicDebug - Debug page to visualize sprites and their dimensions
 * Access via: /#/graphic-debug
 */

import { useEffect, useRef, useState } from 'react';

interface SpriteInfo {
  name: string;
  path: string;
  expectedFrameWidth: number;
  expectedFrameHeight: number;
  description: string;
}

const SPRITES_TO_DEBUG: SpriteInfo[] = [
  {
    name: 'Brendan Surfing',
    path: '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png',
    expectedFrameWidth: 32,
    expectedFrameHeight: 32,
    description: 'Player surfing sprite - should be 6 frames of 32x32 (192x32 total)',
  },
  {
    name: 'May Surfing',
    path: '/pokeemerald/graphics/object_events/pics/people/may/surfing.png',
    expectedFrameWidth: 32,
    expectedFrameHeight: 32,
    description: 'Player surfing sprite - should be 6 frames of 32x32 (192x32 total)',
  },
  {
    name: 'Surf Blob',
    path: '/pokeemerald/graphics/field_effects/pics/surf_blob.png',
    expectedFrameWidth: 32,
    expectedFrameHeight: 32,
    description: 'Surf blob effect - should be 3 frames of 32x32 (96x32 total)',
  },
  {
    name: 'Brendan Walking',
    path: '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png',
    expectedFrameWidth: 16,
    expectedFrameHeight: 32,
    description: 'Player walking sprite - 16x32 frames for comparison',
  },
  {
    name: 'May Walking',
    path: '/pokeemerald/graphics/object_events/pics/people/may/walking.png',
    expectedFrameWidth: 16,
    expectedFrameHeight: 32,
    description: 'Player walking sprite - 16x32 frames for comparison',
  },
];

const ZOOM = 3;

function SpriteViewer({ info }: { info: SpriteInfo }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageData, setImageData] = useState<{
    width: number;
    height: number;
    frameCount: number;
    loaded: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const frameCount = Math.floor(img.width / info.expectedFrameWidth);
      setImageData({
        width: img.width,
        height: img.height,
        frameCount,
        loaded: true,
      });

      // Draw to canvas at zoom level with frame separators
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width * ZOOM;
      canvas.height = img.height * ZOOM + 60; // Extra space for labels

      // Disable smoothing for pixel-perfect rendering
      ctx.imageSmoothingEnabled = false;

      // Draw background grid
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw sprite at zoom level
      ctx.drawImage(img, 0, 30, img.width * ZOOM, img.height * ZOOM);

      // Draw frame separators and labels
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 1;
      ctx.font = '12px monospace';
      ctx.fillStyle = '#fff';

      for (let i = 0; i <= frameCount; i++) {
        const x = i * info.expectedFrameWidth * ZOOM;

        // Vertical separator line
        ctx.beginPath();
        ctx.moveTo(x, 30);
        ctx.lineTo(x, 30 + img.height * ZOOM);
        ctx.stroke();

        // Frame number label
        if (i < frameCount) {
          ctx.fillText(`F${i}`, x + 4, 24);
        }
      }

      // Draw horizontal line at expected height
      if (img.height !== info.expectedFrameHeight) {
        ctx.strokeStyle = '#ffd93d';
        ctx.beginPath();
        ctx.moveTo(0, 30 + info.expectedFrameHeight * ZOOM);
        ctx.lineTo(canvas.width, 30 + info.expectedFrameHeight * ZOOM);
        ctx.stroke();
        ctx.fillStyle = '#ffd93d';
        ctx.fillText(`Expected height: ${info.expectedFrameHeight}px`, 4, 30 + info.expectedFrameHeight * ZOOM + 14);
      }

      // Draw dimensions at bottom
      ctx.fillStyle = '#aaa';
      ctx.fillText(
        `Actual: ${img.width}x${img.height} | Frames: ${frameCount} x ${info.expectedFrameWidth}x${img.height}`,
        4,
        30 + img.height * ZOOM + 20
      );
    };

    img.onerror = () => {
      setImageData({
        width: 0,
        height: 0,
        frameCount: 0,
        loaded: false,
        error: 'Failed to load image',
      });
    };

    img.src = info.path;
  }, [info]);

  const heightMismatch = imageData && imageData.height !== info.expectedFrameHeight;
  const widthMismatch = imageData && (imageData.width % info.expectedFrameWidth !== 0);

  return (
    <div style={{
      marginBottom: '2rem',
      padding: '1rem',
      background: '#16213e',
      borderRadius: '8px',
      border: heightMismatch || widthMismatch ? '2px solid #ff6b6b' : '1px solid #333'
    }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#4cc9f0' }}>{info.name}</h3>
      <p style={{ margin: '0 0 0.5rem 0', color: '#888', fontSize: '0.9rem' }}>{info.description}</p>
      <p style={{ margin: '0 0 1rem 0', color: '#666', fontSize: '0.8rem' }}>
        Path: <code style={{ color: '#aaa' }}>{info.path}</code>
      </p>

      {imageData?.error && (
        <div style={{ color: '#ff6b6b', padding: '1rem', background: '#2d1f1f', borderRadius: '4px' }}>
          Error: {imageData.error}
        </div>
      )}

      {imageData?.loaded && (
        <div style={{ marginBottom: '1rem' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#888' }}>Image Size:</td>
                <td style={{ color: widthMismatch ? '#ff6b6b' : '#4cc9f0' }}>
                  {imageData.width} x {imageData.height} px
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#888' }}>Expected Frame:</td>
                <td style={{ color: '#4cc9f0' }}>
                  {info.expectedFrameWidth} x {info.expectedFrameHeight} px
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#888' }}>Actual Frame:</td>
                <td style={{ color: heightMismatch ? '#ff6b6b' : '#4cc9f0' }}>
                  {info.expectedFrameWidth} x {imageData.height} px
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#888' }}>Frame Count:</td>
                <td style={{ color: '#4cc9f0' }}>{imageData.frameCount}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#888' }}>Zoom:</td>
                <td style={{ color: '#4cc9f0' }}>{ZOOM}x</td>
              </tr>
            </tbody>
          </table>

          {heightMismatch && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: '#3d2020',
              borderRadius: '4px',
              color: '#ff6b6b',
              fontSize: '0.9rem'
            }}>
              WARNING: Image height ({imageData.height}px) does not match expected frame height ({info.expectedFrameHeight}px)
            </div>
          )}
        </div>
      )}

      <div style={{
        overflow: 'auto',
        background: '#0f0f23',
        padding: '1rem',
        borderRadius: '4px'
      }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>

      {/* Individual frame breakdown */}
      {imageData?.loaded && (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ color: '#888', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Individual Frames:</h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {Array.from({ length: imageData.frameCount }).map((_, i) => (
              <FrameViewer
                key={i}
                path={info.path}
                frameIndex={i}
                frameWidth={info.expectedFrameWidth}
                frameHeight={imageData.height}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FrameViewer({
  path,
  frameIndex,
  frameWidth,
  frameHeight
}: {
  path: string;
  frameIndex: number;
  frameWidth: number;
  frameHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = frameWidth * ZOOM;
      canvas.height = frameHeight * ZOOM;

      ctx.imageSmoothingEnabled = false;

      // Draw checkered background to show transparency
      const checkSize = 4;
      for (let y = 0; y < canvas.height; y += checkSize) {
        for (let x = 0; x < canvas.width; x += checkSize) {
          ctx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? '#2a2a3a' : '#1a1a2a';
          ctx.fillRect(x, y, checkSize, checkSize);
        }
      }

      // Draw the frame
      ctx.drawImage(
        img,
        frameIndex * frameWidth, 0, frameWidth, frameHeight,
        0, 0, frameWidth * ZOOM, frameHeight * ZOOM
      );

      // Draw border
      ctx.strokeStyle = '#444';
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    };
    img.src = path;
  }, [path, frameIndex, frameWidth, frameHeight]);

  return (
    <div style={{ textAlign: 'center' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '4px' }}>
        Frame {frameIndex}
      </div>
    </div>
  );
}

export function GraphicDebug() {
  return (
    <div style={{
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ color: '#4cc9f0', marginBottom: '0.5rem' }}>Graphic Debug</h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>
        Sprite viewer for debugging dimensions and frame layouts. All sprites shown at {ZOOM}x zoom.
        <br />
        <span style={{ color: '#ff6b6b' }}>Red borders</span> indicate dimension mismatches.
        <br />
        <a href="/" style={{ color: '#4cc9f0' }}>← Back to main app</a>
      </p>

      {SPRITES_TO_DEBUG.map((info) => (
        <SpriteViewer key={info.path} info={info} />
      ))}
    </div>
  );
}

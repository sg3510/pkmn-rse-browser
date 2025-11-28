/**
 * WebGLTest - Simple test component for WebGL tile rendering
 *
 * This component creates a standalone WebGL canvas and renders
 * test tiles to verify the WebGL pipeline is working correctly.
 *
 * Usage: Add <WebGLTest /> anywhere in the app to see the test output.
 */

import { useEffect, useRef, useState } from 'react';
import { WebGLContext, isWebGL2Supported } from './WebGLContext';
import { WebGLTileRenderer } from './WebGLTileRenderer';
import type { TileInstance } from './types';

interface TestStats {
  webgl2Supported: boolean;
  initialized: boolean;
  tileCount: number;
  renderTimeMs: number;
  error: string | null;
}

/**
 * Create test tile instances (checkerboard pattern)
 */
function createTestTiles(
  tilesWide: number,
  tilesHigh: number,
  tileSize: number = 8
): TileInstance[] {
  const tiles: TileInstance[] = [];

  for (let y = 0; y < tilesHigh; y++) {
    for (let x = 0; x < tilesWide; x++) {
      // Checkerboard pattern with different tiles
      const tileId = ((x + y) % 2) * 16; // Alternate between tile 0 and 16

      tiles.push({
        x: x * tileSize,
        y: y * tileSize,
        tileId,
        paletteId: (x + y) % 6, // Cycle through palettes
        xflip: x % 4 === 0,
        yflip: y % 4 === 0,
        tilesetIndex: 0, // Primary tileset
      });
    }
  }

  return tiles;
}

/**
 * Create a simple test tileset (gradient pattern)
 */
function createTestTileset(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height);

  // Fill with a gradient pattern for each 8x8 tile
  for (let ty = 0; ty < height / 8; ty++) {
    for (let tx = 0; tx < width / 8; tx++) {
      const tileIndex = ty * (width / 8) + tx;

      for (let py = 0; py < 8; py++) {
        for (let px = 0; px < 8; px++) {
          const dataIndex = (ty * 8 + py) * width + (tx * 8 + px);

          // Create different patterns for different tiles
          if (tileIndex === 0) {
            // Solid color (index 1)
            data[dataIndex] = 1;
          } else if (tileIndex === 16) {
            // Checkerboard
            data[dataIndex] = ((px + py) % 2 === 0) ? 2 : 3;
          } else {
            // Gradient
            data[dataIndex] = Math.min(15, Math.floor((px + py) / 2) + 1);
          }
        }
      }
    }
  }

  return data;
}

/**
 * Create test palettes
 */
function createTestPalettes(): { colors: string[] }[] {
  const palettes: { colors: string[] }[] = [];

  // Create 6 different colored palettes
  const baseColors = [
    ['#000000', '#ff0000', '#00ff00', '#0000ff'], // RGB
    ['#000000', '#ffff00', '#ff00ff', '#00ffff'], // CMY
    ['#000000', '#ffffff', '#888888', '#444444'], // Grayscale
    ['#000000', '#ff8800', '#88ff00', '#0088ff'], // Warm
    ['#000000', '#ff0088', '#8800ff', '#00ff88'], // Cool
    ['#000000', '#884400', '#448800', '#004488'], // Dark
  ];

  for (const base of baseColors) {
    const colors: string[] = ['#000000']; // Index 0 is always transparent
    for (let i = 1; i < 16; i++) {
      colors.push(base[i % base.length]);
    }
    palettes.push({ colors });
  }

  return palettes;
}

export function WebGLTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<TestStats>({
    webgl2Supported: false,
    initialized: false,
    tileCount: 0,
    renderTimeMs: 0,
    error: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check WebGL2 support
    const supported = isWebGL2Supported(canvas);
    if (!supported) {
      setStats(s => ({ ...s, webgl2Supported: false, error: 'WebGL2 not supported' }));
      return;
    }

    setStats(s => ({ ...s, webgl2Supported: true }));

    // Initialize WebGL
    const glContext = new WebGLContext(canvas);
    if (!glContext.initialize()) {
      setStats(s => ({ ...s, error: 'Failed to initialize WebGL context' }));
      return;
    }

    try {
      // Create tile renderer
      const tileRenderer = new WebGLTileRenderer(glContext);
      tileRenderer.initialize();

      // Upload test tileset (128x512 = 16 tiles wide, 64 tiles tall)
      const tilesetWidth = 128;
      const tilesetHeight = 512;
      const testTileset = createTestTileset(tilesetWidth, tilesetHeight);
      tileRenderer.uploadTileset('primary', testTileset, tilesetWidth, tilesetHeight);
      tileRenderer.uploadTileset('secondary', testTileset, tilesetWidth, tilesetHeight);

      // Upload test palettes
      const testPalettes = createTestPalettes();
      tileRenderer.uploadPalettes(testPalettes);

      // Create test tiles (20x15 grid of 8x8 tiles)
      const tilesWide = 20;
      const tilesHigh = 15;
      const testTiles = createTestTiles(tilesWide, tilesHigh);

      // Set canvas size
      canvas.width = tilesWide * 8;
      canvas.height = tilesHigh * 8;

      setStats(s => ({ ...s, initialized: true, tileCount: testTiles.length }));

      // Render loop
      let frameCount = 0;
      let animationId: number;

      const render = () => {
        const startTime = performance.now();

        // Clear
        glContext.clear(0.2, 0.2, 0.2, 1);

        // Render tiles
        tileRenderer.render(
          testTiles,
          { width: canvas.width, height: canvas.height },
          { x: 0, y: 0 }
        );

        const renderTime = performance.now() - startTime;

        // Update stats every 30 frames
        frameCount++;
        if (frameCount >= 30) {
          setStats(s => ({
            ...s,
            renderTimeMs: renderTime,
          }));
          frameCount = 0;
        }

        animationId = requestAnimationFrame(render);
      };

      render();

      // Cleanup
      return () => {
        cancelAnimationFrame(animationId);
        tileRenderer.dispose();
        glContext.dispose();
      };
    } catch (error) {
      setStats(s => ({
        ...s,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      padding: 10,
      borderRadius: 8,
      color: 'white',
      fontFamily: 'monospace',
      fontSize: 12,
      zIndex: 9999,
    }}>
      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>WebGL Test</div>

      <canvas
        ref={canvasRef}
        style={{
          border: '1px solid #444',
          imageRendering: 'pixelated',
          width: 160,
          height: 120,
        }}
      />

      <div style={{ marginTop: 8 }}>
        <div>WebGL2: {stats.webgl2Supported ? '✅' : '❌'}</div>
        <div>Init: {stats.initialized ? '✅' : '❌'}</div>
        <div>Tiles: {stats.tileCount}</div>
        <div>Render: {stats.renderTimeMs.toFixed(2)}ms</div>
        {stats.error && (
          <div style={{ color: '#ff6666' }}>Error: {stats.error}</div>
        )}
      </div>
    </div>
  );
}

export default WebGLTest;

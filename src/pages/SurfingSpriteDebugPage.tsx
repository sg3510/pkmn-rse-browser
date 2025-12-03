/**
 * SurfingSpriteDebugPage - Debug page for surfing sprites
 *
 * Uses the ACTUAL WebGLSpriteRenderer from the game to reproduce any corruption.
 * Shows all sprite states: idle, mount, dismount animations in all 4 directions.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import type { SpriteInstance, WorldCameraView } from '../rendering/types';

// Sprite sheet info
const SURF_BLOB_URL = '/pokeemerald/graphics/field_effects/pics/surf_blob.png';
const SURFING_SPRITE_URL = '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png';
const SHADOW_URL = '/pokeemerald/graphics/field_effects/pics/shadow_medium.png';

const FRAME_SIZE = 32;
const SHADOW_WIDTH = 16;
const SHADOW_HEIGHT = 8;

// Directions
const DIRECTIONS = ['down', 'up', 'left', 'right'] as const;
type Direction = (typeof DIRECTIONS)[number];

// Blob frame mapping
const BLOB_FRAME_MAP: Record<Direction, { atlasX: number; flip: boolean }> = {
  down: { atlasX: 0, flip: false },
  up: { atlasX: 0, flip: false },
  left: { atlasX: 32, flip: false },
  right: { atlasX: 32, flip: true },
};

// Surfing sprite idle frames: 0=down, 2=up, 4=left/right
const SURFING_IDLE_MAP: Record<Direction, { atlasX: number; flip: boolean }> = {
  down: { atlasX: 0, flip: false },
  up: { atlasX: 64, flip: false },
  left: { atlasX: 128, flip: false },
  right: { atlasX: 128, flip: true },
};

// Surfing sprite walk/jump frames: 1=down, 3=up, 5=left/right
const SURFING_WALK_MAP: Record<Direction, { atlasX: number; flip: boolean }> = {
  down: { atlasX: 32, flip: false },
  up: { atlasX: 96, flip: false },
  left: { atlasX: 160, flip: false },
  right: { atlasX: 160, flip: true },
};

// GBA jump Y offset table (from types.ts JUMP_Y_HIGH)
const JUMP_Y_HIGH = [-4, -6, -8, -10, -11, -12, -12, -12, -11, -10, -9, -8, -6, -4, 0, 0];

async function loadImage(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Remove background color (top-left pixel)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface DebugInfo {
  blobSize: string;
  surfingSize: string;
  webglInfo: string;
}

export function SurfingSpriteDebugPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLSpriteRenderer | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [bobOffset, setBobOffset] = useState(0);
  const [jumpFrame, setJumpFrame] = useState(0);
  const [animFrame, setAnimFrame] = useState(0);
  const spritesRef = useRef<{
    blobCanvas: HTMLCanvasElement;
    surfingCanvas: HTMLCanvasElement;
    shadowCanvas: HTMLCanvasElement;
  } | null>(null);

  // Animation loop
  useEffect(() => {
    let bobAccum = 0;
    let reverseAccum = 0;
    let velocity = -1;
    let offset = 0;
    let jumpFrameAccum = 0;
    let currentJumpFrame = 0;

    const BOB_INTERVAL = 66.67;
    const REVERSE_INTERVAL = 266.67;
    const JUMP_FRAME_INTERVAL = 33.33; // ~30fps for jump animation

    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      // Bob animation
      bobAccum += delta;
      reverseAccum += delta;
      while (bobAccum >= BOB_INTERVAL) {
        bobAccum -= BOB_INTERVAL;
        offset += velocity;
      }
      while (reverseAccum >= REVERSE_INTERVAL) {
        reverseAccum -= REVERSE_INTERVAL;
        velocity = -velocity;
      }

      // Jump frame animation (loops 0-31)
      jumpFrameAccum += delta;
      while (jumpFrameAccum >= JUMP_FRAME_INTERVAL) {
        jumpFrameAccum -= JUMP_FRAME_INTERVAL;
        currentJumpFrame = (currentJumpFrame + 1) % 32;
      }

      setBobOffset(offset);
      setJumpFrame(currentJumpFrame);
      setAnimFrame((f) => f + 1);
      requestAnimationFrame(animate);
    };

    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const canvas2d = canvas2dRef.current;
    const renderer = rendererRef.current;
    const sprites = spritesRef.current;
    const gl = glRef.current;

    if (!canvas || !canvas2d || !renderer || !sprites || !gl) return;

    const ctx2d = canvas2d.getContext('2d');
    if (!ctx2d) return;

    // Clear and draw checkerboard
    ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
    const checkerSize = 8;
    for (let cy = 0; cy < canvas2d.height; cy += checkerSize) {
      for (let cx = 0; cx < canvas2d.width; cx += checkerSize) {
        ctx2d.fillStyle = ((cx / checkerSize) + (cy / checkerSize)) % 2 === 0 ? '#444' : '#333';
        ctx2d.fillRect(cx, cy, checkerSize, checkerSize);
      }
    }

    ctx2d.fillStyle = '#fff';
    ctx2d.font = 'bold 12px monospace';

    const scale = 2;
    const spriteW = FRAME_SIZE * scale;
    const spriteH = FRAME_SIZE * scale;
    const colWidth = spriteW + 15;

    // Camera view
    const view: WorldCameraView = {
      cameraX: 0, cameraY: 0,
      startTileX: 0, startTileY: 0,
      subTileOffsetX: 0, subTileOffsetY: 0,
      tilesWide: Math.ceil(canvas.width / 16),
      tilesHigh: Math.ceil(canvas.height / 16),
      pixelWidth: canvas.width, pixelHeight: canvas.height,
      worldStartTileX: 0, worldStartTileY: 0,
      cameraWorldX: 0, cameraWorldY: 0,
    };

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const allSprites: SpriteInstance[] = [];
    let sortKey = 0;

    const addSprite = (
      atlasName: string,
      atlasX: number,
      worldX: number,
      worldY: number,
      flip: boolean,
      width?: number,
      height?: number,
      atlasWidth?: number,
      atlasHeight?: number
    ) => {
      allSprites.push({
        worldX, worldY,
        width: width ?? spriteW, height: height ?? spriteH,
        atlasName,
        atlasX, atlasY: 0,
        atlasWidth: atlasWidth ?? FRAME_SIZE, atlasHeight: atlasHeight ?? FRAME_SIZE,
        flipX: flip, flipY: false,
        alpha: 1.0, tintR: 1.0, tintG: 1.0, tintB: 1.0,
        sortKey: sortKey++,
        isReflection: false,
      });
    };

    const addShadow = (worldX: number, worldY: number) => {
      // Shadow is 16x8, positioned below player feet
      const shadowW = SHADOW_WIDTH * scale;
      const shadowH = SHADOW_HEIGHT * scale;
      // Center shadow under 32px sprite, offset down by ~28px (scaled)
      const shadowX = worldX + (spriteW - shadowW) / 2;
      const shadowY = worldY + 28 * scale;
      addSprite('shadow', 0, shadowX, shadowY, false, shadowW, shadowH, SHADOW_WIDTH, SHADOW_HEIGHT);
    };

    // Jump Y offset for current frame
    const jumpYIndex = Math.min(15, jumpFrame >> 1);
    const jumpYOffset = JUMP_Y_HIGH[jumpYIndex] * scale;
    // Jump X progress (0 to 16px over 32 frames)
    const jumpXProgress = Math.floor((jumpFrame / 32) * 16) * scale;

    let y = 10;
    const leftMargin = 15;
    const rowGap = 20;

    // === ROW 1: Raw blob sprite sheet ===
    ctx2d.fillText('RAW BLOB (96x32) - 3 frames:', leftMargin, y + 12);
    let x = leftMargin + 200;
    const blobLabels = ['0: D/U', '1: L', '2: ?'];
    for (let i = 0; i < 3; i++) {
      ctx2d.font = '9px monospace';
      ctx2d.fillStyle = '#888';
      ctx2d.fillText(blobLabels[i], x + 12, y + 5);
      addSprite('surf-blob', i * FRAME_SIZE, x, y + 8, false);
      x += spriteW + 20;
    }
    ctx2d.fillStyle = '#fff';
    ctx2d.font = 'bold 12px monospace';
    y += spriteH + rowGap + 5;

    // === ROW 2: Raw surfing sprite sheet ===
    ctx2d.fillText('RAW SURFING (192x32) - 6 frames:', leftMargin, y + 12);
    x = leftMargin + 220;
    const surfLabels = ['0: D', '1: D-w', '2: U', '3: U-w', '4: L', '5: L-w'];
    for (let i = 0; i < 6; i++) {
      ctx2d.font = '9px monospace';
      ctx2d.fillStyle = '#888';
      ctx2d.fillText(surfLabels[i], x + 8, y + 5);
      addSprite('player-surfing', i * FRAME_SIZE, x, y + 8, false);
      x += spriteW + 15;
    }
    ctx2d.fillStyle = '#fff';
    ctx2d.font = 'bold 12px monospace';
    y += spriteH + rowGap + 10;

    // === ROW 3: Direction labels ===
    ctx2d.font = '10px monospace';
    ctx2d.fillStyle = '#888';
    x = leftMargin + 60;
    for (const dir of DIRECTIONS) {
      ctx2d.fillText(dir.toUpperCase(), x + spriteW / 2 - 12, y);
      x += colWidth;
    }
    ctx2d.fillText('|', x + 5, y);
    x += 50;
    for (const dir of DIRECTIONS) {
      ctx2d.fillText(dir.toUpperCase(), x + spriteW / 2 - 12, y);
      x += colWidth;
    }
    y += 15;
    ctx2d.fillStyle = '#fff';
    ctx2d.font = 'bold 12px monospace';

    // === ROW 4: Blob + Idle surfing by direction ===
    ctx2d.fillText('BLOB:', leftMargin, y + spriteH / 2);
    x = leftMargin + 60;
    for (const dir of DIRECTIONS) {
      const { atlasX, flip } = BLOB_FRAME_MAP[dir];
      addSprite('surf-blob', atlasX, x, y, flip);
      x += colWidth;
    }
    ctx2d.fillText('IDLE:', x + 10, y + spriteH / 2);
    x += 50;
    for (const dir of DIRECTIONS) {
      const { atlasX, flip } = SURFING_IDLE_MAP[dir];
      addSprite('player-surfing', atlasX, x, y, flip);
      x += colWidth;
    }
    y += spriteH + rowGap;

    // === ROW 5: Walk/Jump frames ===
    ctx2d.fillText('WALK:', leftMargin, y + spriteH / 2);
    x = leftMargin + 60;
    for (const dir of DIRECTIONS) {
      const { atlasX, flip } = SURFING_WALK_MAP[dir];
      addSprite('player-surfing', atlasX, x, y, flip);
      x += colWidth;
    }
    y += spriteH + rowGap + 5;

    // === ROW 6: SURFING IDLE (combined, bobbing) ===
    ctx2d.fillText(`SURFING (bob: ${bobOffset}px):`, leftMargin, y + 15);
    x = leftMargin + 180;
    for (const dir of DIRECTIONS) {
      const blob = BLOB_FRAME_MAP[dir];
      const surf = SURFING_IDLE_MAP[dir];
      // Blob behind with bob
      addSprite('surf-blob', blob.atlasX, x, y + 8 * scale + bobOffset * scale, blob.flip);
      // Player with bob
      addSprite('player-surfing', surf.atlasX, x, y + bobOffset * scale, surf.flip);
      x += colWidth + 15;
    }
    y += spriteH + rowGap + 15;

    // === ROW 7: MOUNT animation (jump onto blob) with shadow ===
    ctx2d.fillText(`MOUNT (f${jumpFrame}):`, leftMargin, y + 20);
    x = leftMargin + 120;
    for (const dir of DIRECTIONS) {
      const blob = BLOB_FRAME_MAP[dir];
      const surf = SURFING_WALK_MAP[dir]; // Walk frame during jump

      // Calculate direction offset
      let dx = 0, dy = 0;
      if (dir === 'down') dy = 1;
      else if (dir === 'up') dy = -1;
      else if (dir === 'left') dx = -1;
      else if (dir === 'right') dx = 1;

      // Blob at destination (stationary, no bob during mount)
      const blobX = x + dx * 16 * scale;
      const blobY = y + dy * 16 * scale + 8 * scale;
      addSprite('surf-blob', blob.atlasX, blobX, blobY, blob.flip);

      // Player jumping from start toward blob
      const playerX = x + dx * jumpXProgress;
      const playerY = y + dy * jumpXProgress + jumpYOffset;

      // Shadow stays on ground (no Y offset from jump)
      addShadow(x + dx * jumpXProgress, y + dy * jumpXProgress);
      addSprite('player-surfing', surf.atlasX, playerX, playerY, surf.flip);

      x += colWidth + 50;
    }
    y += spriteH + rowGap + 45;

    // === ROW 8: DISMOUNT animation (jump off blob) with shadow ===
    ctx2d.fillText(`DISMOUNT (f${jumpFrame}):`, leftMargin, y + 20);
    x = leftMargin + 120;
    for (const dir of DIRECTIONS) {
      const blob = BLOB_FRAME_MAP[dir];
      const surf = SURFING_WALK_MAP[dir];

      let dx = 0, dy = 0;
      if (dir === 'down') dy = 1;
      else if (dir === 'up') dy = -1;
      else if (dir === 'left') dx = -1;
      else if (dir === 'right') dx = 1;

      // Blob stays at start position (with bob during dismount)
      addSprite('surf-blob', blob.atlasX, x, y + 8 * scale + bobOffset * scale, blob.flip);

      // Player jumping away from blob
      const playerX = x + dx * jumpXProgress;
      const playerY = y + dy * jumpXProgress + jumpYOffset;

      // Shadow at landing position (no Y offset from jump)
      addShadow(x + dx * jumpXProgress, y + dy * jumpXProgress);
      addSprite('player-surfing', surf.atlasX, playerX, playerY, surf.flip);

      x += colWidth + 50;
    }

    // Render all
    renderer.renderBatch(allSprites, view);
    ctx2d.drawImage(canvas, 0, 0);

    // Draw jump Y offset graph (bottom right)
    const graphX = 700;
    const graphY = 680;
    ctx2d.fillStyle = '#222';
    ctx2d.fillRect(graphX, graphY, 160, 80);
    ctx2d.strokeStyle = '#666';
    ctx2d.strokeRect(graphX, graphY, 160, 80);

    ctx2d.fillStyle = '#888';
    ctx2d.font = '10px monospace';
    ctx2d.fillText('Jump Y Offset', graphX + 5, graphY + 12);
    ctx2d.fillText('0', graphX - 8, graphY + 40);
    ctx2d.fillText('-12', graphX - 20, graphY + 15);

    ctx2d.strokeStyle = '#4a4';
    ctx2d.beginPath();
    for (let i = 0; i < 16; i++) {
      const gx = graphX + 10 + i * 9;
      const gy = graphY + 40 + JUMP_Y_HIGH[i] * 2.5;
      if (i === 0) ctx2d.moveTo(gx, gy);
      else ctx2d.lineTo(gx, gy);
    }
    ctx2d.stroke();

    // Current frame marker
    const markerX = graphX + 10 + jumpYIndex * 9;
    const markerY = graphY + 40 + JUMP_Y_HIGH[jumpYIndex] * 2.5;
    ctx2d.fillStyle = '#f55';
    ctx2d.beginPath();
    ctx2d.arc(markerX, markerY, 4, 0, Math.PI * 2);
    ctx2d.fill();

  }, [bobOffset, jumpFrame]);

  useEffect(() => {
    render();
  }, [render, animFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const canvas2d = canvas2dRef.current;
    if (!canvas || !canvas2d) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      setError('WebGL2 not supported');
      return;
    }

    const init = async () => {
      try {
        glRef.current = gl;
        const renderer = new WebGLSpriteRenderer(gl);
        renderer.initialize();
        rendererRef.current = renderer;

        const [blobCanvas, surfingCanvas, shadowCanvas] = await Promise.all([
          loadImage(SURF_BLOB_URL),
          loadImage(SURFING_SPRITE_URL),
          loadImage(SHADOW_URL),
        ]);

        spritesRef.current = { blobCanvas, surfingCanvas, shadowCanvas };

        renderer.uploadSpriteSheet('surf-blob', blobCanvas, { frameWidth: 32, frameHeight: 32 });
        renderer.uploadSpriteSheet('player-surfing', surfingCanvas, { frameWidth: 32, frameHeight: 32 });
        renderer.uploadSpriteSheet('shadow', shadowCanvas, { frameWidth: SHADOW_WIDTH, frameHeight: SHADOW_HEIGHT });

        setDebugInfo({
          blobSize: `${blobCanvas.width}x${blobCanvas.height}`,
          surfingSize: `${surfingCanvas.width}x${surfingCanvas.height}`,
          webglInfo: `${gl.getParameter(gl.RENDERER)}`,
        });

        setLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    init();
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  return (
    <div style={{ backgroundColor: '#1a1a2e', minHeight: '100vh', padding: 15, color: '#fff', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18 }}>Surfing Sprite Debug (WebGLSpriteRenderer)</h1>
          <p style={{ margin: '5px 0 0', color: '#888', fontSize: 11 }}>
            Uses actual game renderer - if corruption appears here, it will appear in game
          </p>
        </div>
        {debugInfo && (
          <div style={{ fontSize: 10, color: '#888', textAlign: 'right' }}>
            <div>blob: {debugInfo.blobSize} | surfing: {debugInfo.surfingSize}</div>
            <div>{debugInfo.webglInfo}</div>
          </div>
        )}
      </div>

      {error && <div style={{ color: '#ff6b6b', marginBottom: 10 }}>Error: {error}</div>}

      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <canvas ref={canvasRef} width={900} height={780} style={{ display: 'none' }} />
          <canvas ref={canvas2dRef} width={900} height={780} style={{ border: '1px solid #444' }} />
        </div>

        <div style={{ width: 280, fontSize: 11, lineHeight: 1.5 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Potential Corruption Causes</h3>
          <div style={{ color: '#aaa' }}>
            <p><strong>1. Texture bleeding:</strong> UV coords sample adjacent frames at boundaries</p>
            <p><strong>2. Wrong frame size:</strong> Upload uses 32x32 but render uses different</p>
            <p><strong>3. Premultiplied alpha:</strong> Canvas2D/WebGL mismatch causes edge artifacts</p>
            <p><strong>4. Non-integer positions:</strong> Subpixel coords + filtering = blur</p>
            <p><strong>5. Float UV precision:</strong> Rounding errors cause 1px shifts</p>
          </div>

          <h3 style={{ margin: '15px 0 8px', fontSize: 13 }}>Frame Info</h3>
          <div style={{ color: '#aaa' }}>
            <p><strong>Blob:</strong> 3 frames (96x32). 0=down/up, 1=left, 1-flip=right</p>
            <p><strong>Surfing:</strong> 6 frames (192x32). Even=idle, Odd=walk/jump</p>
            <p><strong>Mount:</strong> Player uses walk frame, jumps TO blob (no bob)</p>
            <p><strong>Dismount:</strong> Player uses walk frame, jumps FROM blob (blob bobs)</p>
            <p><strong>Jump arc:</strong> 32 frames, Y peaks at -12px around frame 12</p>
          </div>
        </div>
      </div>

      {!loaded && !error && <div style={{ marginTop: 10 }}>Loading...</div>}
    </div>
  );
}

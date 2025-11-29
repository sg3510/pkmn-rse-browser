# Quick Start: First Refactoring Steps

## Recommended Starting Point: Phase 1 - Extract Debug Panels

This is the lowest-risk change with immediate benefit.

### Step 1: Create Debug Panel Components

```bash
mkdir -p src/components/debug
```

### Step 2: Create TileDebugPanel.tsx

```tsx
// src/components/debug/TileDebugPanel.tsx
import type { DebugTileInfo } from '../map/types';

interface TileDebugPanelProps {
  tile: DebugTileInfo | null;
}

export function TileDebugPanel({ tile }: TileDebugPanelProps) {
  if (!tile) return null;

  return (
    <div style={{ marginTop: 12, padding: 8, background: '#1a1f2d', borderRadius: 4, fontSize: 11 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#88f' }}>Tile Debug</div>
      <div><strong>Position:</strong> ({tile.tileX}, {tile.tileY})</div>
      <div><strong>Metatile ID:</strong> {tile.metatileId} {tile.metatileId >= 512 ? '(secondary)' : '(primary)'}</div>
      <div><strong>Tile Elev:</strong> {tile.tileElevation}</div>
      <div><strong>Player Elev:</strong> {tile.playerElevation}</div>
      <div><strong>Collision:</strong> {tile.collision}</div>
      <div><strong>Layer Type:</strong> {tile.layerType} {
        tile.layerType === 0 ? '(NORMAL - top in front)' :
        tile.layerType === 1 ? '(COVERED - top in bg)' :
        tile.layerType === 2 ? '(SPLIT)' : ''
      }</div>
      <div><strong>Behavior:</strong> 0x{tile.behavior.toString(16).toUpperCase()}</div>
      <div style={{ marginTop: 4, color: tile.tileElevation === tile.playerElevation ? '#8f8' : '#f88' }}>
        {tile.tileElevation === tile.playerElevation ? '✓ Same elevation' : '✗ Different elevation'}
      </div>
    </div>
  );
}
```

### Step 3: Create Index File

```tsx
// src/components/debug/index.ts
export { TileDebugPanel } from './TileDebugPanel';
export { MapStitchingDebugPanel } from './MapStitchingDebugPanel';
export { WarpDebugPanel } from './WarpDebugPanel';
```

### Step 4: Update WebGLMapPage.tsx

```tsx
// At top of file, add import:
import { TileDebugPanel, MapStitchingDebugPanel, WarpDebugPanel } from '../components/debug';

// Replace inline JSX (around line 2068-2147) with:
<TileDebugPanel tile={debugTile} />
<MapStitchingDebugPanel info={mapDebugInfo} />
<WarpDebugPanel info={warpDebugInfo} />
```

---

## Next Quick Win: CameraController

### Create the Class

```typescript
// src/game/CameraController.ts
import { METATILE_SIZE } from '../utils/mapLoader';
import type { ViewportConfig } from '../config/viewport';
import type { PlayerController } from './PlayerController';

interface WorldBounds {
  width: number;
  height: number;
  minX: number;
  minY: number;
}

export interface CameraView {
  x: number;
  y: number;
  startTileX: number;
  startTileY: number;
  subTileOffsetX: number;
  subTileOffsetY: number;
}

export class CameraController {
  private x: number = 0;
  private y: number = 0;

  /**
   * Update camera to follow player, clamped to world bounds
   */
  followPlayer(
    player: PlayerController,
    worldBounds: WorldBounds,
    viewportWidth: number,
    viewportHeight: number
  ): void {
    const worldMinX = worldBounds.minX * METATILE_SIZE;
    const worldMinY = worldBounds.minY * METATILE_SIZE;

    // Center camera on player
    let targetX = player.x - viewportWidth / 2 + 8;
    let targetY = player.y - viewportHeight / 2 + 8;

    // Clamp to world bounds
    targetX = Math.max(worldMinX, Math.min(targetX, worldMinX + worldBounds.width - viewportWidth));
    targetY = Math.max(worldMinY, Math.min(targetY, worldMinY + worldBounds.height - viewportHeight));

    this.x = targetX;
    this.y = targetY;
  }

  /**
   * Get current camera view for rendering
   */
  getView(tilesWide: number, tilesHigh: number): CameraView {
    const startTileX = Math.floor(this.x / METATILE_SIZE);
    const startTileY = Math.floor(this.y / METATILE_SIZE);

    return {
      x: this.x,
      y: this.y,
      startTileX,
      startTileY,
      subTileOffsetX: this.x - startTileX * METATILE_SIZE,
      subTileOffsetY: this.y - startTileY * METATILE_SIZE,
    };
  }

  /**
   * Adjust camera position (for world re-anchoring)
   */
  adjustOffset(dx: number, dy: number): void {
    this.x -= dx * METATILE_SIZE;
    this.y -= dy * METATILE_SIZE;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
```

### Use in WebGLMapPage

```typescript
// Add ref
const cameraRef = useRef<CameraController>(new CameraController());

// In render loop, replace:
// OLD:
const cameraX = ... // 40 lines of camera logic

// NEW:
camera.followPlayer(player, worldBoundsRef.current, viewportWidth, viewportHeight);
const cameraView = camera.getView(VIEWPORT_TILES_WIDE + 1, VIEWPORT_TILES_HIGH + 1);
```

---

## Validation Checklist

After each phase, verify:

- [ ] Player movement works normally
- [ ] Warping between maps works
- [ ] Door animations play correctly
- [ ] Debug panels show correct info
- [ ] No console errors
- [ ] FPS remains stable (~60)
- [ ] Memory usage stable (no leaks)

---

## Files Reference

After Phase 1 completion:

```
src/
├── components/
│   └── debug/
│       ├── index.ts           (NEW)
│       ├── TileDebugPanel.tsx (NEW)
│       ├── MapStitchingDebugPanel.tsx (NEW)
│       └── WarpDebugPanel.tsx (NEW)
└── pages/
    └── WebGLMapPage.tsx       (MODIFIED: -150 lines)
```

After Phase 2 completion:

```
src/
├── game/
│   └── CameraController.ts    (NEW)
└── pages/
    └── WebGLMapPage.tsx       (MODIFIED: -40 more lines)
```

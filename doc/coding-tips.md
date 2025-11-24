# GBA to React Coding Tips

Quick reference for implementing GBA Pokemon mechanics in React/Canvas.

---

## Sprite Transparency

GBA sprites use a **background color key** (typically top-left pixel) instead of alpha channel.

### Implementation Pattern
```typescript
// Load image, then process for transparency
const canvas = document.createElement('canvas');
canvas.width = img.width;
canvas.height = img.height;
const ctx = canvas.getContext('2d')!;
ctx.drawImage(img, 0, 0);

const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data;

// Top-left pixel is the background color
const bgR = data[0], bgG = data[1], bgB = data[2];

// Replace all matching pixels with transparent
for (let i = 0; i < data.length; i += 4) {
  if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
    data[i + 3] = 0; // Set alpha to 0
  }
}

ctx.putImageData(imageData, 0, 0);
// Use canvas as sprite source (not original img)
```

### Key Points
- Always use `HTMLCanvasElement` as sprite type after processing, not `HTMLImageElement`
- Background color is exact RGB match - no tolerance
- Common BG colors: cyan `(0, 255, 255)`, magenta `(255, 0, 255)`, green `(0, 255, 0)`

---

## GBA Sprite Positioning (Center-Based System)

GBA sprites use **center-based coordinates**, React/Canvas uses **top-left**.

### GBA Coordinate System
```
sprite.x, sprite.y = CENTER of sprite
centerToCornerVec = offset from center to top-left

Final render position (top-left) = (sprite.x + centerToCornerVecX, sprite.y + centerToCornerVecY)
```

### centerToCornerVec Table (from sprite.c)
| Shape | Size | Dimensions | centerToCornerVec |
|-------|------|------------|-------------------|
| Square | 0 | 8x8 | (-4, -4) |
| Square | 1 | 16x16 | (-8, -8) |
| Square | 2 | 32x32 | (-16, -16) |
| Square | 3 | 64x64 | (-32, -32) |
| H-Rect | 0 | 16x8 | (-8, -4) |
| H-Rect | 1 | 32x8 | (-16, -4) |
| H-Rect | 2 | 32x16 | (-16, -8) |
| H-Rect | 3 | 64x32 | (-32, -16) |
| V-Rect | 0 | 8x16 | (-4, -8) |
| V-Rect | 1 | 8x32 | (-4, -16) |
| V-Rect | 2 | 16x32 | (-8, -16) |
| V-Rect | 3 | 32x64 | (-16, -32) |

### Common Sprites
- **Player walking** (16x32): centerToCornerVec = (-8, -16)
- **Player surfing** (32x32): centerToCornerVec = (-16, -16)
- **Surf blob** (32x32): centerToCornerVec = (-16, -16)

### Conversion Formula: GBA Center to React Top-Left

```typescript
// Given GBA center coordinates (gbaCenterX, gbaCenterY) and sprite dimensions:
const reactTopLeftX = gbaCenterX - (spriteWidth / 2);
const reactTopLeftY = gbaCenterY - (spriteHeight / 2);
```

### Positioning Relative Sprites (e.g., Surf Blob under Player)

**GBA code pattern:**
```c
// From field_effect_helpers.c
sprite->x = playerSprite->x;      // Blob center X = Player center X
sprite->y = playerSprite->y + 8;  // Blob center Y = Player center Y + 8
```

**React equivalent:**
```typescript
// player.x, player.y = top-left of player sprite in React
// Player sprite is 16x32 (or 32x32 for surfing)

// Player center in React coords:
const playerCenterX = player.x + (playerWidth / 2);
const playerCenterY = player.y + (playerHeight / 2);

// Blob center (from GBA logic):
const blobCenterX = playerCenterX;           // Same X
const blobCenterY = playerCenterY + 8;       // 8px below

// Convert blob center to React top-left:
const blobTopLeftX = blobCenterX - (blobWidth / 2);
const blobTopLeftY = blobCenterY - (blobHeight / 2);

// Simplified for 32x32 blob under 16x32 player:
const blobX = player.x - 8;   // Center 32px blob under 16px player
const blobY = player.y + 8;   // 8px offset from GBA, accounts for center conversion
```

---

## Player Y Positioning

Player sprites are positioned so **feet align with tile bottom**.

```typescript
// Tile position to pixel position
// player.y positions the TOP of the sprite
this.y = tileY * TILE_SIZE - (spriteHeight - TILE_SIZE);

// For 32px tall sprite on 16px tiles:
this.y = tileY * 16 - 16;

// Result: sprite top is 16px above tile top
// Feet (sprite bottom) are at tile bottom
```

### Verification
```
Tile Y=5: tile spans pixels 80-96 (top to bottom)
player.y = 5*16 - 16 = 64
Sprite renders: Y=64 to Y=96
Feet at Y=96 = tile bottom ✓
```

---

## Movement Speeds (from event_object_movement.c)

```c
enum {
    MOVE_SPEED_NORMAL,  // 0: walking
    MOVE_SPEED_FAST_1,  // 1: running / surfing / sliding (ice)
    MOVE_SPEED_FAST_2,  // 2: water current / acro bike
    MOVE_SPEED_FASTER,  // 3: mach bike max speed
    MOVE_SPEED_FASTEST, // 4: unused
};
```

### React Speed Values (pixels per millisecond)
```typescript
const WALK_SPEED = 0.06;    // MOVE_SPEED_NORMAL
const RUN_SPEED = 0.12;     // MOVE_SPEED_FAST_1 (also surfing)
const BIKE_SPEED = 0.18;    // MOVE_SPEED_FAST_2
const MACH_SPEED = 0.24;    // MOVE_SPEED_FASTER
```

---

## Quick Reference: Common Offsets

| Scenario | X Offset | Y Offset | Notes |
|----------|----------|----------|-------|
| 32px sprite centered on 16px position | -8 | 0 | (32-16)/2 |
| Surf blob below player | 0 | +8 | GBA: playerSprite.y + 8 |
| Player feet to tile bottom | 0 | -16 | For 32px sprite on 16px tile |
| Reflection below sprite | 0 | +height | Flip vertically |

---

## File References

- **Sprite system**: `public/pokeemerald/src/sprite.c` (centerToCornerVec table at line 137)
- **Surf blob**: `public/pokeemerald/src/field_effect_helpers.c` (UpdateSurfBlobFieldEffect at line 1052)
- **Movement speeds**: `public/pokeemerald/src/event_object_movement.c` (enum at line 46)
- **Field effects**: `public/pokeemerald/src/field_effect.c`

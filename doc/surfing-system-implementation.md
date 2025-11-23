# Surfing System Implementation Plan

## Overview

This document outlines the implementation of surfing mechanics for the Pokemon RSE browser viewer. The system allows players to traverse water tiles using a surfing Pokemon (Lapras placeholder).

---

## 1. Research Summary: Pokeemerald Surfing System

### 1.1 Water Tile Behaviors

**Source:** `pokeemerald/include/constants/metatile_behaviors.h`

| Behavior | Value | Surfable | Fishable | Notes |
|----------|-------|----------|----------|-------|
| MB_POND_WATER | 0x10 | Yes | Yes | Small ponds |
| MB_OCEAN_WATER | 0x11 | Yes | Yes | Ocean tiles |
| MB_DEEP_WATER | 0x80 | Yes | Yes | Deep water |
| MB_SOOTOPOLIS_DEEP_WATER | 0x81 | Yes | Yes | Special area |
| MB_WATERFALL | 0x13 | Yes | No | Requires Waterfall HM |
| MB_SHALLOW_WATER | 0x14 | **No** | No | Puddles, not surfable |
| MB_SEAWEED | 0x22 | Yes | Yes | Underwater plant |
| MB_NO_SURFACING | 0x1E | Yes | No | Prevents dismounting |

**Already defined in our codebase:** `src/utils/metatileBehaviors.ts`
```typescript
export const MB_POND_WATER = 0x10;
export const MB_OCEAN_WATER = 0x11;
export const MB_DEEP_WATER = 0x80;
export const MB_WATERFALL = 0x13;
// etc.
```

### 1.2 Starting to Surf - Dialog Trigger

**Source:** `pokeemerald/src/field_control_avatar.c:450`

**Trigger Conditions (in order):**
1. Player presses A button (or X in our case)
2. Player is facing a surfable water tile
3. Player elevation is 3 (land level)
4. Water tile creates "elevation mismatch" collision
5. *(Original game)* Badge 5 obtained + Party has Surf Pokemon
6. *(Our implementation)* Always allow (assume Lapras available)

**Dialog Flow:**
```
Player presses X facing water
       │
       ▼
┌─────────────────────────┐
│ "The water is a deep    │
│  blue color...          │
│  Would you like to      │
│  use SURF?"             │
│                         │
│        ┌─────┐          │
│        │ YES │          │
│        │ NO  │          │
│        └─────┘          │
└─────────────────────────┘
       │
       ▼ (YES selected)
┌─────────────────────────┐
│ [Lapras cry + appear]   │
│ Player jumps onto blob  │
│ Music changes to surf   │
└─────────────────────────┘
```

### 1.3 Mounting Animation Sequence

**Source:** `pokeemerald/src/field_effect.c:2985-3074`

**5-Stage Animation:**
1. **Init** - Lock controls, freeze NPCs, set SURFING flag
2. **FieldMovePose** - Player does "using HM" pose (optional for us)
3. **ShowMon** - Display Lapras with cry sound
4. **JumpOnSurfBlob** - Create surf blob, player jumps on
5. **End** - Unlock controls, player now surfing

**Simplified for our implementation:**
1. Lock input
2. Show Lapras appearing (fade in or slide up)
3. Player sprite changes to surfing variant
4. Surf blob appears under player
5. Move player onto water tile
6. Unlock input

### 1.4 Surfing State & Sprites

**Player Surfing Sprite:**
- `public/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png`
- 6 frames: Down, Down-walk, Up, Up-walk, Side, Side-walk
- 32x32 pixels per frame (larger than walking sprite)

**Surf Blob Sprite:**
- `public/pokeemerald/graphics/field_effects/pics/surf_blob.png`
- 3 frames for different directions
- Dark blue blob that appears under player
- Has bobbing animation (up/down every 4 frames)

**State Tracking:**
```typescript
interface PlayerState {
  isSurfing: boolean;
  surfBlobSpriteId?: string;
}
```

### 1.5 Collision Changes While Surfing

**Source:** `pokeemerald/src/field_player_avatar.c`

| Tile Type | Walking | Surfing |
|-----------|---------|---------|
| Land (grass, etc.) | Passable | **Blocked** (triggers dismount) |
| Surfable water | **Blocked** | Passable |
| Shallow water | Passable | **Blocked** |
| Bridge over water | Passable | Passable |
| Waterfall | Blocked | Blocked (unless using Waterfall) |

**Key Logic:**
```typescript
function canMoveToTile(targetTile, isSurfing: boolean): boolean {
  const behavior = targetTile.behavior;

  if (isSurfing) {
    // While surfing, can only move on surfable water
    if (isSurfableBehavior(behavior)) return true;
    if (isBridgeOverWater(behavior)) return true;
    // Land tiles trigger dismount instead of blocking
    return false;
  } else {
    // While walking, water is blocked
    if (isSurfableBehavior(behavior)) return false;
    return isPassable(targetTile);
  }
}
```

### 1.6 Stopping Surfing (Dismount)

**Source:** `pokeemerald/src/field_player_avatar.c:725-738`

**Trigger Conditions:**
1. Player is surfing
2. Player moves toward land tile (elevation 3)
3. Elevation mismatch detected
4. Target tile is walkable

**Dismount Animation:**
1. Surf blob changes to "just mon bobbing" mode
2. Player jumps off toward land
3. Player sprite changes back to walking
4. Surf blob fades/disappears
5. Ground effects trigger (grass rustling if applicable)

**No Dialog Required** - Dismounting is automatic

### 1.7 Waterfalls

**Source:** `pokeemerald/src/field_effect.c:1828-1897`

**Going UP Waterfall:**
- Requires: Already surfing + facing north + on waterfall tile
- Original: Requires Badge 8 + Pokemon with Waterfall
- Our implementation: Always allow if surfing

**Scripted Movement:**
```typescript
async function climbWaterfall() {
  lockInput();

  while (isOnWaterfallTile()) {
    await moveSlowNorth(); // Slower than normal movement
  }

  unlockInput();
}
```

**Going DOWN Waterfall:**
- Automatic - player moves south normally
- May add slight acceleration effect

### 1.8 Reflections While Surfing

**Key Insight:** Surfing player DOES have reflection on water, but the surf blob does NOT.

The reflection system should:
1. Render player reflection (using surfing sprite)
2. NOT render surf blob reflection
3. Handle bridge-over-water special case

### 1.9 Edge Cases

**Currents (Future):**
- MB_EASTWARD_CURRENT, MB_WESTWARD_CURRENT, etc.
- Automatically push player in direction while surfing
- Could be post-MVP feature

**Diving (Future):**
- MB_DEEP_WATER tiles can be dived on
- Requires separate underwater map system
- Definitely post-MVP

**Whirlpools (Future):**
- Spinning current that traps player
- Post-MVP feature

---

## 2. React Implementation Plan

### 2.1 New Files Structure

```
src/
├── game/
│   ├── PlayerController.ts      # Modify for surfing state
│   ├── SurfingController.ts     # NEW: Surfing-specific logic
│   └── FieldEffectManager.ts    # Extend for surf blob
├── components/
│   └── dialog/                  # Already implemented
├── sprites/
│   └── SurfBlobSprite.ts        # NEW: Surf blob rendering
└── utils/
    └── metatileBehaviors.ts     # Add surfing helper functions
```

### 2.2 Player State Extension

```typescript
// In PlayerController.ts

interface SurfingState {
  isSurfing: boolean;
  surfStartTime?: number;
  surfBlobFrame: number;
  bobOffset: number;        // Y offset for bobbing animation
}

class PlayerController {
  // Existing properties...

  private surfingState: SurfingState = {
    isSurfing: false,
    surfBlobFrame: 0,
    bobOffset: 0,
  };

  // New methods
  public isSurfing(): boolean {
    return this.surfingState.isSurfing;
  }

  public startSurfing(): void {
    this.surfingState.isSurfing = true;
    this.surfingState.surfStartTime = Date.now();
    // Change to surfing sprite
    // Create surf blob
  }

  public stopSurfing(): void {
    this.surfingState.isSurfing = false;
    // Change back to walking sprite
    // Remove surf blob
  }
}
```

### 2.3 Interaction System (A/X Button)

```typescript
// New: InteractionHandler in PlayerController or separate file

interface InteractionContext {
  playerTileX: number;
  playerTileY: number;
  facingTileX: number;
  facingTileY: number;
  facingBehavior: number;
  isSurfing: boolean;
}

async function handleInteraction(
  context: InteractionContext,
  dialog: UseDialogReturn
): Promise<void> {
  const { facingBehavior, isSurfing } = context;

  // Check for surf prompt
  if (!isSurfing && isSurfableBehavior(facingBehavior)) {
    const wantToSurf = await dialog.showYesNo(
      "The water is a deep blue...\nWould you like to SURF?"
    );

    if (wantToSurf) {
      await startSurfSequence();
    }
    return;
  }

  // Check for waterfall
  if (isSurfing && facingBehavior === MB_WATERFALL) {
    await startWaterfallClimb();
    return;
  }

  // Other interactions (signs, NPCs, etc.) - future
}
```

### 2.4 Dialog Integration

```typescript
// Using existing dialog system

const dialog = useDialog();

// Surf prompt with clickable options
const wantToSurf = await dialog.showYesNo(
  "The water is a deep blue...\nWould you like to SURF?",
  { defaultYes: true }  // YES is pre-selected
);
```

**Mouse Support for Dialogs:**
Add to `OptionMenu.tsx`:
```typescript
<div
  onClick={() => !choice.disabled && onSelect(choice)}
  onMouseEnter={() => setHoveredIndex(index)}
  // ... existing props
>
```

### 2.5 Surf Blob Sprite

```typescript
// SurfBlobSprite.ts

interface SurfBlobConfig {
  spriteSheet: HTMLImageElement;  // surf_blob.png
  frameWidth: 32;
  frameHeight: 16;
  framesPerDirection: 1;
}

const SURF_BLOB_DIRECTIONS = {
  down: 0,
  up: 0,      // Same frame, no separate up
  left: 1,
  right: 2,   // Flip of left
};

// Bobbing animation
const BOB_OFFSETS = [0, -1, -2, -1];  // 4-frame cycle
const BOB_INTERVAL = 4;  // Every 4 game frames

function getSurfBlobBobOffset(frameCount: number): number {
  const bobIndex = Math.floor(frameCount / BOB_INTERVAL) % 4;
  return BOB_OFFSETS[bobIndex];
}
```

### 2.6 Collision System Update

```typescript
// In PlayerController.ts - modify isCollisionAt()

private isCollisionAt(tileX: number, tileY: number): boolean {
  const resolved = this.tileResolver?.(tileX, tileY);
  if (!resolved) return true;

  const behavior = resolved.attributes?.behavior ?? 0;

  // SURFING COLLISION RULES
  if (this.isSurfing()) {
    // While surfing, check if target is surfable
    if (isSurfableBehavior(behavior)) {
      return false; // Can move on water
    }

    // Land tiles - check for dismount possibility
    if (this.canDismountAt(tileX, tileY)) {
      // Don't block - will trigger dismount
      return false;
    }

    // Everything else blocks while surfing
    return true;
  }

  // WALKING COLLISION RULES (existing)
  if (isSurfableBehavior(behavior)) {
    return true; // Water blocks walking
  }

  // ... rest of existing collision logic
}

private canDismountAt(tileX: number, tileY: number): boolean {
  const resolved = this.tileResolver?.(tileX, tileY);
  if (!resolved) return false;

  const elevation = resolved.mapTile.elevation;
  const behavior = resolved.attributes?.behavior ?? 0;

  // Can dismount to land (elevation 3) that isn't water
  return elevation === 3 &&
         !isSurfableBehavior(behavior) &&
         isCollisionPassable(resolved.mapTile.collision);
}
```

### 2.7 Mounting Animation Sequence

```typescript
// SurfingController.ts

async function performSurfMountSequence(
  player: PlayerController,
  targetTileX: number,
  targetTileY: number,
  dialog: UseDialogReturn
): Promise<void> {
  // 1. Lock input
  player.lockInput();

  // 2. Show Lapras appearing (placeholder animation)
  // For now: simple fade-in or immediate appear
  await showLaprasAppearing(targetTileX, targetTileY);

  // 3. Change player sprite to surfing variant
  await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
  player.setCurrentSprite('surfing');

  // 4. Create surf blob under player
  player.createSurfBlob();

  // 5. Move player onto water tile
  player.forceMove(player.dir, true); // Ignore collision for this move
  await waitForMovementComplete(player);

  // 6. Set surfing state
  player.startSurfing();

  // 7. Unlock input
  player.unlockInput();
}
```

### 2.8 Dismount Animation Sequence

```typescript
async function performSurfDismountSequence(
  player: PlayerController,
  landTileX: number,
  landTileY: number
): Promise<void> {
  // 1. Lock input
  player.lockInput();

  // 2. Surf blob stops bobbing with player
  player.setSurfBlobMode('justMon');

  // 3. Player jumps toward land
  // (Simple: just move, no actual jump arc needed initially)
  player.forceMove(player.dir, true);
  await waitForMovementComplete(player);

  // 4. Clear surfing state
  player.stopSurfing();

  // 5. Change sprite back to walking
  player.setCurrentSprite('walking');

  // 6. Remove surf blob
  player.destroySurfBlob();

  // 7. Trigger ground effects if on grass
  player.checkAndTriggerGrassEffect(landTileX, landTileY, false);

  // 8. Unlock input
  player.unlockInput();
}
```

### 2.9 Waterfall Climbing

```typescript
async function performWaterfallClimb(
  player: PlayerController
): Promise<void> {
  player.lockInput();

  // Climb until no longer on waterfall
  while (isOnWaterfallTile(player.tileX, player.tileY)) {
    // Slow movement north
    player.forceStep('up');
    await delay(200); // Slower than normal movement
  }

  player.unlockInput();
}

// Waterfall descent is automatic (normal movement south)
```

### 2.10 Rendering Order

```typescript
// In MapRenderer rendering loop

function renderFrame() {
  // 1. Background layer (terrain)
  renderBackgroundLayer();

  // 2. Reflections (including surfing player reflection)
  if (player.isSurfing()) {
    renderPlayerReflection(player, 'surfing');
    // Note: Surf blob does NOT have reflection
  }

  // 3. Water surface animations
  renderWaterAnimations();

  // 4. Surf blob (under player, bobs)
  if (player.isSurfing()) {
    renderSurfBlob(player);
  }

  // 5. Player sprite (surfing or walking)
  renderPlayer(player);

  // 6. Top layer (bridges, trees, etc.)
  renderTopLayer();
}
```

---

## 3. Implementation Phases

### Phase 1: Basic Surfing (MVP)
- [ ] Add `isSurfing` state to PlayerController
- [ ] Implement surf behavior detection helpers
- [ ] Hook up X key (and mouse click) for interaction
- [ ] Show surf dialog using existing dialog system
- [ ] Basic mount sequence (no animation, instant)
- [ ] Change collision rules when surfing
- [ ] Basic dismount (automatic when moving to land)
- [ ] Load and use surfing player sprite

### Phase 2: Surf Blob & Animation
- [ ] Load surf_blob.png sprite
- [ ] Implement bobbing animation
- [ ] Render surf blob under player
- [ ] Direction-aware surf blob frames
- [ ] Mount animation (Lapras appear)
- [ ] Dismount animation (jump off)

### Phase 3: Waterfall Support
- [ ] Detect waterfall tiles
- [ ] Implement scripted climb movement
- [ ] Add waterfall descent behavior
- [ ] Optional: Waterfall spray particle effect

### Phase 4: Polish & Edge Cases
- [ ] Reflection while surfing
- [ ] Water surface animation interaction
- [ ] Sound effects (if audio system exists)
- [ ] Bridge-over-water handling
- [ ] Current tiles (push player)

### Phase 5: Future (Post-MVP)
- [ ] Diving system
- [ ] Whirlpools
- [ ] Fishing while surfing
- [ ] Other surf Pokemon (not just Lapras)

---

## 4. Input Handling

### Keyboard
| Key | Action |
|-----|--------|
| X | Interact (trigger surf dialog when facing water) |
| Z | Confirm dialog / Advance text |
| Arrow keys | Move cursor in menu |
| Escape | Cancel / Select NO |

### Mouse (New)
| Action | Effect |
|--------|--------|
| Click on water while adjacent | Trigger surf dialog |
| Click YES/NO option | Select that option |
| Click dialog box | Advance text (same as Z) |

**Implementation for clickable options:**
```typescript
// In OptionMenu.tsx
<div
  onClick={() => {
    if (!choice.disabled) {
      onSelect(choice);
    }
  }}
  style={{ cursor: choice.disabled ? 'not-allowed' : 'pointer' }}
>
```

**Implementation for clickable dialog advance:**
```typescript
// In DialogBox.tsx
<div
  onClick={() => {
    if (state.type === 'waiting') {
      dispatch({ type: 'NEXT_MESSAGE' });
    } else if (state.type === 'printing' && config.allowSkip) {
      dispatch({ type: 'COMPLETE_TEXT' });
    }
  }}
  style={{ cursor: 'pointer' }}
>
```

---

## 5. Assets Summary

### Existing Assets (Ready to Use)
| Asset | Path | Size |
|-------|------|------|
| Brendan Surfing | `/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png` | 192x32 (6 frames) |
| May Surfing | `/pokeemerald/graphics/object_events/pics/people/may/surfing.png` | 192x32 |
| Surf Blob | `/pokeemerald/graphics/field_effects/pics/surf_blob.png` | 96x16 (3 frames) |
| Lapras Front | `/pokeemerald/graphics/pokemon/lapras/front.png` | 64x64 |

### Assets to Extract/Create
- Lapras overworld sprite (for mount animation) - can use front.png scaled down
- Water splash effect (optional)
- Waterfall climbing particles (optional)

---

## 6. Code Locations to Modify

| File | Changes |
|------|---------|
| `src/game/PlayerController.ts` | Add surfing state, collision changes, sprite switching |
| `src/components/MapRenderer.tsx` | Render surf blob, handle interaction key |
| `src/utils/metatileBehaviors.ts` | Add `isSurfableBehavior()` helper |
| `src/components/dialog/OptionMenu.tsx` | Add mouse click support |
| `src/components/dialog/DialogBox.tsx` | Add click-to-advance |

### New Files
| File | Purpose |
|------|---------|
| `src/game/SurfingController.ts` | Mount/dismount sequences |
| `src/game/InteractionHandler.ts` | Handle A/X button interactions |

---

## 7. Testing Checklist

- [ ] Press X facing water shows dialog
- [ ] Click YES starts surfing
- [ ] Click NO cancels
- [ ] Arrow keys navigate YES/NO menu
- [ ] Z confirms, Escape cancels
- [ ] Player sprite changes to surfing variant
- [ ] Surf blob appears and bobs
- [ ] Can move on water tiles while surfing
- [ ] Cannot move onto land normally (triggers dismount)
- [ ] Dismount works when moving toward land
- [ ] Player sprite changes back after dismount
- [ ] Surf blob disappears after dismount
- [ ] Waterfall blocking works
- [ ] Waterfall climb works (if facing north while surfing)
- [ ] Works at zoom 1x, 2x, 3x
- [ ] Mouse clicking options works
- [ ] Reflection shows while surfing (no blob reflection)

# Surfing System V1 - Usage Guide

## Overview

This document describes how to use the modular surfing system created for the Pokémon RSE browser viewer.

## Architecture

The surfing system is organized into modular, scalable files:

```
src/game/surfing/
├── types.ts                # Type definitions and interfaces
├── SurfingController.ts    # Core surfing state machine
├── SurfBlobRenderer.ts     # Surf blob sprite rendering with bobbing
├── InteractionHandler.ts   # Surf detection and collision checks
└── index.ts                # Barrel exports
```

## Integration Points

### 1. Metatile Behaviors

Surfing behavior helpers are now available in `src/utils/metatileBehaviors.ts`:

```typescript
import { isSurfableBehavior } from './utils/metatileBehaviors';

const canSurf = isSurfableBehavior(tileBehavior);
```

**Surfable tiles:** Pond water, ocean water, deep water, waterfall, seaweed, etc.

### 2. Dialog System (Mouse Support)

The dialog system now supports both keyboard and mouse interaction:

- **Click dialog box** → Advance/skip text
- **Click YES/NO option** → Select and confirm
- **Hover option** → Highlights selection

Usage example:
```typescript
import { useDialog } from './components/dialog';

const dialog = useDialog();

const wantToSurf = await dialog.showYesNo(
  "The water is a deep blue...\\nWould you like to SURF?"
);

if (wantToSurf) {
  // Initiate surfing
}
```

### 3. Surfing Controller

```typescript
import { SurfingController } from './game/surfing';

const surfController = new SurfingController();

// Check if can surf
const { canSurf, reason } = surfController.canInitiateSurf(
  playerX, playerY, facingDirection, tileResolver
);

// Start surfing
surfController.startSurfSequence(targetX, targetY);

// Update every frame
surfController.update();

// Check if player is surfing
if (surfController.isSurfing()) {
  // Render surf blob, change collision rules, etc.
}
```

### 4. Surf Blob Rendering

```typescript
import { SurfBlobRenderer } from './game/surfing';

const blobRenderer = new SurfBlobRenderer();

// In render loop, after reflections but before player
blobRenderer.update(); // Update bob animation
blobRenderer.render(ctx, playerX, playerY, direction);
```

## Next Steps

To complete the integration, you need to:

1. **Update PlayerController** - Add `SurfingState` class similar to `NormalState`, `RunningState`, `JumpingState`
2. **Modify collision detection** - Use `InteractionHandler.checkCanDismount()` when moving toward land
3. **Add mount/dismount animations** - Implement sprite changes and movement sequences
4. **Add X key handler** - In MapRenderer or player input handler, check for surf interaction

## Testing

Once integrated:

1. Navigate to water tiles (Route 104, Petalburg, Route 120)
2. Press X facing water → "Would you like to SURF?" dialog
3. Click YES or use arrow keys + Z
4. Player mounts surf blob and can move on water
5. Move toward land → Auto-dismount

## Assumptions

- **Lapras sprite**: Assumed available as placeholder (can be swapped later)
- **Elevation system**: Exists and is tracked (elevation 3 = land, 0 = water)
- **Tile resolver**: Available to query tile behavior and elevation
- **Reflection system**: Already implemented (surf blob won't reflect, player will)

## Future Enhancements

- Waterfall climbing (upward movement on waterfall tiles)
- Current tiles (auto-push player)
- Diving system (underwater maps)
- Other surf Pokémon (not just Lapras)
- Sound effects (Lapras cry, splash sounds)

# MapRenderer Refactor Phase 2: Modular Architecture

## The Problem

`MapRenderer.tsx` is currently **3,669 lines** - a monolithic "god component" that handles:

- React component lifecycle
- Tile rendering (3 render passes)
- Animation frame management
- Door entry/exit sequences
- Warp detection and handling
- Player controller integration
- NPC rendering
- Field effects (grass, sand, water)
- Reflections (water, ice)
- Debug overlays
- Save/load game state
- Surfing mechanics
- Arrow overlays
- Fade transitions

This violates the Single Responsibility Principle and makes the code:
- Hard to understand
- Hard to test
- Hard to modify without breaking things
- Hard to onboard new contributors

---

## The Solution: pokeemerald-inspired Modular Architecture

### Inspiration from pokeemerald C Code

pokeemerald organizes its overworld code into focused, single-purpose files:

```
src/
├── fieldmap.c           # Map layout, connections, tile lookup
├── field_effect.c       # Field effect creation/management
├── field_effect_helpers.c # Effect animation helpers
├── event_object_movement.c # NPC/player movement
├── sprite.c             # Sprite rendering
├── overworld.c          # Main overworld loop orchestration
├── metatile_behavior.c  # Tile behavior queries
└── field_screen_effect.c # Screen transitions
```

Each file is **focused** and **self-contained**.

### New TypeScript Architecture

```
src/
├── components/
│   └── MapRenderer.tsx      # THIN: ~200 lines, orchestration only
│
├── engine/                   # NEW: Core game engine (no React)
│   ├── GameLoop.ts          # Main loop, timing, state updates
│   ├── Camera.ts            # Camera position, viewport calculation
│   └── WorldState.ts        # World/map state management
│
├── rendering/               # Rendering pipeline (no game logic)
│   ├── RenderPipeline.ts    # Orchestrates 3-pass rendering
│   ├── TileRenderer.ts      # Single tile drawing
│   ├── LayerCompositor.ts   # Combines background/top layers
│   ├── TilesetCanvasCache.ts # (existing) Palettized tileset cache
│   ├── MapBackingStore.ts   # (existing) Chunk caching
│   └── ViewportBuffer.ts    # (existing) Overscan buffer
│
├── field/                   # Field effects and overlays
│   ├── FieldEffectManager.ts # (existing) Grass/sand/water effects
│   ├── DoorSequencer.ts     # Door open/close/step sequences
│   ├── WarpHandler.ts       # Warp detection and triggering
│   ├── FadeController.ts    # Screen fade in/out
│   └── ReflectionRenderer.ts # Water/ice reflections
│
├── objects/                 # Object events (NPCs, items, player)
│   ├── ObjectEventManager.ts # (existing) NPC/item tracking
│   ├── PlayerController.ts  # (existing) Player movement
│   ├── ObjectRenderer.ts    # (existing) Sprite rendering
│   └── SpriteAnimator.ts    # Animation frame management
│
├── hooks/                   # React hooks (thin wrappers)
│   ├── useGameEngine.ts     # Initialize and run game loop
│   ├── useMapAssets.ts      # (existing) Asset loading
│   └── useInput.ts          # Keyboard/gamepad input
│
└── utils/                   # Pure functions, no state
    ├── tileResolution.ts    # resolveTileAt, border tiles
    ├── elevationPriority.ts # (existing) Elevation to priority
    ├── metatileBehaviors.ts # (existing) Behavior checks
    └── camera.ts            # (existing) Camera math
```

---

## Key Design Principles

### 1. Separation of Concerns
Each file has ONE job. If you can't describe what a file does in one sentence, it's too big.

### 2. No React in Core Engine
The game engine (`engine/`, `rendering/`, `field/`) should be **pure TypeScript** with no React dependencies. This allows:
- Unit testing without DOM
- Reuse in other contexts (e.g., headless server rendering)
- Clear data flow

### 3. Small Files (< 300 lines)
Target: **150-250 lines per file**. If a file grows past 300 lines, split it.

### 4. Explicit Dependencies
No global state. Each module receives its dependencies via constructor or function parameters.

### 5. TypeScript Interfaces at Boundaries
Define clear interfaces between modules. This documents the contract and enables testing.

---

## File Size Targets

| Current File | Lines | Target | Strategy |
|--------------|-------|--------|----------|
| MapRenderer.tsx | 3669 | ~200 | Extract everything |
| FieldEffectManager.ts | 461 | 461 | Already good |
| PlayerController.ts | ~800 | ~300 | Split into movement + state |
| ObjectEventManager.ts | ~400 | ~400 | Already good |

---

## Implementation Order

See individual documents:
1. `01-render-pipeline.md` - Extract rendering logic
2. `02-game-loop.md` - Extract game loop and state
3. `03-field-effects.md` - Extract door/warp/fade
4. `04-thin-component.md` - Final MapRenderer cleanup
5. `05-testing-strategy.md` - Test each module

---

## Success Metrics

After refactor:
- [ ] MapRenderer.tsx < 250 lines
- [ ] No file > 400 lines
- [ ] Each module has clear single responsibility
- [ ] Game engine testable without browser
- [ ] No regressions in visual output

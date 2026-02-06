---
title: Game State Machine Architecture Proposal
status: reference
last_verified: 2026-01-13
---

# Game State Machine Architecture Proposal

## Core Requirement

**All game states render into the same configurable viewport canvas.**

```typescript
// src/config/viewport.ts - UNCHANGED, all states respect this
export const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  tilesWide: 20,  // Can change to 15 for GBA-native
  tilesHigh: 20,  // Can change to 10 for GBA-native
};
```

Current: 20×20 tiles × 16px = **320×320 pixels**
GBA native: 15×10 tiles × 16px = **240×160 pixels**

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      GamePage.tsx                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │           Canvas (VIEWPORT_PIXEL_SIZE)             │  │
│  │                                                    │  │
│  │   GameStateManager.currentState.render(canvas)    │  │
│  │                                                    │  │
│  │   TITLE_SCREEN | MAIN_MENU | OVERWORLD | etc.     │  │
│  └────────────────────────────────────────────────────┘  │
│                    [Zoom: 1x 2x 3x]                      │
└──────────────────────────────────────────────────────────┘
```

---

## State Types

```typescript
// src/core/GameState.ts

export enum GameState {
  TITLE_SCREEN = 'TITLE_SCREEN',
  MAIN_MENU = 'MAIN_MENU',
  OVERWORLD = 'OVERWORLD',
  // Future: BATTLE, POKEMON_MENU, BAG, etc.
}

export interface StateRenderer {
  /** Load assets, initialize state */
  enter(viewport: ViewportConfig): Promise<void>;

  /** Cleanup resources */
  exit(): Promise<void>;

  /** Logic tick */
  update(dt: number, frameCount: number): void;

  /** Render to canvas - receives viewport dimensions */
  render(ctx: CanvasRenderingContext2D, viewport: { width: number; height: number }): void;

  /** Handle input, return transition or null */
  handleInput(keys: InputState): StateTransition | null;
}
```

**Key**: Every `render()` call receives current viewport size. States adapt their rendering accordingly.

---

## State Flow (MVP)

```
Boot ──► TITLE_SCREEN ──► MAIN_MENU ──► OVERWORLD
              │
              │◄─────── B button ────────────┤
```

---

## Implementation Phases

### Phase 1: State Machine Core
- [ ] Create `src/core/GameState.ts` - enum, interfaces
- [ ] Create `src/core/GameStateManager.ts` - transitions, current state
- [ ] Modify `GamePage.tsx` to use GameStateManager
- [ ] Default boot: OVERWORLD (preserves current behavior)

### Phase 2: Title Screen
- [ ] Create `src/states/TitleScreenState.ts`
- [ ] Render to viewport (see `docs/architecture/intro/` for implementation details)
- [ ] Input: Any key → MAIN_MENU
- [ ] Change default boot to TITLE_SCREEN

### Phase 3: Main Menu
- [ ] Create `src/states/MainMenuState.ts`
- [ ] Create `src/core/SaveManager.ts` - detect existing save
- [ ] Menu: NEW GAME / CONTINUE / OPTIONS
- [ ] Transitions: NEW GAME/CONTINUE → OVERWORLD

### Phase 4: Overworld Extraction
- [ ] Extract rendering from GamePage to `src/states/OverworldState.ts`
- [ ] GamePage becomes thin state router
- [ ] Preserve all existing functionality

### Phase 5: Transitions
- [ ] Extend FadeController for state transitions
- [ ] Smooth fades between all states
- [ ] WebGL context preserved (not recreated)

### Phase 6: Save System
- [ ] Save player position, map ID, flags
- [ ] CONTINUE loads from save
- [ ] Auto-save on map transitions

---

## Viewport Adaptation Pattern

Each state must handle arbitrary viewport sizes:

```typescript
class TitleScreenState implements StateRenderer {
  render(ctx: CanvasRenderingContext2D, viewport: { width: number; height: number }) {
    const { width, height } = viewport;

    // Center elements relative to viewport
    const centerX = width / 2;
    const centerY = height / 2;

    // Draw logo centered
    ctx.drawImage(this.logo, centerX - this.logo.width / 2, 80);

    // Tile clouds to fill width
    for (let x = 0; x < width; x += this.clouds.width) {
      ctx.drawImage(this.clouds, x - this.scrollOffset, 40);
    }

    // Press Start at bottom center
    ctx.drawImage(this.pressStart, centerX - 64, height - 40);
  }
}
```

---

## File Structure

```
src/
├── core/
│   ├── GameState.ts           # State enum, interfaces
│   ├── GameStateManager.ts    # State transitions
│   └── SaveManager.ts         # Persistence
├── states/
│   ├── TitleScreenState.ts    # See docs/architecture/intro/ for details
│   ├── MainMenuState.ts
│   └── OverworldState.ts      # Extracted from GamePage
├── config/
│   └── viewport.ts            # UNCHANGED - single source of truth
└── pages/
    └── GamePage.tsx           # State router + canvas
```

---

## Success Criteria

- [ ] Change viewport config → all states adapt
- [ ] Title, Menu, Overworld all render to same canvas
- [ ] Transitions are smooth fades
- [ ] WebGL context shared, not recreated
- [ ] Existing overworld functionality preserved

---

## References

- `docs/architecture/intro/` - Title screen implementation details
- `docs/architecture/intro/responsive-design.md` - Scaling strategies
- `docs/systems/game-states/01-overview-and-main-loop.md` - GBA callback pattern

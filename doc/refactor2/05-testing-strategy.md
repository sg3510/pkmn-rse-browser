# Refactor 2.5: Testing Strategy

## Testing Philosophy

The refactored architecture enables testing at multiple levels:

1. **Unit Tests** - Individual modules in isolation
2. **Integration Tests** - Module interactions
3. **Visual Regression Tests** - Rendered output comparison
4. **Performance Tests** - Frame timing benchmarks

---

## Unit Testing

### Testable Modules (No DOM Required)

These modules are pure TypeScript with no browser dependencies:

```
src/engine/
├── GameState.ts         # State management
├── AnimationTimer.ts    # Frame timing
└── UpdateCoordinator.ts # Update orchestration

src/field/
├── DoorSequencer.ts     # State machine
├── WarpHandler.ts       # Warp logic
└── FadeController.ts    # Fade math

src/utils/
├── tileResolution.ts    # Tile lookup
├── elevationPriority.ts # Priority calculation
└── metatileBehaviors.ts # Behavior checks
```

### Example: Testing ElevationFilter

```typescript
// src/rendering/__tests__/ElevationFilter.test.ts

import { ElevationFilter } from '../ElevationFilter';
import { getSpritePriorityForElevation } from '../../utils/elevationPriority';

describe('ElevationFilter', () => {
  const filter = new ElevationFilter();

  describe('createFilter', () => {
    it('puts player at elevation 3 above most tiles', () => {
      const { below, above } = filter.createFilter(3);
      const mockTile = { elevation: 0, collision: 0 };

      // Player at elev 3 has priority 2, draws below BG1
      // So tiles go to topBelow (rendered before player)
      expect(below(mockTile, 0, 0)).toBe(false);
      expect(above(mockTile, 0, 0)).toBe(true);
    });

    it('puts player at elevation 12 below bridges', () => {
      const { below, above } = filter.createFilter(12);
      const mockTile = { elevation: 0, collision: 0 };

      // Player at elev 12 has priority 1, draws above BG1
      expect(below(mockTile, 0, 0)).toBe(true);
      expect(above(mockTile, 0, 0)).toBe(false);
    });

    it('blocked tiles at same elevation go to topAbove', () => {
      const { below, above } = filter.createFilter(3);
      const blockedTile = { elevation: 3, collision: 1 };

      expect(below(blockedTile, 0, 0)).toBe(false);
      expect(above(blockedTile, 0, 0)).toBe(true);
    });
  });
});
```

### Example: Testing DoorSequencer

```typescript
// src/field/__tests__/DoorSequencer.test.ts

import { DoorSequencer } from '../DoorSequencer';

describe('DoorSequencer', () => {
  let sequencer: DoorSequencer;

  beforeEach(() => {
    sequencer = new DoorSequencer();
  });

  describe('entry sequence', () => {
    const mockTrigger = {
      kind: 'door' as const,
      warpEvent: { destMap: 'test_map', destWarpId: 0 },
      behavior: 0x10,
      facing: 'up' as const,
    };

    it('starts in opening stage', () => {
      sequencer.startEntry(mockTrigger, 100, 100, 0x021, 0);

      expect(sequencer.isActive()).toBe(true);
      expect(sequencer.getState()?.stage).toBe('opening');
    });

    it('transitions to stepping after door opens', () => {
      sequencer.startEntry(mockTrigger, 100, 100, 0x021, 0);

      // Simulate 270ms (3 frames at 90ms each)
      const result = sequencer.update(270, createMockPlayer({ isMoving: false }));

      expect(sequencer.getState()?.stage).toBe('stepping');
      expect(result.action).toBe('startPlayerStep');
    });

    it('hides player after stepping', () => {
      sequencer.startEntry(mockTrigger, 100, 100, 0x021, 0);
      sequencer.update(270, createMockPlayer({ isMoving: false })); // -> stepping

      const result = sequencer.update(400, createMockPlayer({ isMoving: false }));

      expect(sequencer.getState()?.stage).toBe('closing');
      expect(result.action).toBe('hidePlayer');
    });

    it('triggers warp after fade out', () => {
      sequencer.startEntry(mockTrigger, 100, 100, 0x021, 0);
      // Progress through all stages
      sequencer.update(270, createMockPlayer({ isMoving: false }));
      sequencer.update(400, createMockPlayer({ isMoving: false }));
      sequencer.update(700, createMockPlayer({ isMoving: false })); // closing done
      sequencer.update(1100, createMockPlayer({ isMoving: false })); // wait done
      const result = sequencer.update(1600, createMockPlayer({ isMoving: false })); // fade done

      expect(result.action).toBe('executeWarp');
      expect(result.trigger).toBe(mockTrigger);
    });
  });
});

function createMockPlayer(overrides: { isMoving: boolean }) {
  return {
    isMoving: () => overrides.isMoving,
    getElevation: () => 3,
    tileX: 0,
    tileY: 0,
  };
}
```

### Example: Testing AnimationTimer

```typescript
// src/engine/__tests__/AnimationTimer.test.ts

import { AnimationTimer } from '../AnimationTimer';

describe('AnimationTimer', () => {
  let timer: AnimationTimer;

  beforeEach(() => {
    timer = new AnimationTimer();
  });

  it('starts at frame 0', () => {
    expect(timer.getCurrentFrame()).toBe(0);
  });

  it('increments frame after 10 ticks (166.67ms)', () => {
    timer.update(166.67);
    expect(timer.getCurrentFrame()).toBe(1);
  });

  it('accumulates fractional ticks', () => {
    timer.update(80); // ~5 ticks
    expect(timer.getCurrentFrame()).toBe(0);

    timer.update(90); // +~5 ticks = ~10 ticks
    expect(timer.getCurrentFrame()).toBe(1);
  });

  it('calculates frame for custom period', () => {
    timer.update(1000); // 60 ticks = 6 default frames

    // Water animation: 16 frames @ 10 ticks each
    const waterFrame = timer.getFrameForPeriod(10, 16);
    expect(waterFrame).toBe(6);
  });
});
```

---

## Integration Testing

### Testing RenderPipeline + TileRenderer

```typescript
// src/rendering/__tests__/RenderPipeline.integration.test.ts

import { RenderPipeline } from '../RenderPipeline';
import { TilesetCanvasCache } from '../TilesetCanvasCache';
import { createMockWorld } from '../../test/fixtures/mockWorld';

describe('RenderPipeline integration', () => {
  let pipeline: RenderPipeline;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    const cache = new TilesetCanvasCache();
    pipeline = new RenderPipeline(cache);

    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    ctx = canvas.getContext('2d')!;
  });

  it('renders all three passes without error', () => {
    const world = createMockWorld();
    const view = createMockView();

    expect(() => {
      pipeline.render(ctx, world, view, 3, { needsFullRender: true });
    }).not.toThrow();
  });

  it('uses cached canvases on subsequent renders', () => {
    const world = createMockWorld();
    const view = createMockView();

    pipeline.render(ctx, world, view, 3, { needsFullRender: true });

    const spy = jest.spyOn(pipeline['passRenderer'], 'renderBackground');
    pipeline.render(ctx, world, view, 3, { needsFullRender: false });

    expect(spy).not.toHaveBeenCalled();
  });
});
```

---

## Visual Regression Testing

### Snapshot Testing with Jest + Canvas

```typescript
// src/__tests__/visual/MapRendering.visual.test.ts

import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { renderMap } from '../../test/helpers/renderMap';

expect.extend({ toMatchImageSnapshot });

describe('Map rendering visual regression', () => {
  it('renders Littleroot Town correctly', async () => {
    const canvas = await renderMap('MAP_LITTLEROOT_TOWN');
    const buffer = canvas.toBuffer('image/png');

    expect(buffer).toMatchImageSnapshot({
      failureThreshold: 0.01, // 1% tolerance for anti-aliasing
      failureThresholdType: 'percent',
    });
  });

  it('renders elevation correctly on bridges', async () => {
    const canvas = await renderMap('MAP_FORTREE_CITY', {
      playerPosition: { x: 10, y: 5 },
      playerElevation: 12,
    });
    const buffer = canvas.toBuffer('image/png');

    expect(buffer).toMatchImageSnapshot();
  });

  it('renders door animation frames correctly', async () => {
    for (let frame = 0; frame < 3; frame++) {
      const canvas = await renderDoorFrame('MAP_LITTLEROOT_TOWN', 0x248, frame);
      const buffer = canvas.toBuffer('image/png');

      expect(buffer).toMatchImageSnapshot({
        customSnapshotIdentifier: `door-frame-${frame}`,
      });
    }
  });
});
```

---

## Performance Testing

### Benchmark Frame Times

```typescript
// src/__tests__/performance/RenderPerformance.perf.test.ts

describe('Render performance', () => {
  it('renders frame under 16ms (60fps target)', async () => {
    const pipeline = createPipeline();
    const world = await loadTestWorld();
    const ctx = createCanvas().getContext('2d')!;

    // Warm up
    for (let i = 0; i < 10; i++) {
      pipeline.render(ctx, world, createView(), 3, { needsFullRender: true });
    }

    // Measure
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      pipeline.render(ctx, world, createView(), 3, { needsFullRender: true });
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`Average: ${avg.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms`);

    expect(avg).toBeLessThan(16);
    expect(p95).toBeLessThan(20);
  });

  it('scrolling maintains 60fps', async () => {
    const pipeline = createPipeline();
    const world = await loadTestWorld();
    const ctx = createCanvas().getContext('2d')!;

    const scrollTimes: number[] = [];

    for (let x = 0; x < 50; x++) {
      const view = createView({ cameraX: x * 16 });
      const start = performance.now();
      pipeline.render(ctx, world, view, 3, { needsFullRender: false });
      scrollTimes.push(performance.now() - start);
    }

    const avg = scrollTimes.reduce((a, b) => a + b) / scrollTimes.length;
    expect(avg).toBeLessThan(8); // Scrolling should be faster than full render
  });
});
```

---

## Test Coverage Goals

| Module | Coverage Target | Priority |
|--------|-----------------|----------|
| ElevationFilter | 100% | High |
| DoorSequencer | 100% | High |
| WarpHandler | 90% | High |
| AnimationTimer | 100% | Medium |
| TileRenderer | 80% | Medium |
| RenderPipeline | 80% | Medium |
| PassRenderer | 70% | Medium |

---

## Test File Organization

```
src/
├── engine/
│   ├── __tests__/
│   │   ├── AnimationTimer.test.ts
│   │   ├── GameState.test.ts
│   │   └── UpdateCoordinator.test.ts
│
├── rendering/
│   ├── __tests__/
│   │   ├── ElevationFilter.test.ts
│   │   ├── PassRenderer.test.ts
│   │   └── RenderPipeline.integration.test.ts
│
├── field/
│   ├── __tests__/
│   │   ├── DoorSequencer.test.ts
│   │   ├── WarpHandler.test.ts
│   │   └── FadeController.test.ts
│
├── __tests__/
│   ├── visual/
│   │   └── MapRendering.visual.test.ts
│   └── performance/
│       └── RenderPerformance.perf.test.ts
│
└── test/
    ├── fixtures/
    │   ├── mockWorld.ts
    │   └── mockTilesets.ts
    └── helpers/
        ├── renderMap.ts
        └── createCanvas.ts
```

---

## CI Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit

  visual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:visual
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: visual-diff
          path: __image_snapshots__/__diff_output__/

  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:perf
```

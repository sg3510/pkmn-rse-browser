---
title: Weather System
status: reference
last_verified: 2026-02-20
---

# Weather System

This document describes the Pokemon Emerald weather system from the C source code and proposes a modular React implementation.

## Current TypeScript Runtime (2026-02-12)

- `src/weather/registry.ts` is generated-data-driven and resolves weather/coord-weather names and aliases without per-weather hardcoding.
- `src/weather/WeatherManager.ts` provides script-facing semantics parity for:
  - `setweather` -> set saved weather
  - `resetweather` -> restore current map default
  - `doweather` -> apply current saved weather
- `src/game/mapEventLoader.ts` parses both map default weather and coord weather events (`type: "weather"`).
- `src/pages/GamePage.tsx` integrates weather into the main render/update loop:
  - map change -> default weather sync
  - coord weather -> runtime override
  - compositing stage render hook (below fade/scanline overlays)
- Implemented visual effect in this milestone: `WEATHER_UNDERWATER_BUBBLES` (`src/weather/effects/UnderwaterBubblesEffect.ts`) using:
  - `/pokeemerald/graphics/weather/fog_horizontal.png`
  - `/pokeemerald/graphics/weather/bubble.png`
- Weather assets now load through shared indexed-transparency parity loaders (`loadImageCanvasAsset(..., { transparency: { type: 'indexed-zero', fallback: { type: 'top-left' } } })`) so indexed PNG palette index `0` is treated as transparent (matching game intent).
- Underwater fog now renders with integer 64x64 tiling + integer scroll steps (no viewport scaling), eliminating seam-grid stitching artifacts.
- Underwater player bobbing parity is handled by shared player-render helpers (`src/game/playerBobbing.ts`), not weather effect code.

## Current Scope

- [x] Scalable weather runtime and generated weather constants (`npm run generate:weather`)
- [x] Underwater bubbles parity path (fog + bubble cadence/wobble behavior)
- [x] Runtime weather mapping generator from C callback table (`npm run generate:weather-runtime`)
- [x] Non-underwater weather visuals (rain, thunderstorm/downpour, snow, ash, sandstorm, fog variants, clouds, shade, drought, abnormal cycle)

## Overview

The weather system in Pokemon Emerald provides visual and gameplay effects based on the current map's weather type. Weather can be set by:
1. **Map header default** - Each map has a `weather` field defining its default weather
2. **Coord events** - Specific coordinates on a map can trigger weather changes (e.g., entering the volcanic ash zone on Route 113)
3. **Script commands** - Story events can dynamically change weather

## Source Code Reference

### Key Files in `public/pokeemerald/`
- `src/field_weather.c` (1,105 lines) - Main weather state machine and palette management
- `src/field_weather_effect.c` - Individual weather effect implementations (sprites, animations)
- `src/coord_event_weather.c` - Coordinate-triggered weather changes
- `include/constants/weather.h` - Weather type constants
- `include/field_weather.h` - Weather struct and function declarations

## Weather Types

From `include/constants/weather.h`:

| Constant | Value | Description |
|----------|-------|-------------|
| `WEATHER_NONE` | 0 | No weather effect |
| `WEATHER_SUNNY_CLOUDS` | 1 | Sunny with moving clouds |
| `WEATHER_SUNNY` | 2 | Clear sunny weather |
| `WEATHER_RAIN` | 3 | Light rain |
| `WEATHER_SNOW` | 4 | Snowfall (unused in vanilla) |
| `WEATHER_RAIN_THUNDERSTORM` | 5 | Heavy rain with lightning |
| `WEATHER_FOG_HORIZONTAL` | 6 | Fog moving horizontally |
| `WEATHER_VOLCANIC_ASH` | 7 | Falling ash particles |
| `WEATHER_SANDSTORM` | 8 | Desert sandstorm |
| `WEATHER_FOG_DIAGONAL` | 9 | Diagonal fog (unused) |
| `WEATHER_UNDERWATER` | 10 | Underwater effect (unused) |
| `WEATHER_SHADE` | 11 | Overcast/shaded |
| `WEATHER_DROUGHT` | 12 | Intense sunlight (Groudon) |
| `WEATHER_DOWNPOUR` | 13 | Torrential rain (Kyogre) |
| `WEATHER_UNDERWATER_BUBBLES` | 14 | Underwater with bubbles |
| `WEATHER_ABNORMAL` | 15 | Alternating weather (Terra/Marine Cave) |
| `WEATHER_ROUTE119_CYCLE` | 20 | Route 119 rain cycling |
| `WEATHER_ROUTE123_CYCLE` | 21 | Route 123 rain cycling |

## C Implementation Architecture

### Weather State Machine

```c
// Global weather state (field_weather.c:63)
EWRAM_DATA struct Weather gWeather = {0};

// Weather callback table (field_weather.c:85-102)
static const struct WeatherCallbacks sWeatherFuncs[] = {
    [WEATHER_NONE]           = {None_Init, None_Main, None_Init, None_Finish},
    [WEATHER_RAIN]           = {Rain_InitVars, Rain_Main, Rain_InitAll, Rain_Finish},
    [WEATHER_VOLCANIC_ASH]   = {Ash_InitVars, Ash_Main, Ash_InitAll, Ash_Finish},
    // ... etc
};
```

Each weather type provides 4 callbacks:
- `initVars` - Initialize variables when transitioning TO this weather
- `main` - Per-frame update
- `initAll` - Full initialization (used on map load)
- `finish` - Cleanup when transitioning AWAY from this weather

### Weather Struct

```c
struct Weather {
    // Sprite management
    struct Sprite *sprites;
    u8 rainSpriteCount, cloudSpritesCreated, ashSpritesCreated;

    // Palette processing
    u8 palProcessingState;      // IDLE, CHANGING_WEATHER, FADING
    s8 colorMapIndex;           // Current brightness/contrast level
    s8 targetColorMapIndex;     // Target for gradual transition
    u8 colorMapStepDelay;       // Frames between color map steps

    // Weather-specific state
    u8 currWeather, nextWeather;
    bool8 weatherGfxLoaded;
    u8 initStep, finishStep;    // State machine steps

    // Blend coefficients (for GBA hardware blending)
    u8 currBlendEVA, currBlendEVB;
    u8 targetBlendEVA, targetBlendEVB;
};
```

### Coordinate Event Weather

Maps can have "coord_events" that trigger weather changes when stepped on:

```json
// From data/maps/Route113/map.json
"coord_events": [
  {
    "type": "weather",
    "x": 19, "y": 11,
    "elevation": 3,
    "weather": "COORD_EVENT_WEATHER_VOLCANIC_ASH"
  }
]
```

The coord_event_weather.c file maps these to weather changes:

```c
void DoCoordEventWeather(u8 coordEventWeather) {
    // Looks up weather type and calls SetWeather()
}
```

### Weather Palette Effects

Weather affects palette colors for visual effects:
- **Rain/Shade**: Darkens colors (colorMapIndex = 3)
- **Drought**: Uses precalculated lookup tables for intense orange tint
- **Fog**: Applies white blend to create haze
- **Thunderstorm**: Periodic flash via rapid colorMapIndex changes

## Maps Using Weather

Example maps with specific weather:

| Map | Default Weather | Notes |
|-----|-----------------|-------|
| Route 113 | `WEATHER_SUNNY` | Has coord_events for volcanic ash zone |
| Route 119 | `WEATHER_ROUTE119_CYCLE` | Cycles between rain states |
| Route 120 | `WEATHER_FOG_HORIZONTAL` | Foggy route |
| Safari Zone | `WEATHER_SUNNY` | Clear weather |
| Sootopolis | `WEATHER_RAIN_THUNDERSTORM` | During Kyogre/Groudon event |

## Proposed React Implementation

### Architecture

```
src/
├── weather/
│   ├── WeatherManager.ts          # Main state manager
│   ├── WeatherRenderer.ts         # Canvas rendering
│   ├── effects/
│   │   ├── RainEffect.ts          # Rain sprites & animation
│   │   ├── SnowEffect.ts          # Snowflake particles
│   │   ├── AshEffect.ts           # Volcanic ash particles
│   │   ├── SandstormEffect.ts     # Sand particles
│   │   ├── FogEffect.ts           # Fog overlay
│   │   ├── CloudEffect.ts         # Moving cloud sprites
│   │   └── DroughtEffect.ts       # Color filter effect
│   └── palettes/
│       └── WeatherPaletteFilter.ts # Palette manipulation
```

### WeatherManager Interface

```typescript
interface WeatherState {
  currentWeather: WeatherType;
  targetWeather: WeatherType;
  transitionProgress: number;  // 0-1
  isTransitioning: boolean;
}

interface WeatherManager {
  // Initialize weather for a map
  setMapWeather(mapId: string): void;

  // Transition to new weather
  setWeather(weather: WeatherType): void;

  // Check coord events when player moves
  checkCoordWeather(x: number, y: number): void;

  // Per-frame update
  update(deltaMs: number): void;

  // Get current state for rendering
  getState(): WeatherState;
}
```

### Weather Effect Base Class

```typescript
abstract class WeatherEffect {
  protected particles: WeatherParticle[] = [];
  protected sprites: HTMLCanvasElement[] = [];

  abstract init(): void;
  abstract update(deltaMs: number): void;
  abstract render(ctx: CanvasRenderingContext2D, viewport: Viewport): void;
  abstract finish(): boolean;  // Returns true when cleanup complete

  // Load sprite sheet for this effect
  protected loadSprites(path: string): Promise<void>;
}
```

### Integration with MapRenderer

```typescript
// In MapRenderer.tsx

// After rendering map layers, before UI
const weatherManager = useWeatherManager(mapData);

useEffect(() => {
  // Check coord events on player movement
  weatherManager.checkCoordWeather(playerX, playerY);
}, [playerX, playerY]);

// In render loop
weatherManager.update(deltaMs);
weatherManager.render(ctx, viewport);

// Apply palette filter if needed
const paletteFilter = weatherManager.getPaletteFilter();
if (paletteFilter) {
  applyPaletteFilter(ctx, paletteFilter);
}
```

### Particle System for Rain/Snow/Ash

```typescript
interface WeatherParticle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  frame: number;
  lifetime: number;
}

class RainEffect extends WeatherEffect {
  private readonly MAX_DROPS = 24;  // MAX_RAIN_SPRITES from C code

  init(): void {
    // Load rain sprite sheet
    // Pre-position drops across screen
  }

  update(deltaMs: number): void {
    for (const drop of this.particles) {
      // Move drop (Q28.4 fixed-point in original)
      drop.x += drop.velocityX * deltaMs / 16.67;
      drop.y += drop.velocityY * deltaMs / 16.67;

      // Check for splash (when y reaches ground level)
      if (drop.y > SCREEN_HEIGHT) {
        this.triggerSplash(drop);
        this.respawnDrop(drop);
      }
    }
  }
}
```

### Palette Filter Effect (for Drought/Rain shade)

```typescript
interface PaletteFilter {
  type: 'darken' | 'drought' | 'fog';
  intensity: number;  // 0-1
}

function applyPaletteFilter(
  ctx: CanvasRenderingContext2D,
  filter: PaletteFilter
): void {
  const imageData = ctx.getImageData(0, 0, width, height);

  switch (filter.type) {
    case 'darken':
      // Apply brightness reduction
      for (let i = 0; i < imageData.data.length; i += 4) {
        const factor = 1 - (filter.intensity * 0.3);
        imageData.data[i] *= factor;     // R
        imageData.data[i+1] *= factor;   // G
        imageData.data[i+2] *= factor;   // B
      }
      break;

    case 'drought':
      // Apply orange tint (from precalculated drought tables)
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.min(255, imageData.data[i] * 1.2);      // R boost
        imageData.data[i+1] *= 0.9;                                       // G reduce
        imageData.data[i+2] *= 0.7;                                       // B reduce
      }
      break;

    case 'fog':
      // Blend towards white
      for (let i = 0; i < imageData.data.length; i += 4) {
        const blend = filter.intensity * 0.4;
        imageData.data[i] += (255 - imageData.data[i]) * blend;
        imageData.data[i+1] += (255 - imageData.data[i+1]) * blend;
        imageData.data[i+2] += (255 - imageData.data[i+2]) * blend;
      }
      break;
  }

  ctx.putImageData(imageData, 0, 0);
}
```

## Implementation Priority

1. **Phase 1**: Basic weather state management
   - Load weather from map.json
   - Track current weather state
   - No visual effects yet

2. **Phase 2**: Coord event weather
   - Parse coord_events from map JSON
   - Trigger weather changes on player position

3. **Phase 3**: Visual effects
   - Rain particles (most common weather)
   - Ash particles (Route 113)
   - Cloud sprites

4. **Phase 4**: Palette effects
   - Drought color filter
   - Rain/shade darkening
   - Fog blend

5. **Phase 5**: Audio integration
   - Rain sounds (SE_RAIN, SE_DOWNPOUR, SE_THUNDERSTORM)
   - Weather transition sounds

## Data Files

Weather assets in `public/pokeemerald/graphics/weather/`:
- `rain.4bpp` - Rain drop sprites
- `ash.4bpp` - Ash particle sprites
- `cloud.4bpp` - Cloud sprites
- `fog_horizontal.4bpp` - Fog tiles
- `sandstorm.4bpp` - Sand particle sprites
- `snow0.4bpp`, `snow1.4bpp` - Snowflake sprites
- `drought/colors_*.bin` - Precalculated drought palette lookup tables

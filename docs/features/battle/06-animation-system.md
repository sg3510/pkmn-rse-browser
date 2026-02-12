---
title: Animation System
status: reference
written_on: 2025-11-26
last_verified: 2026-01-13
---

# Animation System

## Source Files

- **Animation Scripts**: `data/battle_anim_scripts.s`
- **Animation Constants**: `include/constants/battle_anim.h`
- **Animation Functions**: `src/battle_anim.c`
- **Animation Task Handlers**: `src/battle_anim_*.c`
- **Sprite Data**: `graphics/battle_anims/`

## Animation Script Structure

Each move has an animation script in `data/battle_anim_scripts.s`:

```asm
@ Animation script table (indexed by move ID)
gBattleAnims_Moves::
    .4byte Move_NONE
    .4byte Move_POUND
    .4byte Move_KARATE_CHOP
    .4byte Move_DOUBLE_SLAP
    @ ... one entry per move
```

## Animation Command Macros

From `asm/macros/battle_anim_script.inc`:

### Sprite Creation Commands

| Command | Description |
|---------|-------------|
| `createsprite TEMPLATE, ANIM_ATTACKER, 2, x, y, ...` | Create animation sprite |
| `createvisualtask FUNC, PRIORITY, arg1, arg2, ...` | Create visual effect task |
| `launchtemplate TEMPLATE, ANIM_TARGET, 2, x, y, ...` | Launch sprite at target |
| `loopsewithpan SE_ID, PAN, TIMES, DELAY` | Play sound effect looped |
| `playsewithpan SE_ID, PAN` | Play sound effect once |

### Flow Control Commands

| Command | Description |
|---------|-------------|
| `delay FRAMES` | Wait specified frames |
| `waitforvisualfinish` | Wait for sprites to finish |
| `end` | End animation script |
| `monbg BATTLER` | Set up monster background |
| `clearmonbg BATTLER` | Clear monster background |
| `setalpha A, B` | Set alpha blending |
| `blendoff` | Disable blending |

### Position Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `ANIM_ATTACKER` | 0 | Origin at attacker |
| `ANIM_TARGET` | 1 | Origin at target |
| `ANIM_ATK_PARTNER` | 2 | Attacker's partner |
| `ANIM_DEF_PARTNER` | 3 | Target's partner |

## Example Animation Scripts

### Simple Hit Animation (Pound)

```asm
Move_POUND::
    loadspritegfx ANIM_TAG_IMPACT
    monbg ANIM_DEF_PARTNER
    setalpha 12, 8
    playsewithpan SE_M_DOUBLE_SLAP, SOUND_PAN_TARGET
    createsprite gBasicHitSplatSpriteTemplate, ANIM_ATTACKER, 2, 0, 0, ANIM_TARGET, 2
    createvisualtask AnimTask_ShakeMon, 2, ANIM_TARGET, 3, 0, 6, 1
    waitforvisualfinish
    clearmonbg ANIM_DEF_PARTNER
    blendoff
    end
```

### Projectile Animation (Ember)

```asm
Move_EMBER::
    loadspritegfx ANIM_TAG_SMALL_EMBER
    monbg ANIM_TARGET
    splitbgprio ANIM_TARGET
    setalpha 12, 8
    delay 1
    createvisualtask AnimTask_ShakeMon, 2, ANIM_ATTACKER, 1, 0, 3, 1
    createsprite gEmberSpriteTemplate, ANIM_ATTACKER, 2, 10, 0, 15, 0, 20, FALSE
    playsewithpan SE_M_FLAME_WHEEL, SOUND_PAN_ATTACKER
    delay 3
    createsprite gEmberSpriteTemplate, ANIM_ATTACKER, 2, 10, -8, 18, 1, 20, FALSE
    delay 3
    createsprite gEmberSpriteTemplate, ANIM_ATTACKER, 2, 10, 8, 12, 2, 20, FALSE
    waitforvisualfinish
    createvisualtask AnimTask_ShakeMon, 2, ANIM_TARGET, 3, 0, 5, 1
    createsprite gBasicHitSplatSpriteTemplate, ANIM_ATTACKER, 3, 0, 0, ANIM_TARGET, 1
    playsewithpan SE_M_FLAME_WHEEL2, SOUND_PAN_TARGET
    waitforvisualfinish
    clearmonbg ANIM_TARGET
    blendoff
    end
```

### Two-Turn Move (Fly)

```asm
Move_FLY::
    @ First turn: fly up
    choosetwoturnanim FlySetUp, FlyUnleash

FlySetUp::
    loadspritegfx ANIM_TAG_ROUND_SHADOW
    fadetobg BG_FLY
    waitbgfadeout
    createvisualtask AnimTask_FlyUp, 2
    delay 8
    playsewithpan SE_M_TAKE_DOWN, SOUND_PAN_ATTACKER
    waitforvisualfinish
    delay 30
    restorebg
    waitbgfadein
    end

FlyUnleash::
    loadspritegfx ANIM_TAG_IMPACT
    loadspritegfx ANIM_TAG_ROUND_SHADOW
    fadetobg BG_FLY
    waitbgfadeout
    createvisualtask AnimTask_FlyDown, 2
    delay 45
    playsewithpan SE_M_FLY, SOUND_PAN_ATTACKER
    delay 15
    createsprite gFlyShadowSpriteTemplate, ANIM_ATTACKER, 2, 0, 0
    delay 10
    visible ANIM_ATTACKER
    createvisualtask AnimTask_ShakeMon2, 2, ANIM_TARGET, 4, 0, 18, 1
    createsprite gBasicHitSplatSpriteTemplate, ANIM_ATTACKER, 4, 0, 0, ANIM_TARGET, 0
    playsewithpan SE_M_DOUBLE_SLAP, SOUND_PAN_TARGET
    waitforvisualfinish
    restorebg
    waitbgfadein
    end
```

### Multi-Hit Animation (Double Slap)

```asm
Move_DOUBLE_SLAP::
    loadspritegfx ANIM_TAG_IMPACT
    loadspritegfx ANIM_TAG_HANDS_AND_FEET
    monbg ANIM_DEF_PARTNER
    setalpha 12, 8
    @ First hit
    createsprite gWaveLineSpriteTemplate, ANIM_TARGET, 2, -12, 0, 0, 0, 0, 0
    createsprite gBasicHitSplatSpriteTemplate, ANIM_TARGET, 2, 0, 0, ANIM_TARGET, 0
    createvisualtask AnimTask_ShakeMon, 2, ANIM_TARGET, 3, 0, 6, 1
    playsewithpan SE_M_DOUBLE_SLAP, SOUND_PAN_TARGET
    waitforvisualfinish
    delay 12
    @ Second hit (opposite direction)
    createsprite gWaveLineSpriteTemplate, ANIM_TARGET, 2, 12, 0, 1, 0, 0, 0
    createsprite gBasicHitSplatSpriteTemplate, ANIM_TARGET, 2, 0, 0, ANIM_TARGET, 0
    createvisualtask AnimTask_ShakeMon, 2, ANIM_TARGET, 3, 0, 6, 1
    playsewithpan SE_M_DOUBLE_SLAP, SOUND_PAN_TARGET
    waitforvisualfinish
    clearmonbg ANIM_DEF_PARTNER
    blendoff
    end
```

## Animation Graphics Files

Graphics are stored in `graphics/battle_anims/`:

```
graphics/battle_anims/
├── masks/              # Background masks
├── backgrounds/        # Full background effects
│   ├── psychic.png
│   ├── solarbeam.png
│   ├── thunder.png
│   └── ...
├── sprites/           # Animation sprite sheets
│   ├── fire.png
│   ├── water.png
│   ├── impact.png
│   ├── electricity.png
│   └── ...
└── affine/            # Affine transformation data
```

## Animation Tags

From `include/constants/battle_anim.h`:

```c
// Common animation graphics tags
#define ANIM_TAG_BONE                   10000
#define ANIM_TAG_SPARK                  10001
#define ANIM_TAG_PENCIL                 10002
#define ANIM_TAG_AIR_WAVE               10003
#define ANIM_TAG_ORB                    10004
#define ANIM_TAG_SWORD                  10005
#define ANIM_TAG_SEED                   10006
#define ANIM_TAG_EXPLOSION               10012
#define ANIM_TAG_SMALL_EMBER            10017
#define ANIM_TAG_FIRE_PLUME             10019
#define ANIM_TAG_IMPACT                 10011
#define ANIM_TAG_WATER_IMPACT           10034
#define ANIM_TAG_ICE_CHUNK              10049
#define ANIM_TAG_ELECTRICITY            10076
// ... many more
```

## Sound Effects

From `include/constants/songs.h`:

```c
// Battle animation sound effects
#define SE_M_DOUBLE_SLAP        221
#define SE_M_HEADBUTT           222
#define SE_M_BITE               223
#define SE_M_FLAME_WHEEL        224
#define SE_M_FLAME_WHEEL2       225
#define SE_M_BUBBLE             226
#define SE_M_BUBBLE2            227
#define SE_M_SCRATCH            228
#define SE_M_ROCK_THROW         231
#define SE_M_EARTHQUAKE         232
#define SE_M_LEER               234
#define SE_M_THUNDER_WAVE       239
#define SE_M_THUNDERBOLT        240
#define SE_M_THUNDERBOLT2       241
#define SE_M_SURF               251
#define SE_M_HYDRO_PUMP         252
// ... many more
```

## Animation Duration Estimation

For simulation purposes, estimate animation durations:

| Animation Type | Typical Duration (frames) |
|----------------|---------------------------|
| Simple hit | 30-45 |
| Projectile | 45-60 |
| Beam/Ray | 60-90 |
| Status effect | 30-45 |
| Stat change | 20-30 |
| Weather start | 60-90 |
| Two-turn setup | 45-60 |
| Two-turn attack | 60-90 |

## TypeScript Animation Interface

```typescript
interface MoveAnimation {
  moveId: number;
  name: string;
  duration: number;  // In frames (60fps)
  sounds: SoundEffect[];
  sprites: SpriteAnimation[];
  screenEffects: ScreenEffect[];
}

interface SpriteAnimation {
  template: string;
  origin: 'attacker' | 'target';
  startFrame: number;
  duration: number;
  trajectory?: Trajectory;
}

interface SoundEffect {
  soundId: number;
  frame: number;
  pan: 'attacker' | 'target' | 'center';
}

interface ScreenEffect {
  type: 'shake' | 'flash' | 'fade' | 'blend';
  target: 'attacker' | 'target' | 'screen';
  startFrame: number;
  duration: number;
  intensity: number;
}

// For React implementation - simplified animation timing
const ANIMATION_DURATIONS: Record<string, number> = {
  hit_simple: 500,       // ms
  hit_projectile: 750,
  hit_beam: 1000,
  hit_multihit: 300,     // per hit
  status_apply: 500,
  stat_change: 400,
  weather_start: 1200,
  faint: 800,
  switch_out: 600,
  switch_in: 600,
};
```

## Simplified Animation for React

For React implementation, animations can be simplified:

1. **Visual Effects**: CSS animations or canvas-based effects
2. **Sound**: Web Audio API or HTML5 audio
3. **Timing**: requestAnimationFrame or setTimeout chains
4. **Sprite Sheets**: Load as image atlases, animate with CSS sprites

```typescript
class BattleAnimationController {
  private animationQueue: Animation[] = [];

  async playMoveAnimation(
    move: Move,
    attacker: BattlerPosition,
    target: BattlerPosition
  ): Promise<void> {
    // Queue: move announce → attack animation → hit effect → damage
    await this.showMoveAnnouncement(move);
    await this.playAttackAnimation(move, attacker);
    await this.playHitEffect(target);
    await this.showDamageNumbers(target);
  }

  private async playAttackAnimation(
    move: Move,
    attacker: BattlerPosition
  ): Promise<void> {
    const duration = ANIMATION_DURATIONS[move.animationType];
    return new Promise(resolve => {
      // Trigger CSS animation or canvas effect
      this.triggerAnimation(move, attacker);
      setTimeout(resolve, duration);
    });
  }
}
```

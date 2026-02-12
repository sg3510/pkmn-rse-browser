---
title: Battle Animations System
status: reference
written_on: 2025-11-26
last_verified: 2026-01-13
---

# Battle Animations System

The animation system in Pokemon Emerald uses a custom bytecode interpreter to execute animation scripts.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Animation System                          │
├─────────────────────────────────────────────────────────────┤
│  gBattleAnims_Moves[]  →  Animation Script  →  Commands     │
│         ↓                       ↓                  ↓        │
│    Move Index           Bytecode Script      Execute Cmds   │
│   (1-354 moves)        (.s assembly)         (C functions)  │
└─────────────────────────────────────────────────────────────┘
```

## Animation Script Commands

From `battle_anim.c`, the animation bytecode interpreter supports these commands:

```c
// Command table (0x00 - 0x2F)
static void (*const sScriptCmdTable[])(void) = {
    Cmd_loadspritegfx,        // 0x00 - Load sprite graphics
    Cmd_unloadspritegfx,      // 0x01 - Unload sprite graphics
    Cmd_createsprite,         // 0x02 - Create animated sprite
    Cmd_createvisualtask,     // 0x03 - Create visual task
    Cmd_delay,                // 0x04 - Wait frames
    Cmd_waitforvisualfinish,  // 0x05 - Wait for tasks/sprites
    Cmd_nop,                  // 0x06 - No operation
    Cmd_nop2,                 // 0x07 - No operation
    Cmd_end,                  // 0x08 - End animation
    Cmd_playse,               // 0x09 - Play sound effect
    Cmd_monbg,                // 0x0A - Set monster background
    Cmd_clearmonbg,           // 0x0B - Clear monster background
    Cmd_setalpha,             // 0x0C - Set alpha blending
    Cmd_blendoff,             // 0x0D - Disable blending
    Cmd_call,                 // 0x0E - Call subroutine
    Cmd_return,               // 0x0F - Return from subroutine
    Cmd_setarg,               // 0x10 - Set animation argument
    Cmd_choosetwoturnanim,    // 0x11 - Choose 2-turn anim
    Cmd_jumpifmoveturn,       // 0x12 - Jump based on move turn
    Cmd_goto,                 // 0x13 - Unconditional jump
    Cmd_fadetobg,             // 0x14 - Fade to background
    Cmd_restorebg,            // 0x15 - Restore background
    Cmd_waitbgfadeout,        // 0x16 - Wait for BG fade out
    Cmd_waitbgfadein,         // 0x17 - Wait for BG fade in
    Cmd_changebg,             // 0x18 - Change background
    Cmd_playsewithpan,        // 0x19 - Play SE with pan
    Cmd_setpan,               // 0x1A - Set audio pan
    Cmd_panse,                // 0x1B - Pan sound effect
    Cmd_loopsewithpan,        // 0x1C - Loop SE with pan
    Cmd_waitplaysewithpan,    // 0x1D - Wait then play SE
    Cmd_setbldcnt,            // 0x1E - Set blend control
    Cmd_createsoundtask,      // 0x1F - Create sound task
    Cmd_waitsound,            // 0x20 - Wait for sound
    Cmd_jumpargeq,            // 0x21 - Jump if arg equal
    Cmd_monbg_static,         // 0x22 - Static monster BG
    Cmd_clearmonbg_static,    // 0x23 - Clear static BG
    Cmd_jumpifcontest,        // 0x24 - Jump if in contest
    Cmd_fadetobgfromset,      // 0x25 - Fade to BG from set
    Cmd_panse_adjustnone,     // 0x26 - Pan SE no adjust
    Cmd_panse_adjustall,      // 0x27 - Pan SE adjust all
    Cmd_splitbgprio,          // 0x28 - Split BG priority
    Cmd_splitbgprio_all,      // 0x29 - Split all BG prio
    Cmd_splitbgprio_foes,     // 0x2A - Split foe BG prio
    Cmd_invisible,            // 0x2B - Make sprite invisible
    Cmd_visible,              // 0x2C - Make sprite visible
    Cmd_teamattack_moveback,  // 0x2D - Move team back
    Cmd_teamattack_movefwd,   // 0x2E - Move team forward
    Cmd_stopsound,            // 0x2F - Stop sound
};
```

## Animation Files by Type

Each Pokemon type has its own animation file:

| File | Description |
|------|-------------|
| `battle_anim_normal.c` | Normal type effects |
| `battle_anim_fire.c` | Fire type effects (flames, embers) |
| `battle_anim_water.c` | Water type effects (bubbles, waves) |
| `battle_anim_electric.c` | Electric type effects (sparks, bolts) |
| `battle_anim_grass.c` | (Not in file list, likely in effects_*.c) |
| `battle_anim_ice.c` | Ice type effects (crystals, frost) |
| `battle_anim_fight.c` | Fighting type effects (punches, kicks) |
| `battle_anim_poison.c` | Poison type effects (bubbles, sludge) |
| `battle_anim_ground.c` | Ground type effects (earthquakes, sand) |
| `battle_anim_flying.c` | Flying type effects (wind, gusts) |
| `battle_anim_psychic.c` | Psychic type effects (waves, rings) |
| `battle_anim_bug.c` | Bug type effects (webs, swarms) |
| `battle_anim_rock.c` | Rock type effects (boulders, debris) |
| `battle_anim_ghost.c` | Ghost type effects (shadows, spirits) |
| `battle_anim_dragon.c` | Dragon type effects (beams, breath) |
| `battle_anim_dark.c` | Dark type effects (shadows, crescents) |

## Utility Animation Files

| File | Purpose |
|------|---------|
| `battle_anim_mons.c` | Pokemon sprite animations |
| `battle_anim_mon_movement.c` | Pokemon movement during attacks |
| `battle_anim_throw.c` | Pokeball throwing animations |
| `battle_anim_status_effects.c` | Status condition visuals |
| `battle_anim_effects_1.c` | General effects (part 1) |
| `battle_anim_effects_2.c` | General effects (part 2) |
| `battle_anim_effects_3.c` | General effects (part 3) |
| `battle_anim_utility_funcs.c` | Shared utility functions |
| `battle_anim_sound_tasks.c` | Sound effect tasks |
| `battle_anim_smokescreen.c` | Smokescreen effect |

## Animation Variables

```c
// Global animation state
EWRAM_DATA static const u8 *sBattleAnimScriptPtr = NULL;
EWRAM_DATA bool8 gAnimScriptActive = FALSE;
EWRAM_DATA u8 gAnimVisualTaskCount = 0;
EWRAM_DATA u8 gAnimSoundTaskCount = 0;
EWRAM_DATA s32 gAnimMoveDmg = 0;      // Damage being shown
EWRAM_DATA u16 gAnimMovePower = 0;    // Move power
EWRAM_DATA u8 gAnimFriendship = 0;    // For Return/Frustration
EWRAM_DATA u8 gAnimMoveTurn = 0;      // For multi-turn moves
EWRAM_DATA u8 gBattleAnimAttacker = 0; // Attacking battler
EWRAM_DATA u8 gBattleAnimTarget = 0;   // Target battler
EWRAM_DATA s16 gBattleAnimArgs[8] = {0}; // Animation arguments
```

## Launching Animations

```c
// Launch a move animation
void DoMoveAnim(u16 move) {
    gBattleAnimAttacker = gBattlerAttacker;
    gBattleAnimTarget = gBattlerTarget;
    LaunchBattleAnimation(gBattleAnims_Moves, move, TRUE);
}

// General animation launcher
void LaunchBattleAnimation(
    const u8 *const animsTable[],
    u16 tableId,
    bool8 isMoveAnim
) {
    // Set up animation script pointer
    // Initialize sprite indices
    // Begin animation execution
}
```

## Animation Script Example

From `battle_anim_scripts.s` (assembly format):

```asm
Move_THUNDERBOLT::
    loadspritegfx ANIM_TAG_SPARK_2
    loadspritegfx ANIM_TAG_LIGHTNING
    monbg ANIM_TARGET
    setalpha 12, 8
    createsprite gLightningSpriteTemplate, ...
    delay 2
    createsprite gSparkSpriteTemplate, ...
    playsewithpan SE_M_THUNDERBOLT, SOUND_PAN_TARGET
    waitforvisualfinish
    clearmonbg ANIM_TARGET
    blendoff
    end
```

## Sprite Management

```c
// Sprite creation during animation
static void Cmd_createsprite(void) {
    s16 args[8];
    u8 argCount;
    u8 spriteId;

    // Read sprite template
    // Parse arguments
    // Create sprite at position
    // Link to animation system
}

// Typical sprite template
const struct SpriteTemplate gLightningSpriteTemplate = {
    .tileTag = ANIM_TAG_LIGHTNING,
    .paletteTag = ANIM_TAG_LIGHTNING,
    .oam = &gOamData_AffineOff_ObjNormal_32x32,
    .anims = sLightningAnimTable,
    .images = NULL,
    .affineAnims = gDummySpriteAffineAnimTable,
    .callback = SpriteCB_Lightning,
};
```

## Pokemon Sprite Animations

```c
// Pokemon movement types
enum {
    ANIM_TYPE_BOUNCE,           // Bounce up and down
    ANIM_TYPE_SHAKE_HORIZONTAL, // Shake left-right
    ANIM_TYPE_SHAKE_VERTICAL,   // Shake up-down
    ANIM_TYPE_VIBRATE,          // Quick vibration
    ANIM_TYPE_SPIN,             // Rotate
    ANIM_TYPE_FLASH,            // Flash in/out
    ANIM_TYPE_GROW,             // Grow larger
    ANIM_TYPE_SHRINK,           // Shrink smaller
};
```

## Status Effect Animations

```c
// Status animations (from battle_anim_status_effects.c)
- Poison bubbles (purple, rising)
- Burn flames (red, flickering)
- Paralysis sparks (yellow, random)
- Sleep "Z"s (gray, floating)
- Freeze crystals (cyan, rotating)
- Confusion stars (yellow, circling)
```

## Ball Throw Animations

From `battle_anim_throw.c`:

```c
// Pokeball throw sequence
1. Ball sprite created in player's hand position
2. Arc trajectory calculated to opponent position
3. Ball sprite follows arc with rotation
4. On hit: open animation, flash effect
5. Success: shake 1-3 times, click sound
6. Fail: burst open, Pokemon reappears
```

## Implementation for React

For a React implementation, animations can be simplified:

```tsx
interface BattleAnimation {
  type: 'move' | 'status' | 'pokeball' | 'faint';
  moveId?: number;
  attacker: 'player' | 'enemy';
  target: 'player' | 'enemy';
}

// Simplified animation approach
function BattleAnimationLayer({ animation }: { animation: BattleAnimation }) {
  // Use CSS animations or a library like framer-motion
  // Key animations to implement:

  // 1. Move effects (particle effects, flashes)
  // 2. Pokemon shake/flash on damage
  // 3. HP bar drain animation
  // 4. Status icon appearance
  // 5. Ball throw arc and shake
  // 6. Faint animation (slide down/fade)

  return (
    <div className="animation-layer">
      <MoveEffects moveId={animation.moveId} />
      <DamageFlash target={animation.target} />
    </div>
  );
}

// Example move animation
const MOVE_ANIMATIONS: Record<number, AnimationConfig> = {
  [MOVES.THUNDERBOLT]: {
    sprites: ['lightning', 'spark'],
    sounds: ['thunderbolt'],
    duration: 1000,
    targetFlash: true,
  },
  [MOVES.SURF]: {
    sprites: ['wave', 'splash'],
    sounds: ['surf'],
    duration: 1500,
    screenEffect: 'wave',
  },
  // ... more moves
};
```

## Recommended Simplifications

For a browser implementation:

1. **Skip GBA-specific effects** (scanline effects, hardware blending)
2. **Use CSS animations** for basic effects (shake, flash, fade)
3. **Use canvas/WebGL** for particle effects if needed
4. **Preload sprite sheets** for common animations
5. **Implement ~20 key moves** initially, fallback for others
6. **Use sound sprites** for audio effects

## Key Source Files

| File | Purpose |
|------|---------|
| `battle_anim.c` | Animation bytecode interpreter |
| `battle_anim_scripts.s` | Animation scripts for all moves |
| `data/battle_anim.h` | Animation data tables |
| `constants/battle_anim.h` | Animation constants |

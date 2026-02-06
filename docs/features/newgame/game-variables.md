---
title: Game Variables Reference
status: planned
last_verified: 2026-02-06
---

# Game Variables Reference

## Overview

Game variables are 16-bit unsigned integers stored in `gSaveBlock1Ptr->vars[]`. They track story progression, NPC states, and puzzle states. The script engine reads/writes them via `setvar`, `copyvar`, `addvar`, `compare`.

> C ref: `pokeemerald/include/constants/vars.h`, `pokeemerald/src/event_data.c`

## TypeScript Implementation

```typescript
// src/game/GameVariables.ts
class GameVariablesManager {
  private vars: Map<string, number> = new Map();

  getVar(id: string): number { return this.vars.get(id) ?? 0; }
  setVar(id: string, value: number): void { this.vars.set(id, value); }
  addVar(id: string, delta: number): void { this.setVar(id, this.getVar(id) + delta); }

  // Special variables that read computed values
  getSpecialVar(id: string): number {
    switch (id) {
      case 'VAR_RESULT': return this.getVar('VAR_RESULT');
      case 'VAR_FACING': return /* player facing direction */;
      default: return this.getVar(id);
    }
  }
}
```

## Variables Needed for New Game Flow

### Core Progression Variables

| Variable ID | Hex | Used In | Values |
|------------|-----|---------|--------|
| `VAR_LITTLEROOT_INTRO_STATE` | 0x4092 | InsideOfTruck, LittlerootTown, Player's House | 0=truck, 1=mom greet, 2=go inside, 3=house entry, 4=upstairs, 5=blocked, 6=clock set, 7=free |
| `VAR_LITTLEROOT_TOWN_STATE` | 0x4050 | LittlerootTown | 0=initial, 1=met rival, 3=got pokedex |
| `VAR_BIRCH_LAB_STATE` | 0x4084 | Birch's Lab | 0=initial, 2=chose starter, 3=received, 4=beat rival, 5=got pokedex |
| `VAR_ROUTE101_STATE` | 0x4060 | Route 101 | 0=initial, 1=map name hidden, 2=rescue in progress, 3=done |
| `VAR_LITTLEROOT_RIVAL_STATE` | 0x408D | Rival's House | 0=not met, 2=ready to meet, 3=met, 4=got pokedex |
| `VAR_LITTLEROOT_HOUSES_STATE_BRENDAN` | 0x408C | Brendan's House | 0=initial, 1=on truck, 2=met mom |
| `VAR_LITTLEROOT_HOUSES_STATE_MAY` | 0x4082 | May's House | 0=initial, 1=on truck, 2=met mom |

### Special System Variables

| Variable ID | Hex | Purpose |
|------------|-----|---------|
| `VAR_RESULT` | 0x800C | Return value from specials, comparison results, yes/no answers |
| `VAR_0x8004` - `VAR_0x800B` | Temp | Temporary scratch variables for script use |
| `VAR_FACING` | 0x800A | Player facing direction (computed) |

## Flags Needed for New Game Flow

### NPC Visibility Flags

These flags control whether NPCs appear on maps. When a `FLAG_HIDE_*` flag is SET, the NPC is HIDDEN.

| Flag | Purpose | When Set |
|------|---------|----------|
| `FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE` | Mom outside house | Initially hidden, cleared when truck arrives |
| `FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK` | Truck at Brendan's | Set after truck departs |
| `FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK` | Truck at May's | Set after truck departs |
| `FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_MOM` | Rival's mom | Gender-dependent |
| `FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_SIBLING` | Rival's sibling | Gender-dependent |
| `FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F_POKE_BALL` | Pokeball in room | Gender-dependent |
| `FLAG_HIDE_LITTLEROOT_TOWN_BIRCH` | Birch in town | Cleared when lab scene starts |
| `FLAG_HIDE_LITTLEROOT_TOWN_RIVAL` | Rival in town | Cleared after lab |
| `FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_BIRCH` | Birch in lab | Initially hidden, cleared after rescue |
| `FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG` | Birch's bag | Set after choosing starter |
| `FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE` | Zigzagoon | Set after battle |
| `FLAG_HIDE_ROUTE_101_BOY` | Route 101 NPC | Cleared after getting pokedex |

### System Flags

| Flag | Hex | Purpose |
|------|-----|---------|
| `FLAG_SYS_POKEMON_GET` | 0x860 | Player has obtained a Pokemon |
| `FLAG_RESCUED_BIRCH` | 0x52 | Player saved Birch on Route 101 |
| `FLAG_SET_WALL_CLOCK` | 0x51 | Clock has been set in player's room |
| `FLAG_HIDE_MAP_NAME_POPUP` | varies | Suppress map name display |
| `FLAG_BIRCH_AIDE_MET` | varies | Met lab aide for first time |

### Initial Flag State (New Game)

When starting a new game, `InsideOfTruck_EventScript_SetIntroFlags` sets these based on gender:

**Male Player:**
```
setrespawn HEAL_LOCATION_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F
setvar VAR_LITTLEROOT_INTRO_STATE, 1
setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_MOM
setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK
setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_MOM
setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_SIBLING
setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F_POKE_BALL
setvar VAR_LITTLEROOT_HOUSES_STATE_BRENDAN, 1
```

**Female Player:**
```
setrespawn HEAL_LOCATION_LITTLEROOT_TOWN_MAYS_HOUSE_2F
setvar VAR_LITTLEROOT_INTRO_STATE, 2
setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_MOM
setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK
setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_MOM
setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_SIBLING
setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_2F_POKE_BALL
setvar VAR_LITTLEROOT_HOUSES_STATE_MAY, 1
```

## How Object Visibility Works

> C ref: `pokeemerald/src/event_data.c`, `pokeemerald/src/field_control_avatar.c`

Each object event in map JSON has an optional `flag` field:

```json
{
  "local_id": 1,
  "graphics_id": "OBJ_EVENT_GFX_MOM",
  "flag": "FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE",
  "script": "LittlerootTown_EventScript_Mom"
}
```

**Visibility rule:**
- If `flag` is empty/"0" → NPC always visible
- If `flag` starts with `FLAG_HIDE_` → NPC visible when flag is NOT set, hidden when IS set
- Scripts use `clearflag` to make NPCs appear and `setflag` to make them disappear

The existing `ObjectEventManager` already reads flag fields from map JSON. It just needs to be connected to `GameFlags.isSet()` to actually respect them.

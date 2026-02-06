---
title: Script Engine Design Reference
status: planned
last_verified: 2026-02-06
---

# Script Engine Design Reference

## Overview

The script engine is the single most important missing system. It powers ALL NPC dialogue, cutscenes, story progression, and interactive events throughout the entire game. This document specifies how to build it based on the exact C implementation.

## C Architecture (What We're Porting)

### Source: `pokeemerald/src/script.c` (471 lines)

The GBA uses a bytecode interpreter with this core structure:

```c
struct ScriptContext {
    u8 stackDepth;           // Call stack depth (max 20)
    u8 mode;                 // SCRIPT_MODE_STOPPED, BYTECODE, NATIVE
    u8 comparisonResult;     // For conditional jumps
    u8 (*nativePtr)(void);   // Native function pointer (for waits)
    const u8 *scriptPtr;     // Current instruction pointer
    const u8 *stack[20];     // Call/return stack
    ScrCmdFunc *cmdTable;    // Command function table
    u32 data[4];             // General-purpose data registers
};
```

### Execution Model

```
Each frame:
  ScriptContext_RunScript() called
    → Reads opcode byte from scriptPtr
    → Looks up handler in cmdTable[opcode]
    → Calls handler: bool shouldYield = handler(ctx)
    → If shouldYield: pause until next frame
    → If !shouldYield: execute next command immediately
    → Repeat until yield or end
```

Commands return `TRUE` to yield (pause script), `FALSE` to continue immediately.

**Yield examples**: `lockall`, `waitmovement`, `waitmessage`, `delay`
**Non-yield examples**: `setvar`, `setflag`, `goto`, `end`

## TypeScript Design

### ScriptEngine.ts

```typescript
type ScriptMode = 'stopped' | 'running' | 'waiting';

interface ScriptContext {
  id: string;
  mode: ScriptMode;
  instructionPointer: number;
  commands: ScriptCommand[];      // Pre-parsed command array
  callStack: number[];            // Return addresses (max depth 20)
  comparisonResult: number;       // For conditional jumps
  waitingOn: WaitCondition | null; // What we're waiting for
  data: Record<string, unknown>;  // General-purpose data
}

interface ScriptCommand {
  opcode: string;                 // e.g., 'msgbox', 'setvar', 'applymovement'
  args: (string | number)[];      // Arguments
  label?: string;                 // Optional label for jump targets
}

type WaitCondition =
  | { type: 'movement'; objectId: number }
  | { type: 'message' }
  | { type: 'delay'; framesRemaining: number }
  | { type: 'native'; check: () => boolean }
  | { type: 'door' }
  | { type: 'sound' }
  | { type: 'fadescreen' }
  | { type: 'state' };           // waitstate - generic "wait for callback"
```

### Command Handler Pattern

```typescript
type CommandHandler = (
  ctx: ScriptContext,
  engine: ScriptEngine
) => boolean; // true = yield, false = continue

// Registration:
engine.registerCommand('setvar', (ctx, engine) => {
  const varId = ctx.commands[ctx.instructionPointer].args[0] as string;
  const value = ctx.commands[ctx.instructionPointer].args[1] as number;
  engine.gameVariables.setVar(varId, value);
  ctx.instructionPointer++;
  return false; // Don't yield
});

engine.registerCommand('msgbox', (ctx, engine) => {
  const text = ctx.commands[ctx.instructionPointer].args[0] as string;
  const type = ctx.commands[ctx.instructionPointer].args[1] as string;
  engine.dialogSystem.showMessage(text, type);
  ctx.instructionPointer++;
  ctx.waitingOn = { type: 'message' };
  return true; // Yield until message dismissed
});
```

### Multiple Concurrent Scripts

The GBA runs multiple script contexts simultaneously:
- Map ON_FRAME scripts check conditions every frame
- NPC interaction scripts run when player presses A
- Trigger scripts fire when stepping on coord_events

```typescript
class ScriptEngine {
  private contexts: Map<string, ScriptContext> = new Map();

  // Called every game frame
  update(): void {
    for (const [id, ctx] of this.contexts) {
      if (ctx.mode === 'waiting' && this.checkWaitCondition(ctx)) {
        ctx.mode = 'running';
        ctx.waitingOn = null;
      }
      if (ctx.mode === 'running') {
        this.executeUntilYield(ctx);
      }
    }
  }
}
```

## MVP Command Set (30 Commands)

### Control Flow
| Command | C Function | Yields | Description |
|---------|-----------|--------|-------------|
| `end` | `ScrCmd_end` | N/A | Stop script execution |
| `return` | `ScrCmd_return` | No | Pop call stack, return to caller |
| `goto <label>` | `ScrCmd_goto` | No | Unconditional jump |
| `call <label>` | `ScrCmd_call` | No | Push return addr, jump to label |
| `goto_if_eq <var> <val> <label>` | `ScrCmd_goto_if` | No | Jump if variable == value |
| `goto_if_ne <var> <val> <label>` | `ScrCmd_goto_if` | No | Jump if variable != value |
| `goto_if_lt <var> <val> <label>` | `ScrCmd_goto_if` | No | Jump if variable < value |
| `goto_if_ge <var> <val> <label>` | `ScrCmd_goto_if` | No | Jump if variable >= value |

### Variables & Flags
| Command | C Function | Yields | Description |
|---------|-----------|--------|-------------|
| `setvar <var> <val>` | `ScrCmd_setvar` | No | Set variable to value |
| `copyvar <dst> <src>` | `ScrCmd_copyvar` | No | Copy variable |
| `addvar <var> <val>` | `ScrCmd_addvar` | No | Add to variable |
| `compare <var> <val>` | `ScrCmd_compare` | No | Set comparison result |
| `setflag <flag>` | `ScrCmd_setflag` | No | Set game flag |
| `clearflag <flag>` | `ScrCmd_clearflag` | No | Clear game flag |
| `checkflag <flag>` | `ScrCmd_checkflag` | No | Check flag, set VAR_RESULT |
| `checkplayergender` | `ScrCmd_checkplayergender` | No | Set VAR_RESULT to gender |

### NPC Movement
| Command | C Function | Yields | Description |
|---------|-----------|--------|-------------|
| `applymovement <localId> <movScript>` | `ScrCmd_applymovement` | No | Start NPC movement |
| `waitmovement <localId>` | `ScrCmd_waitmovement` | **Yes** | Wait for movement done |
| `turnobject <localId> <dir>` | `ScrCmd_turnobject` | No | Face NPC in direction |
| `setobjectxy <localId> <x> <y>` | `ScrCmd_setobjectxy` | No | Teleport NPC (temp) |
| `setobjectxyperm <localId> <x> <y>` | `ScrCmd_setobjectxyperm` | No | Teleport NPC (permanent) |
| `addobject <localId>` | `ScrCmd_addobject` | No | Spawn NPC |
| `removeobject <localId>` | `ScrCmd_removeobject` | No | Despawn NPC |

### Dialogue
| Command | C Function | Yields | Description |
|---------|-----------|--------|-------------|
| `msgbox <text> <type>` | Macro (call + message + waitmessage) | **Yes** | Show message box |
| `message <text>` | `ScrCmd_message` | No | Display text (no wait) |
| `waitmessage` | `ScrCmd_waitmessage` | **Yes** | Wait for text completion |
| `closemessage` | `ScrCmd_closemessage` | No | Hide text box |
| `lockall` | `ScrCmd_lockall` | **Yes** | Freeze all NPCs + player |
| `releaseall` | `ScrCmd_releaseall` | No | Unfreeze all |

### World
| Command | C Function | Yields | Description |
|---------|-----------|--------|-------------|
| `warp <map> <x> <y>` | `ScrCmd_warp` | **Yes** | Warp with fade |
| `fadescreen <mode>` | `ScrCmd_fadescreen` | **Yes** | Fade to/from black |
| `delay <frames>` | `ScrCmd_delay` | **Yes** | Pause N frames |
| `playse <soundId>` | `ScrCmd_playse` | No | Play sound effect |
| `special <funcName>` | `ScrCmd_special` | No/Yes | Call C special function |

## Movement Script Format

Movement scripts are separate from main scripts. They control NPC walk paths.

```typescript
interface MovementCommand {
  action: MovementAction;
  // Each action takes exactly 16 frames (one tile movement) unless noted
}

type MovementAction =
  | 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right'
  | 'walk_fast_down' | 'walk_fast_up' | 'walk_fast_left' | 'walk_fast_right'
  | 'walk_in_place_down' | 'walk_in_place_up' | 'walk_in_place_left' | 'walk_in_place_right'
  | 'walk_in_place_faster_down' | 'walk_in_place_faster_up' | 'walk_in_place_faster_left' | 'walk_in_place_faster_right'
  | 'jump_down' | 'jump_up' | 'jump_left' | 'jump_right'
  | 'delay_16' | 'delay_8' | 'delay_4'
  | 'step_end';
```

### Timing (from C source)
- Normal walk: 16 frames per tile
- Fast walk: 8 frames per tile
- Walk in place: 8 frames for direction animation
- Walk in place faster: 4 frames
- Jump: 16 frames, arc trajectory

## Script Data Format

Scripts from `.inc` files should be pre-compiled to JSON:

```json
{
  "InsideOfTruck_EventScript_TruckArrival": {
    "commands": [
      { "opcode": "lockall" },
      { "opcode": "applymovement", "args": ["LOCALID_PLAYER", "InsideOfTruck_Movement_PlayerTurnInPlace"] },
      { "opcode": "waitmovement", "args": [0] },
      { "opcode": "playse", "args": ["SE_TRUCK_DOOR"] },
      { "opcode": "special", "args": ["BeginTruckUnload"] },
      { "opcode": "waitstate" },
      { "opcode": "clearflag", "args": ["FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE"] },
      { "opcode": "setflag", "args": ["FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK"] },
      { "opcode": "setvar", "args": ["VAR_LITTLEROOT_INTRO_STATE", 1] },
      { "opcode": "warp", "args": ["MAP_LITTLEROOT_TOWN", 4, 10] },
      { "opcode": "waitstate" },
      { "opcode": "releaseall" },
      { "opcode": "end" }
    ]
  },
  "InsideOfTruck_Movement_PlayerTurnInPlace": {
    "movements": [
      "walk_in_place_faster_down",
      "walk_in_place_faster_left",
      "walk_in_place_faster_down",
      "delay_16", "delay_16", "delay_16",
      "step_end"
    ]
  }
}
```

## Map Script Hook System

Each map defines scripts triggered at specific lifecycle points:

```typescript
interface MapScriptConfig {
  onLoad?: string;           // Script label to run on map load
  onTransition?: string;     // Script label during transition
  onResume?: string;         // Script label when returning to field
  onWarpInto?: Array<{       // Conditional table
    var: string;
    value: number;
    script: string;
  }>;
  onFrame?: Array<{          // Checked every frame
    var: string;
    value: number;
    script: string;
  }>;
}
```

### How ON_FRAME Works (Critical)

```
Every frame:
  For each entry in ON_FRAME table:
    If variable matches value AND no script running:
      Start script
      (Script should change the variable to prevent re-triggering)
```

This is how the intro sequence auto-triggers: when `VAR_LITTLEROOT_INTRO_STATE == 1` and you're on LittlerootTown, the Mom greeting script fires automatically.

## Integration Points

The script engine needs access to:
1. **GameVariables** — `setvar`, `compare`, conditionals
2. **GameFlags** — `setflag`, `clearflag`, `checkflag`
3. **DialogContext** — `msgbox`, `message`, `closemessage`
4. **ObjectEventManager** — `addobject`, `removeobject`, `applymovement`
5. **NPCMovementEngine** — movement execution
6. **WorldManager** — `warp`, map loading
7. **FadeController** — `fadescreen`
8. **PlayerController** — `lockall`, `releaseall`, freeze/unfreeze
9. **Audio system** — `playse`, `playbgm`

## Build Script Option

For scalability, consider a build-time script that parses `.inc` files:

```
scripts/parse-map-scripts.ts
  Input: public/pokeemerald/data/maps/*/scripts.inc
  Output: src/data/mapScripts.json
```

This avoids hand-translating every script and ensures accuracy with the C source. For MVP, hand-translate the ~10 scripts needed for new game flow.

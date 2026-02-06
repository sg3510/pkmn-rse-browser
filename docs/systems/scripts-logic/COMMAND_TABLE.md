---
title: Script Command Table
status: reference
last_verified: 2026-01-13
---

# Script Command Table

Complete reference of all 227 script commands in Pokemon Emerald.

## Source File
`public/pokeemerald/data/script_cmd_table.inc`

## Command Format

Each command has:
- **Opcode**: Single byte (0x00 - 0xE2)
- **Arguments**: Variable length, read by handler
- **Return**: `TRUE` = yield/wait, `FALSE` = continue

## Command Categories

### Flow Control (0x00 - 0x0D)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x00 | `nop` | - | No operation |
| 0x01 | `nop1` | - | No operation |
| 0x02 | `end` | - | Stop script execution |
| 0x03 | `return` | - | Return from call |
| 0x04 | `call` | ptr:4 | Call subroutine |
| 0x05 | `goto` | ptr:4 | Jump to address |
| 0x06 | `goto_if` | cond:1, ptr:4 | Conditional jump |
| 0x07 | `call_if` | cond:1, ptr:4 | Conditional call |
| 0x08 | `gotostd` | idx:1 | Jump to standard script |
| 0x09 | `callstd` | idx:1 | Call standard script |
| 0x0A | `gotostd_if` | cond:1, idx:1 | Conditional std jump |
| 0x0B | `callstd_if` | cond:1, idx:1 | Conditional std call |
| 0x0C | `returnram` | - | Return to RAM script address |
| 0x0D | `endram` | - | Clear RAM script, end |

### Condition Values

```c
// For goto_if, call_if, etc.
#define COND_LESS    0  // <
#define COND_EQUAL   1  // ==
#define COND_GREATER 2  // >
#define COND_LEQUAL  3  // <=
#define COND_GEQUAL  4  // >=
#define COND_NEQUAL  5  // !=
```

### Data Operations (0x0F - 0x22)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x0F | `loadword` | idx:1, val:4 | Load word to local[idx] |
| 0x10 | `loadbyte` | idx:1, val:1 | Load byte to local[idx] |
| 0x11 | `setptr` | val:1, ptr:4 | Store byte at pointer |
| 0x12 | `loadbytefromptr` | idx:1, ptr:4 | Load from pointer |
| 0x13 | `setptrbyte` | idx:1, ptr:4 | Store local[idx] at pointer |
| 0x14 | `copylocal` | dst:1, src:1 | Copy local variable |
| 0x15 | `copybyte` | dst:4, src:4 | Copy byte pointer to pointer |
| 0x16 | `setvar` | var:2, val:2 | Set game variable |
| 0x17 | `addvar` | var:2, val:2 | Add to variable |
| 0x18 | `subvar` | var:2, val:2 | Subtract from variable |
| 0x19 | `copyvar` | dst:2, src:2 | Copy variable |
| 0x1A | `setorcopyvar` | dst:2, src:2 | Set or copy (evaluates src) |

### Comparison (0x1B - 0x22)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x1B | `compare_local_to_local` | a:1, b:1 | Compare locals |
| 0x1C | `compare_local_to_value` | a:1, b:4 | Compare local to constant |
| 0x1D | `compare_local_to_ptr` | a:1, ptr:4 | Compare local to memory |
| 0x1E | `compare_ptr_to_local` | ptr:4, b:1 | Compare memory to local |
| 0x1F | `compare_ptr_to_value` | ptr:4, val:4 | Compare memory to constant |
| 0x20 | `compare_ptr_to_ptr` | a:4, b:4 | Compare memory to memory |
| 0x21 | `compare_var_to_value` | var:2, val:2 | Compare variable to constant |
| 0x22 | `compare_var_to_var` | a:2, b:2 | Compare variables |

**Comparison sets `comparisonResult`**: 0=less, 1=equal, 2=greater

### Native Calls (0x23 - 0x27)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x23 | `callnative` | ptr:4 | Call C function |
| 0x24 | `gotonative` | ptr:4 | Jump to C function |
| 0x25 | `special` | idx:2 | Call special function |
| 0x26 | `specialvar` | var:2, idx:2 | Call special, store result |
| 0x27 | `waitstate` | - | **Yield** until resumed |

### Timing (0x28)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x28 | `delay` | frames:2 | Wait N frames |

### Flags (0x29 - 0x2B)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x29 | `setflag` | flag:2 | Set flag TRUE |
| 0x2A | `clearflag` | flag:2 | Set flag FALSE |
| 0x2B | `checkflag` | flag:2 | Check flag → VAR_RESULT |

### Sound (0x2F - 0x38)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x2F | `playse` | se:2 | Play sound effect |
| 0x30 | `waitse` | - | **Wait** for SE |
| 0x31 | `playfanfare` | mus:2 | Play fanfare |
| 0x32 | `waitfanfare` | - | **Wait** for fanfare |
| 0x33 | `playbgm` | mus:2, save:1 | Play BGM |
| 0x34 | `savebgm` | mus:2 | Save current BGM |
| 0x35 | `fadedefaultbgm` | - | Fade to default |
| 0x36 | `fadenewbgm` | mus:2 | Fade to new BGM |
| 0x37 | `fadeoutbgm` | speed:1 | Fade out |
| 0x38 | `fadeinbgm` | speed:1 | Fade in |

### Warp (0x39 - 0x41)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x39 | `warp` | map:2, warp:1, x:2, y:2 | Warp to map |
| 0x3A | `warpsilent` | map:2, warp:1, x:2, y:2 | Silent warp |
| 0x3B | `warpdoor` | map:2, warp:1, x:2, y:2 | Door warp |
| 0x3C | `warphole` | map:2 | Fall warp |
| 0x3D | `warpteleport` | map:2, warp:1, x:2, y:2 | Teleport warp |
| 0x3E | `setwarp` | map:2, warp:1, x:2, y:2 | Set warp destination |
| 0x3F | `setdynamicwarp` | map:2, warp:1, x:2, y:2 | Set dynamic warp |
| 0x40 | `setdivewarp` | map:2, warp:1, x:2, y:2 | Set dive warp |
| 0x41 | `setholewarp` | map:2, warp:1, x:2, y:2 | Set hole warp |

### Object/NPC Movement (0x4F - 0x65)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x4F | `applymovement` | localId:2, ptr:4 | Apply movement script |
| 0x50 | `applymovementat` | localId:2, ptr:4, map:2 | Movement on map |
| 0x51 | `waitmovement` | localId:2 | **Wait** for movement |
| 0x52 | `waitmovementat` | localId:2, map:2 | Wait movement on map |
| 0x53 | `removeobject` | localId:2 | Remove object |
| 0x54 | `removeobjectat` | localId:2, map:2 | Remove on map |
| 0x55 | `addobject` | localId:2 | Add object |
| 0x56 | `addobjectat` | localId:2, map:2 | Add on map |
| 0x57 | `setobjectxy` | localId:2, x:2, y:2 | Set position |
| 0x58 | `showobjectat` | localId:2, map:2 | Show object |
| 0x59 | `hideobjectat` | localId:2, map:2 | Hide object |
| 0x5A | `faceplayer` | - | NPC faces player |
| 0x5B | `turnobject` | localId:2, dir:1 | Turn object |
| 0x63 | `setobjectxyperm` | localId:2, x:2, y:2 | Set permanent position |
| 0x65 | `setobjectmovementtype` | localId:2, type:1 | Set movement type |

### Message (0x66 - 0x6D)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x66 | `waitmessage` | - | **Wait** for message |
| 0x67 | `message` | ptr:4 | Show message (no wait) |
| 0x68 | `closemessage` | - | Close message box |
| 0x69 | `lockall` | - | Lock all NPCs |
| 0x6A | `lock` | - | Lock current NPC |
| 0x6B | `releaseall` | - | Release all |
| 0x6C | `release` | - | Release current |
| 0x6D | `waitbuttonpress` | - | **Wait** for A/B |

### Menu/Choice (0x6E - 0x76)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x6E | `yesnobox` | x:1, y:1 | Show yes/no box |
| 0x6F | `multichoice` | x:1, y:1, listId:1, canB:1 | Multiple choice |
| 0x70 | `multichoicedefault` | x:1, y:1, listId:1, default:1, canB:1 | With default |
| 0x71 | `multichoicegrid` | x:1, y:1, listId:1, cols:1, canB:1 | Grid layout |
| 0x72 | `drawbox` | left:1, top:1, right:1, bot:1 | Draw text box |
| 0x73 | `erasebox` | left:1, top:1, right:1, bot:1 | Erase box |
| 0x75 | `showmonpic` | species:2, x:1, y:1 | Show Pokemon pic |
| 0x76 | `hidemonpic` | - | Hide Pokemon pic |

### Pokemon (0x79 - 0x7C)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x79 | `givemon` | species:2, lvl:1, item:2 | Give Pokemon |
| 0x7A | `giveegg` | species:2 | Give egg |
| 0x7B | `setmonmove` | slot:1, moveSlot:1, move:2 | Set move |
| 0x7C | `checkpartymove` | move:2 | Check party for move |

### Buffer Strings (0x7D - 0x85)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x7D | `bufferspeciesname` | buf:1, species:2 | Buffer species name |
| 0x7E | `bufferleadmonspeciesname` | buf:1 | Buffer lead mon name |
| 0x7F | `bufferpartymonnick` | buf:1, slot:2 | Buffer party nickname |
| 0x80 | `bufferitemname` | buf:1, item:2 | Buffer item name |
| 0x81 | `bufferdecorationname` | buf:1, decor:2 | Buffer decoration |
| 0x82 | `buffermovename` | buf:1, move:2 | Buffer move name |
| 0x83 | `buffernumberstring` | buf:1, val:2 | Buffer number |
| 0x84 | `bufferstdstring` | buf:1, idx:2 | Buffer standard string |
| 0x85 | `bufferstring` | buf:1, ptr:4 | Buffer string pointer |

### Screen Effects (0x97 - 0x9E)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0x97 | `fadescreen` | mode:1 | Fade screen |
| 0x98 | `fadescreenspeed` | mode:1, speed:1 | Fade with speed |
| 0x9C | `dofieldeffect` | effectId:2 | Run field effect |
| 0x9D | `setfieldeffectargument` | idx:1, val:2 | Set effect arg |
| 0x9E | `waitfieldeffect` | effectId:2 | **Wait** for effect |

### Misc (0xA0 - 0xE2)

| Op | Name | Args | Description |
|----|------|------|-------------|
| 0xA0 | `checkplayergender` | - | Check gender → VAR_RESULT |
| 0xA1 | `playmoncry` | species:2, mode:1 | Play Pokemon cry |
| 0xA2 | `setmetatile` | x:2, y:2, tile:2, attr:2 | Change map tile |
| 0xA7 | `setmaplayoutindex` | layout:2 | Change map layout |
| 0xB6 | `setwildbattle` | species:2, lvl:1, item:2 | Set wild battle |
| 0xB7 | `dowildbattle` | - | Start wild battle |
| 0xC5 | `waitmoncry` | - | **Wait** for cry |

## Yield Commands

Commands that **yield** execution (return TRUE):

- `waitstate` (0x27)
- `delay` (0x28)
- `waitse` (0x30)
- `waitfanfare` (0x32)
- `waitmovement` (0x51)
- `waitmessage` (0x66)
- `waitbuttonpress` (0x6D)
- `waitfieldeffect` (0x9E)
- `waitmoncry` (0xC5)

## TypeScript Command Handler Example

```typescript
type CommandHandler = (ctx: ScriptContext) => boolean | Promise<boolean>;

const commands: Map<number, CommandHandler> = new Map([
  // 0x02: end
  [0x02, (ctx) => {
    ctx.mode = 'stopped';
    return false;
  }],

  // 0x05: goto ptr
  [0x05, (ctx) => {
    ctx.scriptPtr = readWord(ctx);
    return false;
  }],

  // 0x16: setvar var, value
  [0x16, (ctx) => {
    const varId = readHalfword(ctx);
    const value = readHalfword(ctx);
    gameVars.set(varId, value);
    return false;
  }],

  // 0x27: waitstate
  [0x27, (ctx) => {
    return true; // Yield
  }],

  // 0x29: setflag flag
  [0x29, (ctx) => {
    const flagId = readHalfword(ctx);
    gameFlags.set(flagId);
    return false;
  }],

  // 0x67: message ptr
  [0x67, async (ctx) => {
    const textPtr = readWord(ctx);
    const text = await loadText(textPtr);
    messageBox.show(text);
    return false; // Don't yield, message continues in background
  }],
]);
```

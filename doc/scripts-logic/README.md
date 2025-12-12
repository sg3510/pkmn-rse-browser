# Script Engine Documentation

Deep dive into Pokemon Emerald's script engine and how to implement a TypeScript interpreter for the browser.

## Table of Contents

1. [Engine Overview](#engine-overview)
2. [Architecture](#architecture)
3. [Key Files](#key-files)
4. [Implementation Strategy](#implementation-strategy)

## Engine Overview

Pokemon Emerald uses a **bytecode interpreter** for event scripts. Scripts are written in GAS assembly macros (`.inc` files), compiled to bytecode, and executed by a virtual machine in C.

### Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│                    SCRIPT SYSTEM                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ .inc files  │───▶│   Assembler  │───▶│   Bytecode    │  │
│  │ (macros)    │    │              │    │   (ROM data)  │  │
│  └─────────────┘    └──────────────┘    └───────┬───────┘  │
│                                                  │          │
│                                                  ▼          │
│                                         ┌───────────────┐   │
│                                         │  Interpreter  │   │
│                                         │  (script.c)   │   │
│                                         └───────┬───────┘   │
│                                                  │          │
│                     ┌────────────────────────────┼────────┐ │
│                     │                            │        │ │
│                     ▼                            ▼        │ │
│           ┌─────────────────┐          ┌──────────────┐   │ │
│           │  Script Commands│          │   Specials   │   │ │
│           │  (scrcmd.c)     │          │   (C funcs)  │   │ │
│           └─────────────────┘          └──────────────┘   │ │
│                                                           │ │
└───────────────────────────────────────────────────────────┘
```

## Architecture

### Script Context Structure

From `include/script.h`:

```c
struct ScriptContext {
    u8 stackDepth;          // Call stack depth (max 20)
    u8 mode;                // STOPPED, BYTECODE, or NATIVE
    u8 comparisonResult;    // Result of last compare (0=<, 1==, 2=>)
    u8 (*nativePtr)(void);  // Pointer to native C function
    const u8 *scriptPtr;    // Current position in bytecode
    const u8 *stack[20];    // Call stack for subroutines
    ScrCmdFunc *cmdTable;   // Command handler table
    ScrCmdFunc *cmdTableEnd;// End of command table
    u32 data[4];            // Local storage (4 words)
};
```

### Execution Modes

| Mode | Description |
|------|-------------|
| `SCRIPT_MODE_STOPPED` | Not running |
| `SCRIPT_MODE_BYTECODE` | Executing script bytecode |
| `SCRIPT_MODE_NATIVE` | Executing native C function |

### Global vs Immediate Contexts

- **Global Context**: Main script context, yields on `wait*` commands
- **Immediate Context**: Runs to completion without yielding (map scripts)

## Key Files

See individual documentation:

| File | Description |
|------|-------------|
| [SCRIPT_ENGINE.md](./SCRIPT_ENGINE.md) | Core interpreter (script.c) |
| [COMMAND_TABLE.md](./COMMAND_TABLE.md) | All 227 script commands |
| [TRIGGERS.md](./TRIGGERS.md) | How scripts are triggered |
| [SPECIALS.md](./SPECIALS.md) | Special C functions |
| [TYPESCRIPT_DESIGN.md](./TYPESCRIPT_DESIGN.md) | TypeScript implementation |

## Implementation Strategy

### Option 1: Bytecode Interpreter (Recommended)

Parse actual compiled bytecode and interpret it:

```typescript
class ScriptInterpreter {
  private pc: number = 0;           // Program counter
  private stack: number[] = [];      // Call stack
  private vars: Map<number, number>; // Game variables
  private flags: Set<number>;        // Game flags

  async execute(bytecode: Uint8Array): Promise<void> {
    while (this.pc < bytecode.length) {
      const opcode = bytecode[this.pc++];
      const handler = this.commands[opcode];

      const shouldYield = await handler(this);
      if (shouldYield) {
        return; // Wait for callback to resume
      }
    }
  }
}
```

**Pros:**
- Exact behavior matching
- Can load ROM scripts directly
- Future-proof

**Cons:**
- Requires bytecode extraction
- More complex to implement

### Option 2: High-Level Script Parser

Parse the `.inc` source files directly:

```typescript
class ScriptParser {
  parseScript(incContent: string): Script {
    const lines = incContent.split('\n');
    const commands: Command[] = [];

    for (const line of lines) {
      const cmd = this.parseCommand(line);
      if (cmd) commands.push(cmd);
    }

    return { commands };
  }
}
```

**Pros:**
- Easier to implement
- Human-readable
- Can modify scripts easily

**Cons:**
- May miss edge cases
- Need to handle macros

### Option 3: Hybrid Approach (Recommended for Browser)

Pre-compile scripts to JSON, interpret at runtime:

```typescript
// Build time: Convert .inc to JSON
{
  "label": "Route101_EventScript_Boy",
  "commands": [
    { "op": "msgbox", "args": ["Route101_Text_WildPokemonInTallGrass", "MSGBOX_NPC"] }
  ]
}

// Runtime: Interpret JSON
class ScriptRunner {
  async run(script: CompiledScript): Promise<void> {
    for (const cmd of script.commands) {
      await this.executeCommand(cmd);
    }
  }
}
```

**Pros:**
- Best of both worlds
- Fast runtime execution
- Easy debugging

**Cons:**
- Requires build step

## Quick Start

For a minimal implementation, see:

1. [TYPESCRIPT_DESIGN.md](./TYPESCRIPT_DESIGN.md) - Full architecture
2. [COMMAND_TABLE.md](./COMMAND_TABLE.md) - Command reference
3. [TRIGGERS.md](./TRIGGERS.md) - When scripts run

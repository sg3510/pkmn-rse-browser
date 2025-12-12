# Script Engine Implementation

Deep dive into `src/script.c` - the core script interpreter.

## Source File
`public/pokeemerald/src/script.c`

## Core Data Structures

### ScriptContext

```c
struct ScriptContext {
    u8 stackDepth;          // 0-19, call stack depth
    u8 mode;                // Execution mode
    u8 comparisonResult;    // 0=less, 1=equal, 2=greater
    u8 (*nativePtr)(void);  // Native function pointer
    const u8 *scriptPtr;    // Current bytecode position
    const u8 *stack[20];    // Return address stack
    ScrCmdFunc *cmdTable;   // Command handlers
    ScrCmdFunc *cmdTableEnd;// End marker
    u32 data[4];            // Local variables
};
```

### Execution Modes

```c
enum {
    SCRIPT_MODE_STOPPED,    // Not running
    SCRIPT_MODE_BYTECODE,   // Running bytecode
    SCRIPT_MODE_NATIVE,     // Running C function
};
```

### Context States

```c
enum {
    CONTEXT_RUNNING,        // Actively executing
    CONTEXT_WAITING,        // Paused (wait command)
    CONTEXT_SHUTDOWN,       // Finished
};
```

## Core Functions

### InitScriptContext

Initializes a script context:

```c
void InitScriptContext(struct ScriptContext *ctx, void *cmdTable, void *cmdTableEnd)
{
    ctx->mode = SCRIPT_MODE_STOPPED;
    ctx->scriptPtr = NULL;
    ctx->stackDepth = 0;
    ctx->nativePtr = NULL;
    ctx->cmdTable = cmdTable;
    ctx->cmdTableEnd = cmdTableEnd;

    // Clear local data
    for (i = 0; i < ARRAY_COUNT(ctx->data); i++)
        ctx->data[i] = 0;

    // Clear stack
    for (i = 0; i < ARRAY_COUNT(ctx->stack); i++)
        ctx->stack[i] = NULL;
}
```

### SetupBytecodeScript

Starts executing a bytecode script:

```c
u8 SetupBytecodeScript(struct ScriptContext *ctx, const u8 *ptr)
{
    ctx->scriptPtr = ptr;
    ctx->mode = SCRIPT_MODE_BYTECODE;
    return 1;
}
```

### RunScriptCommand

**The main execution loop** - executes one or more commands:

```c
bool8 RunScriptCommand(struct ScriptContext *ctx)
{
    if (ctx->mode == SCRIPT_MODE_STOPPED)
        return FALSE;

    switch (ctx->mode)
    {
    case SCRIPT_MODE_NATIVE:
        // Call native function
        if (ctx->nativePtr && ctx->nativePtr() == TRUE)
            ctx->mode = SCRIPT_MODE_BYTECODE;
        return TRUE;

    case SCRIPT_MODE_BYTECODE:
        while (1)
        {
            // Read opcode
            u8 cmdCode = *(ctx->scriptPtr++);

            // Get handler from table
            ScrCmdFunc *func = &ctx->cmdTable[cmdCode];

            // Bounds check
            if (func >= ctx->cmdTableEnd)
            {
                ctx->mode = SCRIPT_MODE_STOPPED;
                return FALSE;
            }

            // Execute command
            // Return TRUE = yield (wait), FALSE = continue
            if ((*func)(ctx) == TRUE)
                return TRUE;
        }
    }
    return TRUE;
}
```

**Key insight**: Commands return `TRUE` to yield execution (for waits), `FALSE` to continue immediately.

### Reading Bytecode Values

```c
// Read single byte (inline macro)
#define ScriptReadByte(ctx) (*(ctx->scriptPtr++))

// Read 16-bit value (little-endian)
u16 ScriptReadHalfword(struct ScriptContext *ctx)
{
    u16 value = *(ctx->scriptPtr++);
    value |= *(ctx->scriptPtr++) << 8;
    return value;
}

// Read 32-bit value (little-endian)
u32 ScriptReadWord(struct ScriptContext *ctx)
{
    u32 value0 = *(ctx->scriptPtr++);
    u32 value1 = *(ctx->scriptPtr++);
    u32 value2 = *(ctx->scriptPtr++);
    u32 value3 = *(ctx->scriptPtr++);
    return (((((value3 << 8) + value2) << 8) + value1) << 8) + value0;
}
```

### Stack Operations

```c
// Push return address
static bool8 ScriptPush(struct ScriptContext *ctx, const u8 *ptr)
{
    if (ctx->stackDepth >= 20)
        return TRUE; // Stack overflow
    ctx->stack[ctx->stackDepth++] = ptr;
    return FALSE;
}

// Pop return address
static const u8 *ScriptPop(struct ScriptContext *ctx)
{
    if (ctx->stackDepth == 0)
        return NULL;
    return ctx->stack[--ctx->stackDepth];
}
```

### Control Flow

```c
// Jump (goto)
void ScriptJump(struct ScriptContext *ctx, const u8 *ptr)
{
    ctx->scriptPtr = ptr;
}

// Call (with return)
void ScriptCall(struct ScriptContext *ctx, const u8 *ptr)
{
    ScriptPush(ctx, ctx->scriptPtr);
    ctx->scriptPtr = ptr;
}

// Return from call
void ScriptReturn(struct ScriptContext *ctx)
{
    ctx->scriptPtr = ScriptPop(ctx);
}
```

## Global Script Context

The game uses two contexts:

### sGlobalScriptContext

Main script context for NPC interactions, events, etc.

```c
static struct ScriptContext sGlobalScriptContext;
static u8 sGlobalScriptContextStatus; // RUNNING, WAITING, or SHUTDOWN

// Setup and start a script
void ScriptContext_SetupScript(const u8 *ptr)
{
    InitScriptContext(&sGlobalScriptContext, gScriptCmdTable, gScriptCmdTableEnd);
    SetupBytecodeScript(&sGlobalScriptContext, ptr);
    LockPlayerFieldControls();
    sGlobalScriptContextStatus = CONTEXT_RUNNING;
}

// Run one frame of script execution
bool8 ScriptContext_RunScript(void)
{
    if (sGlobalScriptContextStatus != CONTEXT_RUNNING)
        return FALSE;

    LockPlayerFieldControls();

    if (!RunScriptCommand(&sGlobalScriptContext))
    {
        sGlobalScriptContextStatus = CONTEXT_SHUTDOWN;
        UnlockPlayerFieldControls();
        return FALSE;
    }

    return TRUE;
}

// Pause execution (called by wait commands)
void ScriptContext_Stop(void)
{
    sGlobalScriptContextStatus = CONTEXT_WAITING;
}

// Resume execution
void ScriptContext_Enable(void)
{
    sGlobalScriptContextStatus = CONTEXT_RUNNING;
    LockPlayerFieldControls();
}
```

### sImmediateScriptContext

For scripts that must run to completion immediately (map scripts):

```c
static struct ScriptContext sImmediateScriptContext;

void RunScriptImmediately(const u8 *ptr)
{
    InitScriptContext(&sImmediateScriptContext, gScriptCmdTable, gScriptCmdTableEnd);
    SetupBytecodeScript(&sImmediateScriptContext, ptr);

    // Run until complete (no yielding)
    while (RunScriptCommand(&sImmediateScriptContext) == TRUE);
}
```

## Map Script Handling

### Script Types

```c
// From constants/map_scripts.h
#define MAP_SCRIPT_ON_LOAD              1  // When tiles load
#define MAP_SCRIPT_ON_FRAME_TABLE       2  // Per-frame checks
#define MAP_SCRIPT_ON_TRANSITION        3  // On map enter
#define MAP_SCRIPT_ON_WARP_INTO_MAP_TABLE 4 // On warp
#define MAP_SCRIPT_ON_RESUME            5  // After battle/menu
#define MAP_SCRIPT_ON_RETURN_TO_FIELD   6  // Return from special
#define MAP_SCRIPT_ON_DIVE_WARP         7  // Dive transitions
```

### Getting Map Scripts

```c
u8 *MapHeaderGetScriptTable(u8 tag)
{
    const u8 *mapScripts = gMapHeader.mapScripts;

    if (!mapScripts)
        return NULL;

    while (1)
    {
        if (!*mapScripts)
            return NULL;  // End of table

        if (*mapScripts == tag)
        {
            mapScripts++;
            return T2_READ_PTR(mapScripts);  // Read 4-byte pointer
        }
        mapScripts += 5;  // Skip: 1 byte type + 4 byte pointer
    }
}
```

### Frame Table Check

For `MAP_SCRIPT_ON_FRAME_TABLE` - checks conditions each frame:

```c
u8 *MapHeaderCheckScriptTable(u8 tag)
{
    u8 *ptr = MapHeaderGetScriptTable(tag);
    if (!ptr)
        return NULL;

    while (1)
    {
        u16 varIndex1 = T1_READ_16(ptr);
        if (!varIndex1)
            return NULL;  // End of table (.2byte 0)
        ptr += 2;

        u16 varIndex2 = T1_READ_16(ptr);
        ptr += 2;

        // If VAR1 == VAR2, run this script
        if (VarGet(varIndex1) == VarGet(varIndex2))
            return T2_READ_PTR(ptr);

        ptr += 4;  // Skip pointer
    }
}
```

### Running Map Scripts

```c
void RunOnLoadMapScript(void)
{
    MapHeaderRunScriptType(MAP_SCRIPT_ON_LOAD);
}

void RunOnTransitionMapScript(void)
{
    MapHeaderRunScriptType(MAP_SCRIPT_ON_TRANSITION);
}

bool8 TryRunOnFrameMapScript(void)
{
    u8 *ptr = MapHeaderCheckScriptTable(MAP_SCRIPT_ON_FRAME_TABLE);
    if (!ptr)
        return FALSE;

    ScriptContext_SetupScript(ptr);  // Uses global context
    return TRUE;
}
```

## TypeScript Equivalent

```typescript
interface ScriptContext {
  stackDepth: number;
  mode: 'stopped' | 'bytecode' | 'native';
  comparisonResult: number;  // 0, 1, or 2
  scriptPtr: number;         // Index into bytecode
  stack: number[];           // Return addresses
  data: number[];            // Local storage
}

class ScriptEngine {
  private ctx: ScriptContext;
  private bytecode: Uint8Array;
  private commands: Map<number, CommandHandler>;

  async run(): Promise<boolean> {
    if (this.ctx.mode === 'stopped') return false;

    while (true) {
      const opcode = this.readByte();
      const handler = this.commands.get(opcode);

      if (!handler) {
        this.ctx.mode = 'stopped';
        return false;
      }

      const shouldYield = await handler(this.ctx);
      if (shouldYield) return true;
    }
  }

  private readByte(): number {
    return this.bytecode[this.ctx.scriptPtr++];
  }

  private readHalfword(): number {
    const lo = this.bytecode[this.ctx.scriptPtr++];
    const hi = this.bytecode[this.ctx.scriptPtr++];
    return lo | (hi << 8);
  }

  private readWord(): number {
    const b0 = this.bytecode[this.ctx.scriptPtr++];
    const b1 = this.bytecode[this.ctx.scriptPtr++];
    const b2 = this.bytecode[this.ctx.scriptPtr++];
    const b3 = this.bytecode[this.ctx.scriptPtr++];
    return b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
  }
}
```

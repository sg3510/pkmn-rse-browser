---
title: TypeScript Script System Design
status: reference
last_verified: 2026-01-13
---

# TypeScript Script System Design

Complete architecture for implementing the Pokemon Emerald script system in TypeScript.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCRIPT SYSTEM ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────┐   │
│  │   Script    │     │   Script     │     │    Game        │   │
│  │   Loader    │────▶│   Engine     │────▶│    State       │   │
│  └─────────────┘     └──────┬───────┘     └────────────────┘   │
│         │                   │                      ▲           │
│         │                   │                      │           │
│         ▼                   ▼                      │           │
│  ┌─────────────┐     ┌──────────────┐     ┌──────┴─────────┐   │
│  │   Script    │     │   Command    │     │   Effects      │   │
│  │   Cache     │     │   Handlers   │────▶│  (UI, Audio,   │   │
│  └─────────────┘     └──────────────┘     │   Animation)   │   │
│                             │              └────────────────┘   │
│                             ▼                                   │
│                      ┌──────────────┐                           │
│                      │   Specials   │                           │
│                      │   Registry   │                           │
│                      └──────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Interfaces

### Script Context

```typescript
interface ScriptContext {
  mode: 'stopped' | 'running' | 'waiting';
  scriptId: string;           // Script identifier
  pc: number;                 // Program counter
  stack: number[];            // Call stack (return addresses)
  comparisonResult: number;   // 0=<, 1==, 2=>
  localData: number[];        // 4 local variables

  // Movement tracking
  movingObjectId: number | null;

  // Message state
  messageActive: boolean;

  // Wait state
  waitType: WaitType | null;
  waitData: unknown;
}

type WaitType =
  | 'message'
  | 'movement'
  | 'sound'
  | 'fanfare'
  | 'fade'
  | 'button'
  | 'delay'
  | 'special';
```

### Script Data

```typescript
// Compiled script format (from .inc files)
interface CompiledScript {
  id: string;
  label: string;
  commands: ScriptCommand[];
  textData: Map<string, string>;
  movementData: Map<string, MovementStep[]>;
}

interface ScriptCommand {
  opcode: number;
  args: (number | string)[];
  line?: number;  // Source line for debugging
}

interface MovementStep {
  action: number;  // MOVEMENT_ACTION_*
}
```

### Game State Interface

```typescript
interface GameState {
  // Variables (VAR_*)
  vars: Map<number, number>;

  // Flags (FLAG_*)
  flags: Set<number>;

  // Player
  player: PlayerState;

  // Party
  party: Pokemon[];

  // Items
  bag: BagState;

  // Current map
  currentMap: MapState;
}

interface PlayerState {
  x: number;
  y: number;
  direction: Direction;
  gender: 'male' | 'female';
}
```

## Script Engine Implementation

### Main Engine Class

```typescript
class ScriptEngine {
  private ctx: ScriptContext;
  private gameState: GameState;
  private commands: CommandRegistry;
  private specials: SpecialRegistry;
  private effects: EffectsManager;
  private scripts: ScriptCache;

  constructor(
    gameState: GameState,
    effects: EffectsManager
  ) {
    this.gameState = gameState;
    this.effects = effects;
    this.ctx = this.createContext();
    this.commands = new CommandRegistry(this);
    this.specials = new SpecialRegistry(this);
    this.scripts = new ScriptCache();
  }

  private createContext(): ScriptContext {
    return {
      mode: 'stopped',
      scriptId: '',
      pc: 0,
      stack: [],
      comparisonResult: 0,
      localData: [0, 0, 0, 0],
      movingObjectId: null,
      messageActive: false,
      waitType: null,
      waitData: null,
    };
  }

  /**
   * Load and start a script
   */
  async start(scriptId: string): Promise<void> {
    const script = await this.scripts.load(scriptId);
    if (!script) {
      console.warn(`[Script] Not found: ${scriptId}`);
      return;
    }

    this.ctx = this.createContext();
    this.ctx.scriptId = scriptId;
    this.ctx.mode = 'running';

    await this.run(script);
  }

  /**
   * Main execution loop
   */
  private async run(script: CompiledScript): Promise<void> {
    while (this.ctx.mode === 'running') {
      const cmd = script.commands[this.ctx.pc];
      if (!cmd) {
        this.ctx.mode = 'stopped';
        break;
      }

      this.ctx.pc++;

      const handler = this.commands.get(cmd.opcode);
      if (!handler) {
        console.warn(`[Script] Unknown opcode: 0x${cmd.opcode.toString(16)}`);
        continue;
      }

      const shouldYield = await handler(cmd.args);
      if (shouldYield) {
        // Script yielded, will be resumed by callback
        return;
      }
    }

    this.onScriptEnd();
  }

  /**
   * Resume from wait state
   */
  resume(): void {
    if (this.ctx.mode !== 'waiting') return;

    this.ctx.mode = 'running';
    this.ctx.waitType = null;
    this.ctx.waitData = null;

    const script = this.scripts.get(this.ctx.scriptId);
    if (script) {
      this.run(script);
    }
  }

  /**
   * Called when script ends
   */
  private onScriptEnd(): void {
    this.ctx.mode = 'stopped';
    this.effects.unlockPlayer();
    this.effects.emit('scriptEnd', this.ctx.scriptId);
  }

  // Helper methods for commands
  getVar(id: number): number {
    return this.gameState.vars.get(id) ?? 0;
  }

  setVar(id: number, value: number): void {
    this.gameState.vars.set(id, value);
  }

  getFlag(id: number): boolean {
    return this.gameState.flags.has(id);
  }

  setFlag(id: number): void {
    this.gameState.flags.add(id);
  }

  clearFlag(id: number): void {
    this.gameState.flags.delete(id);
  }

  yield(waitType: WaitType, waitData?: unknown): void {
    this.ctx.mode = 'waiting';
    this.ctx.waitType = waitType;
    this.ctx.waitData = waitData;
  }
}
```

### Command Registry

```typescript
type CommandHandler = (args: (number | string)[]) => boolean | Promise<boolean>;

class CommandRegistry {
  private handlers: Map<number, CommandHandler> = new Map();
  private engine: ScriptEngine;

  constructor(engine: ScriptEngine) {
    this.engine = engine;
    this.registerAll();
  }

  get(opcode: number): CommandHandler | undefined {
    return this.handlers.get(opcode);
  }

  private registerAll(): void {
    // Flow control
    this.register(0x02, this.end);
    this.register(0x03, this.return_);
    this.register(0x04, this.call);
    this.register(0x05, this.goto);
    this.register(0x06, this.gotoIf);
    this.register(0x07, this.callIf);

    // Variables
    this.register(0x16, this.setvar);
    this.register(0x17, this.addvar);
    this.register(0x19, this.copyvar);
    this.register(0x21, this.compareVarToValue);
    this.register(0x22, this.compareVarToVar);

    // Flags
    this.register(0x29, this.setflag);
    this.register(0x2A, this.clearflag);
    this.register(0x2B, this.checkflag);

    // Wait
    this.register(0x27, this.waitstate);
    this.register(0x28, this.delay);

    // Message
    this.register(0x67, this.message);
    this.register(0x66, this.waitmessage);
    this.register(0x68, this.closemessage);

    // Object control
    this.register(0x4F, this.applymovement);
    this.register(0x51, this.waitmovement);
    this.register(0x53, this.removeobject);
    this.register(0x55, this.addobject);

    // Lock/release
    this.register(0x69, this.lockall);
    this.register(0x6A, this.lock);
    this.register(0x6B, this.releaseall);
    this.register(0x6C, this.release);

    // Specials
    this.register(0x25, this.special);
    this.register(0x26, this.specialvar);

    // Screen
    this.register(0x97, this.fadescreen);

    // Warp
    this.register(0x39, this.warp);

    // Sound
    this.register(0x2F, this.playse);
    this.register(0x30, this.waitse);
    this.register(0x31, this.playfanfare);
    this.register(0x32, this.waitfanfare);
    this.register(0x33, this.playbgm);
  }

  private register(opcode: number, handler: CommandHandler): void {
    this.handlers.set(opcode, handler.bind(this));
  }

  // Command implementations

  private end(): boolean {
    this.engine.ctx.mode = 'stopped';
    return false;
  }

  private return_(): boolean {
    const addr = this.engine.ctx.stack.pop();
    if (addr !== undefined) {
      this.engine.ctx.pc = addr;
    }
    return false;
  }

  private call(args: number[]): boolean {
    const [targetPc] = args;
    this.engine.ctx.stack.push(this.engine.ctx.pc);
    this.engine.ctx.pc = targetPc;
    return false;
  }

  private goto(args: number[]): boolean {
    const [targetPc] = args;
    this.engine.ctx.pc = targetPc;
    return false;
  }

  private gotoIf(args: number[]): boolean {
    const [condition, targetPc] = args;
    if (this.checkCondition(condition)) {
      this.engine.ctx.pc = targetPc;
    }
    return false;
  }

  private callIf(args: number[]): boolean {
    const [condition, targetPc] = args;
    if (this.checkCondition(condition)) {
      this.engine.ctx.stack.push(this.engine.ctx.pc);
      this.engine.ctx.pc = targetPc;
    }
    return false;
  }

  private checkCondition(condition: number): boolean {
    const result = this.engine.ctx.comparisonResult;
    const table = [
      [1, 0, 0],  // < : true if result=0
      [0, 1, 0],  // == : true if result=1
      [0, 0, 1],  // > : true if result=2
      [1, 1, 0],  // <= : true if result=0 or 1
      [0, 1, 1],  // >= : true if result=1 or 2
      [1, 0, 1],  // != : true if result=0 or 2
    ];
    return table[condition][result] === 1;
  }

  private setvar(args: number[]): boolean {
    const [varId, value] = args;
    this.engine.setVar(varId, value);
    return false;
  }

  private addvar(args: number[]): boolean {
    const [varId, value] = args;
    const current = this.engine.getVar(varId);
    this.engine.setVar(varId, current + value);
    return false;
  }

  private copyvar(args: number[]): boolean {
    const [dstId, srcId] = args;
    this.engine.setVar(dstId, this.engine.getVar(srcId));
    return false;
  }

  private compareVarToValue(args: number[]): boolean {
    const [varId, value] = args;
    const varValue = this.engine.getVar(varId);
    this.engine.ctx.comparisonResult = this.compare(varValue, value);
    return false;
  }

  private compareVarToVar(args: number[]): boolean {
    const [varId1, varId2] = args;
    const val1 = this.engine.getVar(varId1);
    const val2 = this.engine.getVar(varId2);
    this.engine.ctx.comparisonResult = this.compare(val1, val2);
    return false;
  }

  private compare(a: number, b: number): number {
    if (a < b) return 0;
    if (a === b) return 1;
    return 2;
  }

  private setflag(args: number[]): boolean {
    const [flagId] = args;
    this.engine.setFlag(flagId);
    return false;
  }

  private clearflag(args: number[]): boolean {
    const [flagId] = args;
    this.engine.clearFlag(flagId);
    return false;
  }

  private checkflag(args: number[]): boolean {
    const [flagId] = args;
    const value = this.engine.getFlag(flagId) ? 1 : 0;
    this.engine.setVar(VAR_RESULT, value);
    return false;
  }

  private waitstate(): boolean {
    this.engine.yield('special');
    return true;  // Yield
  }

  private delay(args: number[]): boolean {
    const [frames] = args;
    this.engine.yield('delay', frames);
    setTimeout(() => this.engine.resume(), frames * 16);  // ~60fps
    return true;  // Yield
  }

  private async message(args: (number | string)[]): Promise<boolean> {
    const [textId] = args;
    const text = await this.engine.getText(textId as string);
    this.engine.effects.showMessage(text);
    this.engine.ctx.messageActive = true;
    return false;  // Don't yield, message runs in background
  }

  private waitmessage(): boolean {
    if (this.engine.ctx.messageActive) {
      this.engine.yield('message');
      // Message system will call resume when done
      return true;
    }
    return false;
  }

  private closemessage(): boolean {
    this.engine.effects.closeMessage();
    this.engine.ctx.messageActive = false;
    return false;
  }

  private lockall(): boolean {
    this.engine.effects.lockPlayer();
    this.engine.effects.freezeAllNPCs();
    return false;
  }

  private lock(): boolean {
    this.engine.effects.lockPlayer();
    return false;
  }

  private releaseall(): boolean {
    this.engine.effects.unlockPlayer();
    this.engine.effects.unfreezeAllNPCs();
    return false;
  }

  private release(): boolean {
    this.engine.effects.unlockPlayer();
    return false;
  }

  private async special(args: number[]): Promise<boolean> {
    const [index] = args;
    await this.engine.specials.call(index);
    return false;
  }

  private async specialvar(args: number[]): Promise<boolean> {
    const [varId, index] = args;
    const result = await this.engine.specials.call(index);
    this.engine.setVar(varId, result);
    return false;
  }

  private applymovement(args: (number | string)[]): boolean {
    const [objectId, movementId] = args;
    const movement = this.engine.getMovement(movementId as string);
    this.engine.effects.applyMovement(objectId as number, movement);
    this.engine.ctx.movingObjectId = objectId as number;
    return false;
  }

  private waitmovement(args: number[]): boolean {
    const [objectId] = args;
    const id = objectId === 0 ? this.engine.ctx.movingObjectId : objectId;

    if (this.engine.effects.isMovementActive(id)) {
      this.engine.yield('movement', id);
      return true;
    }
    return false;
  }

  private fadescreen(args: number[]): boolean {
    const [mode] = args;
    this.engine.effects.fadeScreen(mode);
    this.engine.yield('fade');
    return true;
  }

  private warp(args: number[]): boolean {
    const [mapId, warpId, x, y] = args;
    this.engine.effects.warp(mapId, warpId, x, y);
    this.engine.yield('special');
    return true;
  }

  private playse(args: number[]): boolean {
    const [seId] = args;
    this.engine.effects.playSound(seId);
    return false;
  }

  private waitse(): boolean {
    this.engine.yield('sound');
    return true;
  }

  private playfanfare(args: number[]): boolean {
    const [fanfareId] = args;
    this.engine.effects.playFanfare(fanfareId);
    return false;
  }

  private waitfanfare(): boolean {
    this.engine.yield('fanfare');
    return true;
  }

  private playbgm(args: number[]): boolean {
    const [bgmId, save] = args;
    this.engine.effects.playBGM(bgmId, save === 1);
    return false;
  }

  private removeobject(args: number[]): boolean {
    const [objectId] = args;
    this.engine.effects.hideObject(objectId);
    return false;
  }

  private addobject(args: number[]): boolean {
    const [objectId] = args;
    this.engine.effects.showObject(objectId);
    return false;
  }
}
```

### Effects Manager Interface

```typescript
interface EffectsManager {
  // Player control
  lockPlayer(): void;
  unlockPlayer(): void;

  // NPC control
  freezeAllNPCs(): void;
  unfreezeAllNPCs(): void;
  applyMovement(objectId: number, movement: MovementStep[]): void;
  isMovementActive(objectId: number | null): boolean;
  hideObject(objectId: number): void;
  showObject(objectId: number): void;

  // Message
  showMessage(text: string): void;
  closeMessage(): void;

  // Screen
  fadeScreen(mode: number): void;

  // Warp
  warp(mapId: number, warpId: number, x: number, y: number): void;

  // Audio
  playSound(seId: number): void;
  playFanfare(fanfareId: number): void;
  playBGM(bgmId: number, save: boolean): void;

  // Events
  on(event: string, handler: Function): void;
  emit(event: string, ...args: unknown[]): void;
}
```

## Script Loader

### Pre-compiled JSON Format

```typescript
interface ScriptBundle {
  version: string;
  scripts: Record<string, CompiledScript>;
  text: Record<string, string>;
  movement: Record<string, MovementStep[]>;
}

class ScriptLoader {
  private baseUrl: string;
  private bundles: Map<string, ScriptBundle> = new Map();

  async loadBundle(mapId: string): Promise<ScriptBundle> {
    const cached = this.bundles.get(mapId);
    if (cached) return cached;

    const response = await fetch(`${this.baseUrl}/scripts/${mapId}.json`);
    const bundle = await response.json() as ScriptBundle;

    this.bundles.set(mapId, bundle);
    return bundle;
  }

  getScript(bundle: ScriptBundle, scriptId: string): CompiledScript | null {
    return bundle.scripts[scriptId] ?? null;
  }

  getText(bundle: ScriptBundle, textId: string): string {
    return bundle.text[textId] ?? '';
  }
}
```

### Build-time Script Compiler

```typescript
// Build script to convert .inc to JSON

import * as fs from 'fs';
import * as path from 'path';

function compileScripts(mapDir: string): ScriptBundle {
  const scriptFile = path.join(mapDir, 'scripts.inc');
  const content = fs.readFileSync(scriptFile, 'utf-8');

  const scripts: Record<string, CompiledScript> = {};
  const text: Record<string, string> = {};
  const movement: Record<string, MovementStep[]> = {};

  // Parse script labels
  const scriptLabels = content.match(/^\w+::$/gm) ?? [];

  for (const label of scriptLabels) {
    const scriptId = label.replace('::', '');
    const commands = parseScriptCommands(content, scriptId);
    scripts[scriptId] = { id: scriptId, label: scriptId, commands };
  }

  // Parse text
  const textMatches = content.matchAll(/^(\w+):\s*\.string "(.*)"\$/gm);
  for (const match of textMatches) {
    text[match[1]] = parseText(match[2]);
  }

  // Parse movement
  const moveMatches = content.matchAll(/^(\w+):\s*([\s\S]*?)step_end/gm);
  for (const match of moveMatches) {
    movement[match[1]] = parseMovement(match[2]);
  }

  return {
    version: '1.0',
    scripts,
    text,
    movement,
  };
}
```

## Integration with Existing Code

### Connecting to ObjectEventManager

```typescript
// In your existing ObjectEventManager
class ObjectEventManager {
  private scriptEngine: ScriptEngine;

  setScriptEngine(engine: ScriptEngine): void {
    this.scriptEngine = engine;
  }

  async onInteract(npc: NPCObject): Promise<void> {
    if (npc.script) {
      await this.scriptEngine.start(npc.script);
    }
  }
}
```

### Connecting to GameFlags

```typescript
// Bridge existing GameFlags to script engine
class ScriptGameState implements GameState {
  private gameFlags: GameFlagsManager;

  constructor(gameFlags: GameFlagsManager) {
    this.gameFlags = gameFlags;
  }

  get flags(): Set<number> {
    // Convert string flags to numeric
    return new Set(
      this.gameFlags.getAllFlags()
        .map(f => parseInt(f.replace('FLAG_', ''), 10))
        .filter(n => !isNaN(n))
    );
  }
}
```

## Usage Example

```typescript
// Initialize
const effects = new GameEffectsManager(/* ... */);
const gameState = new ScriptGameState(gameFlags);
const scriptEngine = new ScriptEngine(gameState, effects);

// Connect to NPC system
objectEventManager.setScriptEngine(scriptEngine);

// Manual script trigger (for testing)
await scriptEngine.start('Route101_EventScript_Boy');
```

## File Structure

```
src/
├── script/
│   ├── ScriptEngine.ts
│   ├── CommandRegistry.ts
│   ├── SpecialRegistry.ts
│   ├── ScriptLoader.ts
│   ├── types.ts
│   └── constants/
│       ├── opcodes.ts
│       ├── vars.ts
│       └── flags.ts
├── effects/
│   └── GameEffectsManager.ts
└── data/
    └── scripts/
        ├── Route101.json
        ├── LittlerootTown.json
        └── ...
```

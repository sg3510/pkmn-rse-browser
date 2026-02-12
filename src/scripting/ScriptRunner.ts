/**
 * Runtime script interpreter for parsed .inc script data.
 *
 * Walks ScriptCommand[] arrays and dispatches to StoryScriptContext methods.
 * Resolves labels across map-specific and common script data.
 *
 * C references:
 * - public/pokeemerald/src/script.c (ScriptContext, ScriptReadByte, etc.)
 * - public/pokeemerald/src/scrcmd.c (ScrCmd_* command implementations)
 */

import type { ScriptCommand, MapScriptData } from '../data/scripts/types';
import type { StoryScriptContext } from '../game/NewGameFlow';
import { gameFlags } from '../game/GameFlags';
import { gameVariables } from '../game/GameVariables';
import { setDynamicWarpTarget } from '../game/DynamicWarp';
import { getFixedHoleWarpTarget, setFixedHoleWarpTarget } from '../game/FixedHoleWarp';
import {
  setDynamicObjectGfxVar,
  getDynamicObjectGfxVar,
  clearDynamicObjectGfxVar,
} from '../game/DynamicObjectGfx';
import { SPECIES, getSpeciesName } from '../data/species';
import { getItemId, getItemName } from '../data/items';
import { bagManager } from '../game/BagManager';
import { moneyManager } from '../game/MoneyManager';
import { saveStateStore } from '../save/SaveStateStore';
import { isTrainerDefeated, setTrainerDefeated, clearTrainerDefeated } from './trainerFlags';
import { getMoveInfo } from '../data/moves';
import { STATUS } from '../pokemon/types';
import { METATILE_LABELS } from '../data/metatileLabels.gen';
import { getMultichoiceIdByName, getMultichoiceList } from '../data/multichoice.gen';
import { stepCallbackManager } from '../game/StepCallbackManager';
import { rotatingGateManager } from '../game/RotatingGateManager';

/** Direction string used by StoryScriptContext */
type Direction = 'up' | 'down' | 'left' | 'right';
type ScriptMoveMode = NonNullable<Parameters<StoryScriptContext['movePlayer']>[1]>;

// --- Rotating tile puzzle state (Mossdeep Gym / Trick House) ---
// C ref: public/pokeemerald/src/rotating_tile_puzzle.c
interface RotatingTilePuzzleObject {
  localId: string;
  prevTileX: number;  // world coords
  prevTileY: number;
}

interface RotatingTilePuzzleState {
  isTrickHouse: boolean;
  movedObjects: RotatingTilePuzzleObject[];
}

let rotatingTilePuzzle: RotatingTilePuzzleState | null = null;

// Base metatile IDs for arrow tiles
const MOSSDEEP_GYM_ARROW_BASE = 0x250;  // METATILE_RSMossdeepGym_YellowArrow_Right
const TRICK_HOUSE_ARROW_BASE = 0x298;   // METATILE_TrickHousePuzzle_Arrow_YellowOnWhite_Right
const METATILE_ROW_WIDTH = 8;

// Arrow direction from metatile offset: 0=right, 1=down, 2=left, 3=up (wraps every 8)
function getArrowDirection(metatile: number, base: number): Direction | null {
  const offset = metatile - base;
  if (offset < 0 || offset >= 5 * METATILE_ROW_WIDTH) return null; // 5 color rows
  const dirIndex = offset % METATILE_ROW_WIDTH;
  if (dirIndex >= 4) return null; // only 4 directions per row (indices 0-3)
  switch (dirIndex) {
    case 0: return 'right';
    case 1: return 'down';
    case 2: return 'left';
    case 3: return 'up';
    default: return null;
  }
}

// Get color row index (0=Yellow, 1=Blue, 2=Green, 3=Purple, 4=Red)
function getArrowColorRow(metatile: number, base: number): number {
  const offset = metatile - base;
  return Math.floor(offset / METATILE_ROW_WIDTH);
}

// Rotate direction counterclockwise: right→up→left→down→right
function rotateCCW(dir: Direction): Direction {
  switch (dir) {
    case 'right': return 'up';
    case 'up': return 'left';
    case 'left': return 'down';
    case 'down': return 'right';
  }
}


/** Constants that the C source uses but we resolve at runtime */
const GENDER_MALE = 0;
const GENDER_FEMALE = 1;

/**
 * Resolve a constant name to its numeric value.
 * In the C source these are #defines; we handle the common ones here.
 */
function resolveConstant(val: string | number): string | number {
  if (typeof val === 'number') return val;
  if (val in SPECIES) return SPECIES[val as keyof typeof SPECIES];
  if (val.startsWith('SPECIES_')) {
    const speciesKey = val.replace('SPECIES_', '');
    if (speciesKey in SPECIES) return SPECIES[speciesKey as keyof typeof SPECIES];
  }
  if (val === 'MALE') return GENDER_MALE;
  if (val === 'FEMALE') return GENDER_FEMALE;
  if (val === 'TRUE' || val === 'YES') return 1;
  if (val === 'FALSE' || val === 'NO') return 0;
  if (val === 'FADE_TO_BLACK') return 1;
  if (val === 'FADE_FROM_BLACK') return 0;
  // GBA direction constants (from include/constants/event_object_movement.h)
  if (val === 'DIR_NONE') return 0;
  if (val === 'DIR_SOUTH') return 1;
  if (val === 'DIR_NORTH') return 2;
  if (val === 'DIR_WEST') return 3;
  if (val === 'DIR_EAST') return 4;
  // Battle outcome constants (include/constants/battle.h)
  if (val === 'B_OUTCOME_WON') return 1;
  if (val === 'B_OUTCOME_LOST') return 2;
  if (val === 'B_OUTCOME_DREW') return 3;
  if (val === 'B_OUTCOME_RAN') return 4;
  if (val === 'B_OUTCOME_PLAYER_TELEPORTED') return 5;
  if (val === 'B_OUTCOME_MON_FLED') return 6;
  if (val === 'B_OUTCOME_CAUGHT') return 7;
  // Script menu constants (include/constants/script_menu.h)
  if (val === 'MULTI_B_PRESSED') return 127;
  if (val.startsWith('MULTI_')) {
    const multichoiceId = getMultichoiceIdByName(val);
    if (multichoiceId !== undefined) return multichoiceId;
  }
  // Step callback constants (include/constants/field_tasks.h)
  if (val === 'STEP_CB_DUMMY') return 0;
  if (val === 'STEP_CB_ASH') return 1;
  if (val === 'STEP_CB_FORTREE_BRIDGE') return 2;
  if (val === 'STEP_CB_PACIFIDLOG_BRIDGE') return 3;
  if (val === 'STEP_CB_SOOTOPOLIS_ICE') return 4;
  if (val === 'STEP_CB_TRUCK') return 5;
  if (val === 'STEP_CB_SECRET_BASE') return 6;
  if (val === 'STEP_CB_CRACKED_FLOOR') return 7;
  // Metatile labels
  if (val in METATILE_LABELS) return METATILE_LABELS[val];
  return val;
}

function asNumber(val: string | number): number {
  if (typeof val === 'number') return val;
  const resolved = resolveConstant(val);
  if (typeof resolved === 'number') return resolved;
  // Try parseInt as last resort
  const n = parseInt(resolved, 10);
  return isNaN(n) ? 0 : n;
}

function asString(val: string | number): string {
  return String(val);
}

/**
 * Format script text for display.
 *
 * Replaces variable placeholders ({PLAYER}, {STR_VAR_*}) but leaves
 * GBA escape sequences (\\n, \\l, \\p) intact for the pagination system
 * to handle.
 */
/** Runtime string variables (gStringVar1, etc.) set by special functions */
const stringVars: Record<string, string> = {};

function formatScriptText(raw: string, playerName: string, playerGender: number): string {
  let text = raw;
  text = text.replace(/\{PLAYER\}/g, playerName);
  text = text.replace(/\{STR_VAR_1\}/g, stringVars['STR_VAR_1'] ?? '');
  text = text.replace(/\{STR_VAR_2\}/g, stringVars['STR_VAR_2'] ?? '');
  text = text.replace(/\{STR_VAR_3\}/g, stringVars['STR_VAR_3'] ?? '');
  // {KUN} — Japanese honorific suffix, empty in English
  text = text.replace(/\{KUN\}/g, '');
  // {RIVAL} — gender-dependent rival name
  text = text.replace(/\{RIVAL\}/g, playerGender === 0 ? 'MAY' : 'BRENDAN');
  // {POKEBLOCK} — styled name
  text = text.replace(/\{POKEBLOCK\}/g, 'POKeBLOCK');
  // Arrow symbols
  text = text.replace(/\{UP_ARROW\}/g, '▲');
  text = text.replace(/\{DOWN_ARROW\}/g, '▼');
  text = text.replace(/\{LEFT_ARROW\}/g, '◀');
  text = text.replace(/\{RIGHT_ARROW\}/g, '▶');
  return text;
}

/** Movement command → direction mapping for walk/face commands */
function movementToDirection(cmd: string): Direction | null {
  if (cmd.endsWith('_up')) return 'up';
  if (cmd.endsWith('_down')) return 'down';
  if (cmd.endsWith('_left')) return 'left';
  if (cmd.endsWith('_right')) return 'right';
  return null;
}

export interface ScriptDataSources {
  /** Map-specific script data (scripts, movements, text for this map) */
  mapData: MapScriptData | null;
  /** Shared/common script data */
  commonData: MapScriptData;
}

export class ScriptRunner {
  private sources: MapScriptData[];
  private ctx: StoryScriptContext;
  private playerName: string;
  private playerGender: number;
  private currentMapId: string;

  /** Active movement promises keyed by object ID */
  private pendingMovements = new Map<string, Promise<void>>();

  /** Pending wild battle state (set by setwildbattle) */
  private wildBattleSpecies: number = 0;
  private wildBattleLevel: number = 0;
  private wildBattleItem: number = 0;

  /**
   * Local string store for temp variables (VAR_0x8004, VAR_0x8005, etc.).
   * In the C source, setvar stores numeric values, but our generated scripts
   * store symbolic LOCALID_ strings. We preserve these for applymovement/etc.
   */
  private localStringVars = new Map<string, string>();

  constructor(
    dataSources: ScriptDataSources,
    ctx: StoryScriptContext,
    currentMapId: string,
  ) {
    this.sources = [];
    if (dataSources.mapData) this.sources.push(dataSources.mapData);
    this.sources.push(dataSources.commonData);
    this.ctx = ctx;
    this.currentMapId = currentMapId;
    this.playerGender = ctx.getPlayerGender();
    const fallbackName = this.playerGender === 1 ? 'MAY' : 'BRENDAN';
    this.playerName = ctx.getPlayerName().trim() || fallbackName;
  }

  /** Look up a script by label across all sources */
  private findScript(label: string): ScriptCommand[] | null {
    for (const src of this.sources) {
      if (label in src.scripts) return src.scripts[label];
    }
    // Built-in scripts not in generated data (from event_scripts.s)
    if (label === 'EventScript_BackupMrBrineyLocation') {
      return [
        { cmd: 'copyvar', args: ['VAR_0x8008', 'VAR_BRINEY_LOCATION'] },
        { cmd: 'setvar', args: ['VAR_BRINEY_LOCATION', 0] },
        { cmd: 'return' },
      ];
    }
    if (label === 'Common_EventScript_PlayBrineysBoatMusic') {
      return [
        // Audio is not implemented yet; keep script flow and flag behavior.
        { cmd: 'setflag', args: ['FLAG_DONT_TRANSITION_MUSIC'] },
        { cmd: 'return' },
      ];
    }
    if (label === 'Common_EventScript_StopBrineysBoatMusic') {
      return [
        { cmd: 'clearflag', args: ['FLAG_DONT_TRANSITION_MUSIC'] },
        { cmd: 'return' },
      ];
    }
    if (label === 'Common_EventScript_RemoveStaticPokemon') {
      return [
        { cmd: 'fadescreen', args: [1] },
        { cmd: 'removeobject', args: ['VAR_LAST_TALKED'] },
        { cmd: 'fadescreen', args: [0] },
        { cmd: 'release' },
        { cmd: 'end' },
      ];
    }
    return null;
  }

  /** Look up a movement sequence by label */
  private findMovement(label: string): string[] | null {
    for (const src of this.sources) {
      if (label in src.movements) return src.movements[label];
    }
    return null;
  }

  /** Look up text by label */
  private findText(label: string): string | null {
    for (const src of this.sources) {
      if (label in src.text) return src.text[label];
    }
    return null;
  }

  /**
   * Read a variable value. Handles VAR_RESULT and temp vars.
   * If the value is a VAR_ reference, dereference it.
   */
  private getVar(name: string | number): number {
    if (typeof name === 'number') return name;
    return gameVariables.getVar(name);
  }

  /** Resolve an argument that might be a variable reference to its value */
  private resolveVarOrConst(val: string | number): number {
    const resolved = resolveConstant(val);
    if (typeof resolved === 'number') return resolved;
    // If it starts with VAR_, treat as variable reference
    if (resolved.startsWith('VAR_')) {
      return this.getVar(resolved);
    }
    return asNumber(resolved);
  }

  /**
   * Execute a script by label name.
   * Returns true if the script was found and executed.
   */
  async execute(scriptLabel: string): Promise<boolean> {
    const commands = this.findScript(scriptLabel);
    if (!commands) {
      console.warn(`[ScriptRunner] Script not found: ${scriptLabel}`);
      return false;
    }

    await this.runCommands(commands);
    return true;
  }

  /**
   * Run a command array with call stack support.
   */
  private async runCommands(commands: ScriptCommand[]): Promise<void> {
    let ip = 0;
    const callStack: { commands: ScriptCommand[]; ip: number }[] = [];
    let switchValue: number | null = null;
    let switchMatched = false;

    while (ip < commands.length) {
      const { cmd, args = [] } = commands[ip];
      ip++;

      switch (cmd) {
        // --- Flow control ---
        case 'end':
          return;

        case 'return':
          if (callStack.length === 0) return;
          { const frame = callStack.pop()!;
            commands = frame.commands;
            ip = frame.ip;
          }
          break;

        case 'goto': {
          const label = asString(args[0]);
          const target = this.findScript(label);
          if (!target) {
            console.warn(`[ScriptRunner] goto target not found: ${label}`);
            return;
          }
          // Replace current command stream (tail call)
          commands = target;
          ip = 0;
          break;
        }

        case 'call': {
          const label = asString(args[0]);
          const target = this.findScript(label);
          if (!target) {
            console.warn(`[ScriptRunner] call target not found: ${label}`);
            break;
          }
          callStack.push({ commands, ip });
          commands = target;
          ip = 0;
          break;
        }

        case 'switch':
          switchValue = this.resolveVarOrConst(args[0]);
          switchMatched = false;
          break;

        case 'case': {
          if (switchValue === null || switchMatched) break;
          const caseVal = this.resolveVarOrConst(args[0]);
          if (switchValue === caseVal) {
            const label = asString(args[1]);
            const target = this.findScript(label);
            if (!target) {
              console.warn(`[ScriptRunner] case target not found: ${label}`);
              break;
            }
            switchMatched = true;
            commands = target;
            ip = 0;
          }
          break;
        }

        // --- Conditional flow ---
        case 'goto_if_eq': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal === cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'goto_if_ne': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal !== cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'goto_if_lt': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal < cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'goto_if_gt': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal > cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'goto_if_ge': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal >= cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'goto_if_set': {
          const flag = asString(args[0]);
          if (gameFlags.isSet(flag)) {
            const target = this.findScript(asString(args[1]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'goto_if_unset': {
          const flag = asString(args[0]);
          if (!gameFlags.isSet(flag)) {
            const target = this.findScript(asString(args[1]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'call_if_eq': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal === cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        case 'call_if_ne': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal !== cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        case 'call_if_lt': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal < cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        case 'call_if_gt': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal > cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        case 'call_if_ge': {
          const varVal = this.getVar(asString(args[0]));
          const cmpVal = this.resolveVarOrConst(args[1]);
          if (varVal >= cmpVal) {
            const target = this.findScript(asString(args[2]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        case 'call_if_set': {
          const flag = asString(args[0]);
          if (gameFlags.isSet(flag)) {
            const target = this.findScript(asString(args[1]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        case 'call_if_unset': {
          const flag = asString(args[0]);
          if (!gameFlags.isSet(flag)) {
            const target = this.findScript(asString(args[1]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        // --- Lock/release ---
        case 'lockall':
        case 'lock':
          // Input already locked by useHandledStoryScript wrapper
          break;

        case 'releaseall':
        case 'release':
          // Input unlocked by useHandledStoryScript finally block
          break;

        case 'faceplayer':
          // NPC facing player — handled by the interaction trigger
          break;

        // --- Message ---
        case 'msgbox': {
          const textLabel = asString(args[0]);
          const msgType = args.length > 1 ? asString(args[1]) : '';
          const rawText = this.findText(textLabel);
          if (rawText) {
            const formattedText = formatScriptText(rawText, this.playerName, this.playerGender);
            if (msgType === 'MSGBOX_YESNO' && this.ctx.showYesNo) {
              const yes = await this.ctx.showYesNo(formattedText);
              gameVariables.setVar('VAR_RESULT', yes ? 1 : 0);
            } else {
              await this.ctx.showMessage(formattedText);
            }
          } else {
            console.warn(`[ScriptRunner] Text not found: ${textLabel}`);
          }
          break;
        }

        case 'waitmessage':
          // Our showMessage already waits for dismissal — no-op.
          break;

        case 'closemessage':
          // Dialog auto-closes after showMessage resolves
          break;

        case 'bufferleadmonspeciesname': {
          const destIdx = asNumber(args[0]);
          const destKey = `STR_VAR_${destIdx + 1}`;
          const party = this.ctx.getParty?.() ?? [];
          const lead = party.find((p) => p !== null);
          stringVars[destKey] = lead ? getSpeciesName(lead.species) : 'POKeMON';
          break;
        }

        // --- Variables ---
        case 'setvar': {
          const varName = asString(args[0]);
          const rawValue = args[1];
          // If the value is a symbolic string (LOCALID_*, MALE, FEMALE, etc.),
          // store it in the local string store for later dereferencing.
          if (typeof rawValue === 'string' && rawValue.startsWith('LOCALID_')) {
            this.localStringVars.set(varName, rawValue);
          }
          if (typeof rawValue === 'string' && rawValue.startsWith('OBJ_EVENT_GFX_')) {
            setDynamicObjectGfxVar(varName, rawValue);
          }
          const value = this.resolveVarOrConst(rawValue);
          gameVariables.setVar(varName, value);
          break;
        }

        case 'addvar': {
          const varName = asString(args[0]);
          const delta = this.resolveVarOrConst(args[1]);
          gameVariables.addVar(varName, delta);
          break;
        }

        case 'copyvar': {
          const dest = asString(args[0]);
          const src = asString(args[1]);
          if (dest.startsWith('VAR_OBJ_GFX_ID_') && src.startsWith('VAR_OBJ_GFX_ID_')) {
            const srcGfx = getDynamicObjectGfxVar(src);
            if (srcGfx) {
              setDynamicObjectGfxVar(dest, srcGfx);
            } else {
              clearDynamicObjectGfxVar(dest);
            }
          }
          gameVariables.setVar(dest, this.getVar(src));
          break;
        }

        case 'checkplayergender':
          gameVariables.setVar('VAR_RESULT', this.ctx.getPlayerGender());
          break;

        // --- Flags ---
        // C parity: setflag/clearflag only update the flag store. They do NOT
        // refresh NPC visibility at runtime. In the C source (scrcmd.c),
        // FlagSet/FlagClear just write to the save block. Visibility changes
        // happen either on map load (NPCs check flags when spawned) or via
        // addobject/removeobject (immediate runtime changes).
        case 'setflag':
          gameFlags.set(asString(args[0]));
          break;

        case 'clearflag':
          gameFlags.clear(asString(args[0]));
          break;

        // --- Movement ---
        case 'applymovement': {
          const objectId = asString(args[0]);
          const movementLabel = asString(args[1]);
          const resolvedObjId = this.resolveObjectId(objectId);
          const objectMapId = this.resolveObjectMapId(
            objectId,
            args.length > 2 ? asString(args[2]) : undefined
          );
          const isPlayerObj = resolvedObjId === 'LOCALID_PLAYER' || resolvedObjId === '255';
          // Pre-check: if targeting an NPC that doesn't exist, skip entirely
          if (!isPlayerObj && this.ctx.hasNpc) {
            if (!this.ctx.hasNpc(objectMapId, resolvedObjId)) {
              console.warn(`[ScriptRunner] applymovement skipped: NPC ${resolvedObjId} not found on ${objectMapId}`);
              // Store a resolved promise so waitmovement doesn't hang
              this.pendingMovements.set(objectId, Promise.resolve());
              break;
            }
          }
          const steps = this.findMovement(movementLabel);
          if (!steps) {
            console.warn(`[ScriptRunner] Movement not found: ${movementLabel}`);
            break;
          }
          // Start movement asynchronously — will be awaited by waitmovement
          const promise = this.executeMovement(objectId, steps, objectMapId);
          this.pendingMovements.set(objectId, promise);
          break;
        }

        case 'waitmovement': {
          // waitmovement 0 waits for all, otherwise waits for specific object
          const objectId = args.length > 0 ? asString(args[0]) : '0';
          if (objectId === '0' || objectId === '') {
            // Wait for all pending movements
            if (this.pendingMovements.size > 0) {
              await Promise.all(this.pendingMovements.values());
              this.pendingMovements.clear();
            }
          } else {
            const pending = this.pendingMovements.get(objectId);
            if (pending) {
              await pending;
              this.pendingMovements.delete(objectId);
            }
          }
          break;
        }

        // --- Object events ---
        case 'addobject': {
          const localId = asString(args[0]);
          // Resolve VAR_ references for local IDs
          const resolvedId = localId.startsWith('VAR_')
            ? String(this.getVar(localId))
            : localId;
          const objectMapId = this.resolveObjectMapId(resolvedId);
          this.ctx.setNpcVisible(objectMapId, resolvedId, true, true);  // persistent
          break;
        }

        case 'removeobject': {
          const localId = asString(args[0]);
          const resolvedId = localId.startsWith('VAR_')
            ? String(this.getVar(localId))
            : localId;
          const objectMapId = this.resolveObjectMapId(resolvedId);
          this.ctx.setNpcVisible(objectMapId, resolvedId, false, true);  // persistent
          break;
        }

        case 'setobjectxy': {
          const localId = asString(args[0]);
          const x = asNumber(args[1]);
          const y = asNumber(args[2]);
          const objectMapId = this.resolveObjectMapId(localId);
          this.ctx.setNpcPosition(objectMapId, localId, x, y);
          break;
        }

        case 'setobjectxyperm': {
          const localId = asString(args[0]);
          const x = asNumber(args[1]);
          const y = asNumber(args[2]);
          const objectMapId = this.resolveObjectMapId(localId);
          this.ctx.setNpcPosition(objectMapId, localId, x, y);
          saveStateStore.setObjectEventOverride(objectMapId, localId, x, y);
          break;
        }

        case 'copyobjectxytoperm': {
          // C ref: ScrCmd_copyobjectxytoperm in scrcmd.c
          // Copies NPC's current runtime position back to the persistent template
          // so the NPC stays at the new position across save/load.
          const localId = this.resolveObjectId(asString(args[0]));
          const objectMapId = this.resolveObjectMapId(localId);
          if (this.ctx.getNpcPosition && this.ctx.getMapOffset) {
            const worldPos = this.ctx.getNpcPosition(objectMapId, localId);
            const mapOffset = this.ctx.getMapOffset(objectMapId);
            if (worldPos && mapOffset) {
              // Convert world coords back to map-local (subtract map offset)
              const localX = worldPos.tileX - mapOffset.offsetX;
              const localY = worldPos.tileY - mapOffset.offsetY;
              saveStateStore.setObjectEventOverride(objectMapId, localId, localX, localY);
            }
          }
          break;
        }

        case 'turnobject': {
          const localId = asString(args[0]);
          const resolvedId = this.resolveObjectId(localId);
          const objectMapId = this.resolveObjectMapId(resolvedId);
          const dir = this.resolveDirection(args[1]);
          if (dir) {
            if (resolvedId === 'LOCALID_PLAYER' || resolvedId === '255') {
              this.ctx.setPlayerDirection?.(dir);
            } else {
              this.ctx.moveNpc(objectMapId, resolvedId, dir, 'face');
            }
          }
          break;
        }

        // --- Wait/delay ---
        case 'delay':
          await this.ctx.delayFrames(asNumber(args[0]));
          break;

        case 'waitstate':
          // Wait for async operations to complete (warp transition, etc.)
          await this.ctx.delayFrames(1);
          break;

        // --- Warp ---
        case 'warp':
        case 'warpsilent': {
          const mapId = asString(args[0]);
          const x = asNumber(args[1]);
          const y = asNumber(args[2]);
          this.ctx.queueWarp(mapId, x, y, 'down');
          break;
        }

        case 'setdynamicwarp': {
          const mapId = args[0] as string;
          const x = asNumber(args[1]);
          const y = asNumber(args[2]);
          setDynamicWarpTarget(mapId, x, y);
          break;
        }

        case 'setholewarp': {
          const mapId = asString(args[0]);
          if (mapId && mapId !== 'MAP_UNDEFINED') {
            setFixedHoleWarpTarget(mapId);
          }
          break;
        }

        // --- Visual ---
        case 'fadescreen':
          await this.ctx.delayFrames(16);
          break;

        case 'opendoor': {
          const x = this.resolveVarOrConst(args[0]);
          const y = this.resolveVarOrConst(args[1]);
          await this.ctx.playDoorAnimation(this.currentMapId, x, y, 'open');
          break;
        }

        case 'closedoor': {
          const x = this.resolveVarOrConst(args[0]);
          const y = this.resolveVarOrConst(args[1]);
          await this.ctx.playDoorAnimation(this.currentMapId, x, y, 'close');
          break;
        }

        case 'waitdooranim':
          // Door animation is awaited inline in open/closedoor
          break;

        case 'showplayer':
          this.ctx.setPlayerVisible(true);
          break;

        case 'hideplayer':
          this.ctx.setPlayerVisible(false);
          break;

        // --- Sound (no-ops until audio system exists) ---
        case 'playse':
        case 'playbgm':
        case 'playfanfare':
        case 'fadedefaultbgm':
        case 'savebgm':
        case 'waitse':
        case 'waitfanfare':
        case 'playmoncry':
        case 'waitmoncry':
          break;

        // --- Special functions ---
        case 'special': {
          const specialName = asString(args[0]);
          await this.executeSpecial(specialName);
          break;
        }

        case 'specialvar': {
          const destVar = asString(args[0]);
          const specialName = asString(args[1]);
          const result = await this.executeSpecial(specialName);
          if (result !== undefined) {
            gameVariables.setVar(destVar, result);
          }
          break;
        }

        // --- setmetatile: change a map tile's metatile ID ---
        case 'setmetatile': {
          const x = this.resolveVarOrConst(args[0]);
          const y = this.resolveVarOrConst(args[1]);
          const metatileId = this.resolveVarOrConst(args[2]);
          // 4th arg = collision flag: TRUE → impassable (1), FALSE/omitted → passable (0)
          // C parity: MapGridSetMetatileIdAt always sets collision bits from the argument.
          const collisionFlag = args.length > 3 ? this.resolveVarOrConst(args[3]) : 0;
          const collision = collisionFlag ? 1 : 0;
          if (this.ctx.setMapMetatile) {
            this.ctx.setMapMetatile(this.currentMapId, x, y, metatileId, collision);
          }
          break;
        }

        // --- setobjectmovementtype: change NPC movement behavior ---
        case 'setobjectmovementtype': {
          const localId = asString(args[0]);
          const movementType = asString(args[1]);
          // Use the full movement type setter if available (changes behavior + direction)
          if (this.ctx.setNpcMovementType) {
            this.ctx.setNpcMovementType(this.currentMapId, localId, movementType);
          } else {
            // Fallback: just face the NPC in the right direction
            const faceDirMap: Record<string, Direction> = {
              'MOVEMENT_TYPE_FACE_UP': 'up',
              'MOVEMENT_TYPE_FACE_DOWN': 'down',
              'MOVEMENT_TYPE_FACE_LEFT': 'left',
              'MOVEMENT_TYPE_FACE_RIGHT': 'right',
            };
            const faceDir = faceDirMap[movementType];
            if (faceDir) {
              this.ctx.moveNpc(this.currentMapId, localId, faceDir, 'face');
            }
          }
          break;
        }

        // --- hideobjectat / showobjectat: temporary NPC visibility (no flag persistence) ---
        case 'hideobjectat': {
          const localId = asString(args[0]);
          const mapId = args.length > 1 ? asString(args[1]) : this.currentMapId;
          if (localId === 'LOCALID_PLAYER' || localId === '255') {
            this.ctx.setPlayerVisible(false);
          } else {
            this.ctx.setNpcVisible(mapId, localId, false);
          }
          break;
        }

        case 'showobjectat': {
          const localId = asString(args[0]);
          const mapId = args.length > 1 ? asString(args[1]) : this.currentMapId;
          if (localId === 'LOCALID_PLAYER' || localId === '255') {
            this.ctx.setPlayerVisible(true);
          } else {
            this.ctx.setNpcVisible(mapId, localId, true);
          }
          break;
        }

        // --- message: show text (like msgbox but without type param) ---
        case 'message': {
          const textLabel = asString(args[0]);
          const rawText = this.findText(textLabel);
          if (rawText) {
            await this.ctx.showMessage(formatScriptText(rawText, this.playerName, this.playerGender));
          } else {
            console.warn(`[ScriptRunner] Text not found: ${textLabel}`);
          }
          break;
        }

        // --- pokenavcall: show text in PokéNav-style window (functionally same as message) ---
        case 'pokenavcall': {
          const textLabel = asString(args[0]);
          const rawText = this.findText(textLabel);
          if (rawText) {
            await this.ctx.showMessage(formatScriptText(rawText, this.playerName, this.playerGender));
          }
          break;
        }

        // --- getplayerxy: read player's map-local tile position into two variables ---
        case 'getplayerxy': {
          const xVar = asString(args[0]);
          const yVar = asString(args[1]);
          const pos = this.ctx.getPlayerLocalPosition?.();
          if (pos) {
            gameVariables.setVar(xVar, pos.x);
            gameVariables.setVar(yVar, pos.y);
          }
          break;
        }

        // --- Battle Frontier stubs ---
        case 'frontier_getstatus':
          // GBA: sets VAR_TEMP_CHALLENGE_STATUS to 0xFF, then overwrites with
          // actual status if a challenge is in progress. We have no frontier
          // save data, so 0xFF ("no challenge") is always correct.
          gameVariables.setVar('VAR_TEMP_CHALLENGE_STATUS', 0xFF);
          break;

        // --- giveitem: add item to bag and show obtain message ---
        // C macro: sets VAR_0x8000=item, VAR_0x8001=amount, callstd STD_OBTAIN_ITEM
        // Shows fanfare + "[Player] obtained [item]!" and sets VAR_RESULT
        case 'giveitem': {
          const itemArg = asString(args[0]);
          const amount = args.length > 1 ? this.resolveVarOrConst(args[1]) : 1;
          // Resolve item: could be a constant name or a variable reference
          let itemId: number | null;
          if (itemArg.startsWith('VAR_')) {
            itemId = this.getVar(itemArg);
          } else {
            itemId = getItemId(itemArg);
          }
          if (itemId && itemId > 0) {
            bagManager.addItem(itemId, amount);
            const itemName = getItemName(itemId);
            const qty = amount > 1 ? ` (x${amount})` : '';
            await this.ctx.showMessage(`${this.playerName} obtained\\n${itemName}${qty}!`);
            gameVariables.setVar('VAR_RESULT', 1); // TRUE = success
          } else {
            gameVariables.setVar('VAR_RESULT', 0); // FALSE = failed
          }
          break;
        }

        // --- finditem: overworld item pickup (like giveitem but "found" language) ---
        // C macro: sets VAR_0x8000=item, VAR_0x8001=amount, callstd STD_FIND_ITEM
        // Also sets the flag of the interacted object (item ball disappears)
        case 'finditem': {
          const findItemArg = asString(args[0]);
          const findAmount = args.length > 1 ? this.resolveVarOrConst(args[1]) : 1;
          let findItemId: number | null;
          if (findItemArg.startsWith('VAR_')) {
            findItemId = this.getVar(findItemArg);
          } else {
            findItemId = getItemId(findItemArg);
          }
          if (findItemId && findItemId > 0) {
            bagManager.addItem(findItemId, findAmount);
            const findItemName = getItemName(findItemId);
            const findQty = findAmount > 1 ? ` (x${findAmount})` : '';
            await this.ctx.showMessage(`${this.playerName} found\\n${findItemName}${findQty}!`);
            gameVariables.setVar('VAR_RESULT', 1);
          } else {
            gameVariables.setVar('VAR_RESULT', 0);
          }
          break;
        }

        // --- Trainer flags ---
        case 'settrainerflag': {
          const trainerName = asString(args[0]);
          setTrainerDefeated(trainerName);
          break;
        }

        case 'cleartrainerflag': {
          const trainerName = asString(args[0]);
          clearTrainerDefeated(trainerName);
          break;
        }

        case 'checktrainerflag': {
          const trainerName = asString(args[0]);
          gameVariables.setVar('VAR_RESULT', isTrainerDefeated(trainerName) ? 1 : 0);
          break;
        }

        // --- trainerbattle variants ---
        // C ref: public/pokeemerald/src/battle_setup.c
        // All variants check GetTrainerFlag (TRAINER_FLAGS_START + trainerId).
        // If defeated → fall through to next command (post-battle code).
        // If not defeated → show intro, battle, show defeat, set flag, run defeat script.
        // Until the battle system exists, undefeated trainers auto-win with defeat text.

        case 'trainerbattle_single': {
          // args: [trainerId, introText, defeatText, defeatScript?, noMusic?]
          const trainerId = asString(args[0]);
          if (isTrainerDefeated(trainerId)) break; // Already beaten → post-battle code

          // Show intro text
          const introLabel = asString(args[1]);
          const introRaw = this.findText(introLabel);
          if (introRaw) {
            await this.ctx.showMessage(formatScriptText(introRaw, this.playerName, this.playerGender));
          }

          // Battle (or auto-win placeholder)
          if (this.ctx.startTrainerBattle) {
            await this.ctx.startTrainerBattle(trainerId);
          } else {
            await this.ctx.delayFrames(16);
          }

          // Show defeat text
          const defeatLabel = asString(args[2]);
          const defeatRaw = this.findText(defeatLabel);
          if (defeatRaw) {
            await this.ctx.showMessage(formatScriptText(defeatRaw, this.playerName, this.playerGender));
          }

          // Set defeated flag
          setTrainerDefeated(trainerId);

          // Jump to defeat script if provided (4th arg, skipping NO_MUSIC flag)
          const defeatScriptArg = args.length > 3 ? asString(args[3]) : null;
          if (defeatScriptArg && defeatScriptArg !== 'NO_MUSIC') {
            const defeatTarget = this.findScript(defeatScriptArg);
            if (defeatTarget) {
              callStack.push({ commands, ip });
              commands = defeatTarget;
              ip = 0;
            }
          }
          break;
        }

        case 'trainerbattle_double': {
          // args: [trainerId, introText, defeatText, notEnoughText, defeatScript?, noMusic?]
          const trainerId = asString(args[0]);
          if (isTrainerDefeated(trainerId)) break;

          const introLabel = asString(args[1]);
          const introRaw = this.findText(introLabel);
          if (introRaw) {
            await this.ctx.showMessage(formatScriptText(introRaw, this.playerName, this.playerGender));
          }

          if (this.ctx.startTrainerBattle) {
            await this.ctx.startTrainerBattle(trainerId);
          } else {
            await this.ctx.delayFrames(16);
          }

          const defeatLabel = asString(args[2]);
          const defeatRaw = this.findText(defeatLabel);
          if (defeatRaw) {
            await this.ctx.showMessage(formatScriptText(defeatRaw, this.playerName, this.playerGender));
          }

          setTrainerDefeated(trainerId);

          const dblDefeatScript = args.length > 4 ? asString(args[4]) : null;
          if (dblDefeatScript && dblDefeatScript !== 'NO_MUSIC') {
            const target = this.findScript(dblDefeatScript);
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        case 'trainerbattle_rematch': {
          // args: [trainerId, introText, defeatText]
          // Rematch battles always proceed (the original defeat flag is already set)
          const trainerId = asString(args[0]);

          const introLabel = asString(args[1]);
          const introRaw = this.findText(introLabel);
          if (introRaw) {
            await this.ctx.showMessage(formatScriptText(introRaw, this.playerName, this.playerGender));
          }

          if (this.ctx.startTrainerBattle) {
            await this.ctx.startTrainerBattle(trainerId);
          } else {
            await this.ctx.delayFrames(16);
          }

          const defeatLabel = asString(args[2]);
          const defeatRaw = this.findText(defeatLabel);
          if (defeatRaw) {
            await this.ctx.showMessage(formatScriptText(defeatRaw, this.playerName, this.playerGender));
          }
          break;
        }

        case 'trainerbattle_rematch_double': {
          // args: [trainerId, introText, defeatText, notEnoughText]
          const trainerId = asString(args[0]);

          const introLabel = asString(args[1]);
          const introRaw = this.findText(introLabel);
          if (introRaw) {
            await this.ctx.showMessage(formatScriptText(introRaw, this.playerName, this.playerGender));
          }

          if (this.ctx.startTrainerBattle) {
            await this.ctx.startTrainerBattle(trainerId);
          } else {
            await this.ctx.delayFrames(16);
          }

          const defeatLabel = asString(args[2]);
          const defeatRaw = this.findText(defeatLabel);
          if (defeatRaw) {
            await this.ctx.showMessage(formatScriptText(defeatRaw, this.playerName, this.playerGender));
          }
          break;
        }

        case 'trainerbattle_no_intro': {
          // args: [trainerId, defeatText]
          // No intro text, used for scripted encounters (e.g. Team Aqua)
          const trainerId = asString(args[0]);
          if (isTrainerDefeated(trainerId)) break;

          if (this.ctx.startTrainerBattle) {
            await this.ctx.startTrainerBattle(trainerId);
          } else {
            await this.ctx.delayFrames(16);
          }

          const defeatTextLabel = args.length > 1 ? asString(args[1]) : null;
          if (defeatTextLabel) {
            const rawText = this.findText(defeatTextLabel);
            if (rawText) {
              await this.ctx.showMessage(formatScriptText(rawText, this.playerName, this.playerGender));
            }
          }

          setTrainerDefeated(trainerId);
          break;
        }

        // --- checkitem: check if player has an item in bag ---
        case 'checkitem': {
          const itemConstant = asString(args[0]);
          const checkItemId = getItemId(itemConstant);
          if (checkItemId && checkItemId > 0 && bagManager.hasItem(checkItemId)) {
            gameVariables.setVar('VAR_RESULT', 1); // TRUE
          } else {
            gameVariables.setVar('VAR_RESULT', 0); // FALSE
          }
          break;
        }

        // --- Money commands ---
        // C ref: public/pokeemerald/src/scrcmd.c — ScrCmd_givemoney, ScrCmd_paymoney, ScrCmd_checkmoney
        case 'givemoney':
        case 'addmoney': {
          const amount = this.resolveVarOrConst(args[0]);
          moneyManager.addMoney(amount);
          break;
        }

        case 'removemoney':
        case 'paymoney': {
          const amount = this.resolveVarOrConst(args[0]);
          moneyManager.removeMoney(amount);
          break;
        }

        case 'checkmoney': {
          const amount = this.resolveVarOrConst(args[0]);
          gameVariables.setVar('VAR_RESULT', moneyManager.isEnoughMoney(amount) ? 1 : 0);
          break;
        }

        case 'showmoneybox':
        case 'hidemoneybox':
        case 'updatemoneybox':
          // UI no-ops until money box overlay is implemented
          break;

        // --- Coin commands ---
        // C ref: public/pokeemerald/src/scrcmd.c — ScrCmd_checkcoins, ScrCmd_addcoins, ScrCmd_removecoins
        case 'checkcoins': {
          const destVar = asString(args[0]);
          gameVariables.setVar(destVar, moneyManager.getCoins());
          break;
        }

        case 'addcoins': {
          const amount = this.resolveVarOrConst(args[0]);
          moneyManager.addCoins(amount);
          break;
        }

        case 'removecoins': {
          const amount = this.resolveVarOrConst(args[0]);
          moneyManager.removeCoins(amount);
          break;
        }

        // --- setwildbattle: store species/level for upcoming wild battle ---
        case 'setwildbattle': {
          const speciesArg = args[0];
          const levelArg = args[1];
          const itemArg = args.length > 2 ? args[2] : 0;
          this.wildBattleSpecies = this.resolveVarOrConst(speciesArg);
          this.wildBattleLevel = this.resolveVarOrConst(levelArg);
          this.wildBattleItem = this.resolveVarOrConst(itemArg);
          console.log(`[ScriptRunner] setwildbattle: species=${this.wildBattleSpecies} lv=${this.wildBattleLevel} item=${this.wildBattleItem}`);
          break;
        }

        // --- dowildbattle: initiate wild battle ---
        case 'dowildbattle':
          if (this.ctx.startWildBattle) {
            await this.ctx.startWildBattle(this.wildBattleSpecies, this.wildBattleLevel);
          } else {
            console.log('[ScriptRunner] dowildbattle: auto-win (no battle system yet)');
            await this.ctx.delayFrames(16); // Brief pause to simulate battle
          }
          break;

        // --- fadescreenswapbuffers: alias for fadescreen ---
        case 'fadescreenswapbuffers':
          await this.ctx.delayFrames(16);
          break;

        // --- Visual priority (no-ops — z-ordering not critical for browser) ---
        case 'setobjectsubpriority':
        case 'resetobjectsubpriority':
          break;

        // --- goto_if_defeated / call_if_defeated ---
        // C ref: scrcmd.c — checks TRAINER_FLAGS_START + trainerId
        case 'goto_if_defeated': {
          const trainerId = asString(args[0]);
          if (isTrainerDefeated(trainerId)) {
            const target = this.findScript(asString(args[1]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'call_if_defeated': {
          const trainerId = asString(args[0]);
          if (isTrainerDefeated(trainerId)) {
            const target = this.findScript(asString(args[1]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        case 'goto_if_undefeated': {
          const trainerId = asString(args[0]);
          if (!isTrainerDefeated(trainerId)) {
            const target = this.findScript(asString(args[1]));
            if (target) { commands = target; ip = 0; }
          }
          break;
        }

        case 'call_if_undefeated': {
          const trainerId = asString(args[0]);
          if (!isTrainerDefeated(trainerId)) {
            const target = this.findScript(asString(args[1]));
            if (target) {
              callStack.push({ commands, ip });
              commands = target;
              ip = 0;
            }
          }
          break;
        }

        // --- setorcopyvar: if source >= VARS_START (0x4000), copy var; else set literal ---
        // C ref: scrcmd.c ScrCmd_setorcopyvar
        case 'setorcopyvar': {
          const dest = asString(args[0]);
          const src = args[1];
          if (typeof src === 'string' && src.startsWith('VAR_')) {
            gameVariables.setVar(dest, this.getVar(src));
          } else {
            gameVariables.setVar(dest, this.resolveVarOrConst(src));
          }
          break;
        }

        // --- compare: compare var to value, set condition for goto_if ---
        // C ref: sets sScriptConditionValue used by conditional gotos
        // Our goto_if_* commands read vars directly, so compare is mostly a no-op.
        // But some scripts use: compare VAR, value → goto_if_eq <label>
        // We implement by storing in VAR_RESULT-like mechanism.
        case 'compare': {
          // Store comparison result: 0=equal, 1=greater, 2=less
          // Actually in pokeemerald, compare just stores the values and
          // goto_if_eq/ne/lt/gt checks them. Our goto_if_* already reads
          // the var directly with inline comparison. So compare is a no-op
          // for our architecture.
          void args;
          break;
        }

        // --- warphole: warp with falling animation ---
        // C ref: scrcmd.c ScrCmd_warphole — uses player's current map-local tile
        // as destination coordinates. MAP_UNDEFINED resolves via setholewarp.
        case 'warphole': {
          const argMapId = args.length > 0 ? asString(args[0]) : '';
          let targetMapId = argMapId;
          if (argMapId === 'MAP_UNDEFINED') {
            targetMapId = getFixedHoleWarpTarget()?.mapId ?? '';
          }

          if (!targetMapId) {
            console.warn('[ScriptRunner] warphole: missing target map');
            break;
          }

          const playerLocal = this.ctx.getPlayerLocalPosition?.();
          if (!playerLocal) {
            console.warn('[ScriptRunner] warphole: player local position unavailable, falling back to (-1,-1)');
            this.ctx.queueWarp(targetMapId, -1, -1, 'down');
            break;
          }

          this.ctx.queueWarp(targetMapId, playerLocal.x, playerLocal.y, 'down');
          break;
        }

        // --- warpmossdeepgym: warp preserving object events ---
        case 'warpmossdeepgym': {
          const mapId = asString(args[0]);
          const x = asNumber(args[1]);
          const y = asNumber(args[2]);
          this.ctx.queueWarp(mapId, x, y, 'down');
          break;
        }

        // --- multichoice / multichoicedefault ---
        // C ref: scrcmd.c ScrCmd_multichoice — shows menu from sMultichoiceLists[id]
        // args: [left, top, multichoiceId, ignoreBPress]
        case 'multichoice':
        case 'multichoicedefault': {
          const multichoiceId = asNumber(args[2]);
          const ignoreBPress = asNumber(args[3]) === 1;
          const defaultChoice = cmd === 'multichoicedefault' ? asNumber(args[3]) : 0;
          const ignoreBForDefault = cmd === 'multichoicedefault' ? asNumber(args[4]) === 1 : ignoreBPress;

          const choices = getMultichoiceList(multichoiceId);
          if (choices) {
            const result = await this.ctx.showChoice(
              '',
              choices.map((label, i) => ({ label, value: i })),
              { cancelable: !ignoreBForDefault, defaultIndex: defaultChoice }
            );
            gameVariables.setVar('VAR_RESULT', result ?? 127); // 127 = MULTI_B_PRESSED
          } else {
            console.warn(`[ScriptRunner] Unknown multichoice ID: ${multichoiceId}`);
            gameVariables.setVar('VAR_RESULT', 0);
          }
          break;
        }

        // --- bufferspeciesname: store species name in STR_VAR_N ---
        case 'bufferspeciesname': {
          const destIdx = asNumber(args[0]);
          const species = asString(args[1]);
          const destKey = `STR_VAR_${destIdx + 1}`;
          // Species arg could be a VAR_ reference or a constant name
          let speciesId: number;
          if (species.startsWith('VAR_')) {
            speciesId = this.getVar(species);
          } else {
            speciesId = this.resolveVarOrConst(species);
          }
          stringVars[destKey] = getSpeciesName(speciesId) || 'POKéMON';
          break;
        }

        // --- buffernumberstring: store number as string in STR_VAR_N ---
        case 'buffernumberstring': {
          const destIdx = asNumber(args[0]);
          const numVal = this.resolveVarOrConst(args[1]);
          stringVars[`STR_VAR_${destIdx + 1}`] = String(numVal);
          break;
        }

        // --- bufferitemname: store item name in STR_VAR_N ---
        case 'bufferitemname': {
          const destIdx = asNumber(args[0]);
          const itemArg = args[1];
          let itemId: number;
          if (typeof itemArg === 'string' && itemArg.startsWith('VAR_')) {
            itemId = this.getVar(itemArg);
          } else {
            const resolved = typeof itemArg === 'string' ? getItemId(itemArg) : itemArg;
            itemId = resolved ?? 0;
          }
          stringVars[`STR_VAR_${destIdx + 1}`] = getItemName(itemId) || 'ITEM';
          break;
        }

        // --- bufferstdstring: store standard string in STR_VAR_N ---
        case 'bufferstdstring': {
          const destIdx = asNumber(args[0]);
          const stdId = this.resolveVarOrConst(args[1]);
          // Standard strings are indexed references; use numeric fallback
          stringVars[`STR_VAR_${destIdx + 1}`] = `STD_${stdId}`;
          break;
        }

        // --- bufferstring: copy raw text label into STR_VAR_N ---
        case 'bufferstring': {
          const destIdx = asNumber(args[0]);
          const textLabel = asString(args[1]);
          const rawText = this.findText(textLabel);
          if (rawText) {
            stringVars[`STR_VAR_${destIdx + 1}`] = formatScriptText(rawText, this.playerName, this.playerGender);
          }
          break;
        }

        // --- setflashlevel: set darkness radius (0=bright, 7=darkest) ---
        case 'setflashlevel': {
          const level = asNumber(args[0]);
          if (this.ctx.setFlashLevel) {
            this.ctx.setFlashLevel(level);
          }
          break;
        }

        // --- animateflash: animate flash level transition ---
        case 'animateflash': {
          const targetLevel = asNumber(args[0]);
          if (this.ctx.setFlashLevel) {
            this.ctx.setFlashLevel(targetLevel);
          }
          await this.ctx.delayFrames(16);
          break;
        }

        // --- setstepcallback: activate per-step callback ---
        case 'setstepcallback': {
          const callbackId = asNumber(args[0]);
          stepCallbackManager.setCallback(callbackId);
          break;
        }

        // --- Rotating tile puzzle (Mossdeep Gym / Trick House) ---
        // C ref: rotating_tile_puzzle.c
        case 'initrotatingtilepuzzle': {
          const isTrickHouse = asNumber(args[0]) === 1;
          rotatingTilePuzzle = { isTrickHouse, movedObjects: [] };
          break;
        }

        case 'moverotatingtileobjects': {
          if (!rotatingTilePuzzle) break;
          const colorRow = asNumber(args[0]);
          const base = rotatingTilePuzzle.isTrickHouse
            ? TRICK_HOUSE_ARROW_BASE
            : MOSSDEEP_GYM_ARROW_BASE;

          // Get all NPC local IDs on this map
          const npcIds = this.ctx.getAllNpcLocalIds?.(this.currentMapId) ?? [];
          const mapOffset = this.ctx.getMapOffset?.(this.currentMapId);
          if (!mapOffset) break;

          rotatingTilePuzzle.movedObjects = [];

          for (const localId of npcIds) {
            const pos = this.ctx.getNpcPosition?.(this.currentMapId, localId);
            if (!pos) continue;

            // Convert world → map-local to read metatile
            const localX = pos.tileX - mapOffset.offsetX;
            const localY = pos.tileY - mapOffset.offsetY;
            const metatile = this.ctx.getMapMetatile?.(this.currentMapId, localX, localY) ?? 0;

            // Check if this NPC is on an arrow tile of the matching color row
            const row = getArrowColorRow(metatile, base);
            if (row !== colorRow) continue;

            const dir = getArrowDirection(metatile, base);
            if (!dir) continue;

            // Save previous position for turn phase (CCW rotation reads arrow from old tile)
            rotatingTilePuzzle.movedObjects.push({
              localId,
              prevTileX: pos.tileX,
              prevTileY: pos.tileY,
            });

            // Start NPC walk animation in the arrow direction
            const promise = this.ctx.moveNpc(this.currentMapId, localId, dir, 'walk');
            this.pendingMovements.set(localId, promise);
          }
          break;
        }

        case 'turnrotatingtileobjects': {
          if (!rotatingTilePuzzle) break;

          for (const obj of rotatingTilePuzzle.movedObjects) {
            const pos = this.ctx.getNpcPosition?.(this.currentMapId, obj.localId);
            if (!pos) continue;

            // Get current facing direction and rotate CCW
            // We need to read the NPC's current direction — use moveNpc face mode
            // Since the C code rotates the NPC's facing direction CCW,
            // we approximate by getting current tile's arrow direction from *previous* position
            // and rotating that. In C, it reads the NPC's movement direction field.

            // Simpler approach: face the NPC in the CCW direction of where they just moved FROM
            const mapOffset = this.ctx.getMapOffset?.(this.currentMapId);
            if (!mapOffset) continue;

            const prevLocalX = obj.prevTileX - mapOffset.offsetX;
            const prevLocalY = obj.prevTileY - mapOffset.offsetY;
            const base = rotatingTilePuzzle.isTrickHouse
              ? TRICK_HOUSE_ARROW_BASE
              : MOSSDEEP_GYM_ARROW_BASE;
            const prevMetatile = this.ctx.getMapMetatile?.(this.currentMapId, prevLocalX, prevLocalY) ?? 0;
            const prevDir = getArrowDirection(prevMetatile, base);

            if (prevDir) {
              const newFacing = rotateCCW(prevDir);
              const promise = this.ctx.moveNpc(this.currentMapId, obj.localId, newFacing, 'face');
              this.pendingMovements.set(obj.localId, promise);
            }
          }
          break;
        }

        case 'freerotatingtilepuzzle':
          rotatingTilePuzzle = null;
          break;

        // --- Commands that are parsed but not yet implemented ---
        case 'setrespawn':
        case 'incrementgamestat':
        case 'register_matchcall':
          // No-ops or logged for future implementation
          break;

        default:
          console.warn(`[ScriptRunner] Unknown command: ${cmd}`, args);
          break;
      }
    }
  }

  /**
   * Execute a movement sequence on an object.
   * Resolves LOCALID_PLAYER to player movement, others to NPC movement.
   */
  /**
   * Resolve an argument that might be a VAR_ reference to a string ID.
   * Checks the local string store first (for LOCALID_ values stored via setvar).
   */
  private resolveObjectId(val: string): string {
    if (val.startsWith('VAR_')) {
      // Check local string store first (LOCALID_ strings)
      const strVal = this.localStringVars.get(val);
      if (strVal) return strVal;
      // Fall back to numeric var
      return String(this.getVar(val));
    }
    return val;
  }

  /**
   * Resolve the map context for an object command.
   * Scripts can reference LOCALID_* from a non-anchor map during long scripted
   * movement (e.g. Briney's boat ride), so we infer by localId when possible.
   */
  private resolveObjectMapId(objectId: string, explicitMapId?: string): string {
    if (explicitMapId && explicitMapId.startsWith('MAP_')) {
      return explicitMapId;
    }
    const resolvedId = this.resolveObjectId(objectId);
    if (resolvedId === 'LOCALID_PLAYER' || resolvedId === '255') {
      return this.currentMapId;
    }
    const inferredMapId = this.ctx.findNpcMapId?.(resolvedId);
    return inferredMapId ?? this.currentMapId;
  }

  private async executeMovement(
    objectId: string,
    steps: string[],
    objectMapId: string = this.resolveObjectMapId(objectId)
  ): Promise<void> {
    const resolvedId = this.resolveObjectId(objectId);
    const isPlayer = resolvedId === 'LOCALID_PLAYER' || resolvedId === '255';

    for (const step of steps) {
      // --- Emote commands (bubble animation stand-ins) ---
      if (step.startsWith('emote_')) {
        await this.ctx.delayFrames(8);
        continue;
      }

      // --- face_player: NPC turns toward player ---
      if (step === 'face_player') {
        if (!isPlayer) {
          this.ctx.faceNpcToPlayer(objectMapId, resolvedId);
        }
        await this.ctx.delayFrames(1);
        continue;
      }

      // --- face_away_player: NPC turns away from player ---
      if (step === 'face_away_player') {
        // Approximate: face toward player (should be reverse, but needs player pos)
        if (!isPlayer) {
          this.ctx.faceNpcToPlayer(objectMapId, resolvedId);
        }
        await this.ctx.delayFrames(1);
        continue;
      }

      // --- face_original_direction: restore spawn facing ---
      if (step === 'face_original_direction') {
        // Would need stored spawn direction; delay as no-op
        await this.ctx.delayFrames(1);
        continue;
      }

      // --- Visibility toggling ---
      // For NPCs, set_invisible/set_visible toggle spriteHidden (sprite only, NPC still blocks).
      // For player, toggle full visibility.
      if (step === 'set_invisible') {
        if (isPlayer) this.ctx.setPlayerVisible(false);
        else if (this.ctx.setSpriteHidden) this.ctx.setSpriteHidden(objectMapId, resolvedId, true);
        else this.ctx.setNpcVisible(objectMapId, resolvedId, false);
        continue;
      }
      if (step === 'set_visible') {
        if (isPlayer) this.ctx.setPlayerVisible(true);
        else if (this.ctx.setSpriteHidden) this.ctx.setSpriteHidden(objectMapId, resolvedId, false);
        else this.ctx.setNpcVisible(objectMapId, resolvedId, true);
        continue;
      }

      // --- State flags (no frame consumed) ---
      if (step === 'lock_facing_direction' || step === 'unlock_facing_direction' ||
          step === 'disable_anim' || step === 'restore_anim' ||
          step === 'lock_anim' || step === 'unlock_anim' ||
          step === 'set_fixed_priority' || step === 'clear_fixed_priority' ||
          step === 'enable_jump_landing_ground_effect' || step === 'disable_jump_landing_ground_effect' ||
          step === 'init_affine_anim' || step === 'clear_affine_anim' ||
          step === 'hide_reflection' || step === 'show_reflection' ||
          step === 'start_anim_in_direction') {
        continue;
      }

      // --- Delay commands ---
      if (step.startsWith('delay_')) {
        const frames = parseInt(step.replace('delay_', ''), 10);
        if (!isNaN(frames)) await this.ctx.delayFrames(frames);
        continue;
      }

      // --- Bidirectional bounce jumps (jump_in_place_down_up, etc.) ---
      if (step.startsWith('jump_in_place_') && (
        step.includes('_down_up') || step.includes('_up_down') ||
        step.includes('_left_right') || step.includes('_right_left')
      )) {
        // Face in the first direction, delay for bounce
        const firstDir = step.includes('_down_') ? 'down' :
                         step.includes('_up_') ? 'up' :
                         step.includes('_left_') ? 'left' : 'right';
        if (isPlayer) {
          await this.ctx.movePlayer(firstDir as Direction, 'face');
        } else {
          await this.ctx.moveNpc(objectMapId, resolvedId, firstDir as Direction, 'face');
        }
        await this.ctx.delayFrames(8);
        continue;
      }

      // --- Special one-off animations (delay as stand-in) ---
      if (step === 'nurse_joy_bow' || step === 'reveal_trainer' ||
          step === 'rock_smash_break' || step === 'cut_tree' ||
          step === 'figure_8' || step === 'fly_up' || step === 'fly_down' ||
          step === 'levitate' || step === 'stop_levitate' ||
          step === 'destroy_extra_task' ||
          step.startsWith('walk_down_') && step.includes('affine') ||
          step === 'walk_left_affine' || step === 'walk_right_affine') {
        await this.ctx.delayFrames(8);
        continue;
      }

      // --- Directional movement commands ---
      // Try to extract a direction from the command suffix
      const dir = movementToDirection(step);
      if (dir) {
        // Determine the movement mode from the command prefix
        let mode: ScriptMoveMode;

        if (step.startsWith('face_')) {
          // face_right, face_down, face_up, face_left — turn without moving
          mode = 'face';
        } else if (step.startsWith('walk_in_place_slow_')) {
          mode = 'walk_in_place_slow';
        } else if (step.startsWith('walk_in_place_fast_')) {
          mode = 'walk_in_place_fast';
        } else if (step.startsWith('walk_in_place_faster_')) {
          mode = 'walk_in_place_faster';
        } else if (step.startsWith('walk_in_place_')) {
          mode = 'walk_in_place';
        } else if (step.startsWith('acro_wheelie_face_') || step.startsWith('acro_end_wheelie_face_') ||
                   step.startsWith('acro_wheelie_in_place_') || step.startsWith('acro_wheelie_hop_face_') ||
                   step.startsWith('acro_pop_wheelie_') && !step.startsWith('acro_pop_wheelie_move_')) {
          mode = 'face';
        } else if (step.startsWith('jump_in_place_')) {
          mode = 'jump_in_place';
        } else if (step.startsWith('jump_') || step.startsWith('jump_2_') ||
                   step.startsWith('jump_special_') ||
                   step.startsWith('acro_wheelie_jump_')) {
          mode = 'jump';
        } else if (step.startsWith('slide_')) {
          mode = 'walk_fastest';
        } else if (step.startsWith('ride_water_current_')) {
          mode = 'ride_water_current';
        } else if (step.startsWith('player_run_')) {
          mode = 'run';
        } else if (step.startsWith('walk_slow_')) {
          mode = 'walk_slow';
        } else if (step.startsWith('walk_fast_')) {
          mode = 'walk_fast';
        } else if (step.startsWith('walk_faster_')) {
          mode = 'walk_faster';
        } else {
          // walk_*, walk_fast_*, walk_faster_*, walk_slow_*, slide_*,
          // player_run_*, ride_water_current_*, acro_wheelie_hop_*,
          // acro_wheelie_move_*, acro_pop_wheelie_move_*, acro_end_wheelie_move_*
          mode = 'walk';
        }

        if (isPlayer) {
          await this.ctx.movePlayer(dir, mode);
        } else {
          await this.ctx.moveNpc(objectMapId, resolvedId, dir, mode);
        }
        continue;
      }

      // --- Diagonal walks (no diagonal support yet, delay 1 frame) ---
      if (step.startsWith('walk_diag_') || step.startsWith('walk_slow_diag_')) {
        await this.ctx.delayFrames(1);
        continue;
      }

      // --- Catch-all: unknown command gets a warning + 1 frame delay ---
      console.warn(`[ScriptRunner] Unknown movement command: ${step}`);
      await this.ctx.delayFrames(1);
    }
  }

  /**
   * Execute a special function by name.
   * Returns a numeric result for specialvar, or undefined.
   */
  private async executeSpecial(name: string): Promise<number | undefined> {
    switch (name) {
      case 'GetRivalSonDaughterString':
        // Male player → rival is female → "daughter"; Female → "son"
        stringVars['STR_VAR_1'] = this.ctx.getPlayerGender() === 0 ? 'daughter' : 'son';
        return undefined;
      case 'GetPlayerBigGuyGirlString':
        stringVars['STR_VAR_1'] = this.ctx.getPlayerGender() === 0 ? 'big guy' : 'big girl';
        return undefined;
      case 'GetBattleOutcome':
        // Read from shared variable set by BattleState. Default to B_OUTCOME_WON (1).
        return gameVariables.getVar('VAR_BATTLE_OUTCOME') || 1;
      case 'ShouldTryRematchBattle':
        // Rematch system not implemented — always return FALSE (0).
        // Prevents gym leaders and 70+ rematchable trainers from
        // incorrectly entering the rematch branch after initial defeat.
        return 0;
      case 'ScriptMenu_CreateStartMenuForPokenavTutorial': {
        // Opens a fake start menu for PokéNav tutorial (RustboroCity scripts.inc:76–101).
        // The script's switch/case loops back for any selection other than POKéNAV (3).
        const menuResult = await this.ctx.showChoice(
          'START MENU',
          [
            { label: 'POKéDEX', value: 0 },
            { label: 'POKéMON', value: 1 },
            { label: 'BAG', value: 2 },
            { label: 'POKéNAV', value: 3 },
            { label: this.playerName, value: 4 },
            { label: 'SAVE', value: 5 },
            { label: 'OPTION', value: 6 },
            { label: 'EXIT', value: 7 },
          ],
          { cancelable: true }
        );
        gameVariables.setVar('VAR_RESULT', menuResult ?? 127);
        return undefined;
      }
      case 'OpenPokenavForTutorial':
        // Opens the full PokéNav UI — no-op since we don't have one.
        return undefined;

      // --- Wild battle setup specials ---
      // These all functionally trigger a wild battle using the parameters from setwildbattle.
      case 'BattleSetup_StartLegendaryBattle':
      case 'BattleSetup_StartGroudonBattle':
      case 'BattleSetup_StartKyogreBattle':
      case 'BattleSetup_StartRayquazaBattle':
      case 'BattleSetup_StartRegiBattle':
      case 'BattleSetup_StartLatiBattle':
      case 'StartGroudonKyogreBattle':
      case 'StartRegiBattle':
        if (this.ctx.startWildBattle) {
          await this.ctx.startWildBattle(this.wildBattleSpecies, this.wildBattleLevel);
        }
        return undefined;

      case 'TurnOffTVScreen':
        // TV raster toggle is visual-only in GBA; no-op for browser runtime.
        return undefined;
      case 'StartWallClock':
      case 'Special_ViewWallClock':
        // Wall clock UI is not implemented yet; keep scripts flowing.
        return undefined;
      case 'HealPlayerParty': {
        const party = this.ctx.getParty?.() ?? [];
        const healed = party.map((mon) => {
          if (!mon) return null;
          return {
            ...mon,
            status: STATUS.NONE,
            stats: { ...mon.stats, hp: mon.stats.maxHp },
            pp: mon.moves.map((moveId) => {
              if (moveId === 0) return 0;
              return getMoveInfo(moveId)?.pp ?? 0;
            }) as [number, number, number, number],
          };
        });
        this.ctx.setParty(healed);
        return undefined;
      }
      // --- DrawWholeMapView: refresh entire map rendering after batch setmetatile ---
      // C ref: field_camera.c — redraws all visible tiles from map grid
      case 'DrawWholeMapView':
        // Our setMapMetatile already calls pipeline.invalidate() per-tile.
        // This special just ensures a full refresh after batch operations.
        // Calling setMapMetatile with the same tile triggers re-render.
        // No additional action needed — pipeline already invalidated.
        return undefined;

      // --- Gym puzzle specials (dispatched to dedicated modules) ---
      case 'MauvilleGymSetDefaultBarriers':
        this.executeMauvilleGymSpecial(name);
        return undefined;
      case 'MauvilleGymPressSwitch':
        this.executeMauvilleGymSpecial(name);
        return undefined;
      case 'MauvilleGymDeactivatePuzzle':
        this.executeMauvilleGymSpecial(name);
        return undefined;
      case 'PetalburgGymSlideOpenRoomDoors':
        await this.executePetalburgGymSpecial(name);
        return undefined;
      case 'PetalburgGymUnlockRoomDoors':
        this.executePetalburgGymSpecial(name);
        return undefined;

      // --- Sootopolis Gym: restore cracked ice tiles from saved state ---
      case 'SetSootopolisGymCrackedIceMetatiles': {
        if (this.ctx.setMapMetatile) {
          const mapId = this.currentMapId;
          stepCallbackManager.setSootopolisGymCrackedIceMetatiles({
            setMapMetatile: (localX, localY, metatileId) => {
              this.ctx.setMapMetatile!(mapId, localX, localY, metatileId);
            },
            invalidateView: () => {
              // Pipeline invalidation handled by caller after ON_LOAD
            },
          });
        }
        return undefined;
      }
      case 'RotatingGate_InitPuzzle':
        rotatingGateManager.initPuzzle(this.currentMapId);
        return undefined;
      case 'RotatingGate_InitPuzzleAndGraphics':
        rotatingGateManager.initPuzzleAndGraphics(this.currentMapId);
        return undefined;

      default:
        console.warn(`[ScriptRunner] Unimplemented special: ${name}`);
        return undefined;
    }
  }

  /**
   * Dispatch Mauville Gym specials.
   */
  private executeMauvilleGymSpecial(name: string): void {
    if (!this.ctx.setMapMetatile || !this.ctx.getMapMetatile) {
      console.warn(`[ScriptRunner] ${name}: setMapMetatile/getMapMetatile not available`);
      return;
    }
    const mapId = this.currentMapId;
    const get = (x: number, y: number) => this.ctx.getMapMetatile!(mapId, x, y);
    const set = (x: number, y: number, id: number, impassable?: boolean) =>
      this.ctx.setMapMetatile!(mapId, x, y, id, impassable ? 1 : 0);

    const ML = METATILE_LABELS;

    if (name === 'MauvilleGymPressSwitch') {
      // C ref: field_specials.c — press one switch, raise others
      // C source uses MAP_OFFSET (7) for border tiles, but our map data has no border.
      // Coordinates are map-local content coordinates (0-indexed).
      const switchIdx = gameVariables.getVar('VAR_0x8004');
      const switchCoords = [
        { x: 0, y: 15 },
        { x: 4, y: 12 },
        { x: 3, y: 9 },
        { x: 8, y: 9 },
      ];
      for (let i = 0; i < switchCoords.length; i++) {
        const metatile = i === switchIdx
          ? ML['METATILE_MauvilleGym_PressedSwitch']
          : ML['METATILE_MauvilleGym_RaisedSwitch'];
        set(switchCoords[i].x, switchCoords[i].y, metatile);
      }
    } else if (name === 'MauvilleGymSetDefaultBarriers') {
      // C ref: field_specials.c — toggles all barriers on↔off
      // C source uses MAP_OFFSET (7) for border tiles, but our map data has no border.
      for (let y = 5; y < 17; y++) {
        for (let x = 0; x < 9; x++) {
          const tile = get(x, y);
          // FloorTile is context-dependent: check tile above to pick beam color
          // C: FloorTile → BeamV2_On | MAPGRID_IMPASSABLE
          if (tile === ML['METATILE_MauvilleGym_FloorTile']) {
            const above = get(x, y - 1);
            if (above === ML['METATILE_MauvilleGym_GreenBeamV1_On']) {
              set(x, y, ML['METATILE_MauvilleGym_GreenBeamV2_On'], true);
            } else {
              set(x, y, ML['METATILE_MauvilleGym_RedBeamV2_On'], true);
            }
            continue;
          }
          const swapped = this.mauvilleToggleBarrier(tile);
          if (swapped !== null) {
            set(x, y, swapped.metatile, swapped.impassable);
          }
        }
      }
    } else if (name === 'MauvilleGymDeactivatePuzzle') {
      // C ref: field_specials.c — press all switches, turn off all beams
      const switchCoords = [
        { x: 0, y: 15 },
        { x: 4, y: 12 },
        { x: 3, y: 9 },
        { x: 8, y: 9 },
      ];
      for (const coord of switchCoords) {
        set(coord.x, coord.y, ML['METATILE_MauvilleGym_PressedSwitch']);
      }
      for (let y = 5; y < 17; y++) {
        for (let x = 0; x < 9; x++) {
          const tile = get(x, y);
          const off = this.mauvilleDeactivateBarrier(tile);
          if (off !== null) {
            set(x, y, off.metatile, off.impassable);
          }
        }
      }
    }
  }

  /**
   * Toggle a Mauville Gym barrier tile between on/off states.
   * Returns { metatile, impassable } matching C source collision flags.
   * C ref: field_specials.c MauvilleGymSetDefaultBarriers()
   */
  private mauvilleToggleBarrier(tile: number): { metatile: number; impassable: boolean } | null {
    const ML = METATILE_LABELS;
    // Horizontal beams — On → Off (passable)
    switch (tile) {
      case ML['METATILE_MauvilleGym_GreenBeamH1_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH1_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_GreenBeamH2_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH2_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_GreenBeamH3_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH3_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_GreenBeamH4_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH4_Off'], impassable: false };
      // Horizontal beams — Off → On (H1/H2 passable, H3/H4 impassable)
      case ML['METATILE_MauvilleGym_GreenBeamH1_Off']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH1_On'], impassable: false };
      case ML['METATILE_MauvilleGym_GreenBeamH2_Off']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH2_On'], impassable: false };
      case ML['METATILE_MauvilleGym_GreenBeamH3_Off']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH3_On'], impassable: true };
      case ML['METATILE_MauvilleGym_GreenBeamH4_Off']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH4_On'], impassable: true };
      // Red horizontal beams — On → Off (passable)
      case ML['METATILE_MauvilleGym_RedBeamH1_On']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH1_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH2_On']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH2_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH3_On']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH3_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH4_On']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH4_Off'], impassable: false };
      // Red horizontal beams — Off → On (H1/H2 passable, H3/H4 impassable)
      case ML['METATILE_MauvilleGym_RedBeamH1_Off']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH1_On'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH2_Off']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH2_On'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH3_Off']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH3_On'], impassable: true };
      case ML['METATILE_MauvilleGym_RedBeamH4_Off']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH4_On'], impassable: true };
      // Vertical beams — on → pole bottom (impassable) / floor (passable)
      case ML['METATILE_MauvilleGym_GreenBeamV1_On']: return { metatile: ML['METATILE_MauvilleGym_PoleBottom_On'], impassable: true };
      case ML['METATILE_MauvilleGym_GreenBeamV2_On']: return { metatile: ML['METATILE_MauvilleGym_FloorTile'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamV1_On']: return { metatile: ML['METATILE_MauvilleGym_PoleBottom_Off'], impassable: true };
      case ML['METATILE_MauvilleGym_RedBeamV2_On']: return { metatile: ML['METATILE_MauvilleGym_FloorTile'], impassable: false };
      // Pole bottom → vertical beam on (impassable)
      case ML['METATILE_MauvilleGym_PoleBottom_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamV1_On'], impassable: true };
      case ML['METATILE_MauvilleGym_PoleBottom_Off']: return { metatile: ML['METATILE_MauvilleGym_RedBeamV1_On'], impassable: true };
      // Pole top toggle
      case ML['METATILE_MauvilleGym_PoleTop_Off']: return { metatile: ML['METATILE_MauvilleGym_PoleTop_On'], impassable: true };
      case ML['METATILE_MauvilleGym_PoleTop_On']: return { metatile: ML['METATILE_MauvilleGym_PoleTop_Off'], impassable: false };
      // FloorTile — needs context check (above tile) — handled specially
      case ML['METATILE_MauvilleGym_FloorTile']: return null; // context-dependent, skip
      default: return null;
    }
  }

  /**
   * Deactivate a Mauville Gym barrier tile (turn beams off).
   * Returns { metatile, impassable } matching C source collision flags.
   * C ref: field_specials.c MauvilleGymDeactivatePuzzle()
   */
  private mauvilleDeactivateBarrier(tile: number): { metatile: number; impassable: boolean } | null {
    const ML = METATILE_LABELS;
    switch (tile) {
      // All horizontal beams → Off (passable)
      case ML['METATILE_MauvilleGym_GreenBeamH1_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH1_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_GreenBeamH2_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH2_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_GreenBeamH3_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH3_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_GreenBeamH4_On']: return { metatile: ML['METATILE_MauvilleGym_GreenBeamH4_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH1_On']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH1_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH2_On']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH2_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH3_On']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH3_Off'], impassable: false };
      case ML['METATILE_MauvilleGym_RedBeamH4_On']: return { metatile: ML['METATILE_MauvilleGym_RedBeamH4_Off'], impassable: false };
      // Vertical beams → poles (impassable) / floor (passable)
      case ML['METATILE_MauvilleGym_GreenBeamV1_On']: return { metatile: ML['METATILE_MauvilleGym_PoleBottom_On'], impassable: true };
      case ML['METATILE_MauvilleGym_RedBeamV1_On']: return { metatile: ML['METATILE_MauvilleGym_PoleBottom_Off'], impassable: true };
      case ML['METATILE_MauvilleGym_GreenBeamV2_On']:
      case ML['METATILE_MauvilleGym_RedBeamV2_On']:
        return { metatile: ML['METATILE_MauvilleGym_FloorTile'], impassable: false };
      // Pole top → off (passable)
      case ML['METATILE_MauvilleGym_PoleTop_On']: return { metatile: ML['METATILE_MauvilleGym_PoleTop_Off'], impassable: false };
      default: return null;
    }
  }

  /**
   * Dispatch Petalburg Gym specials.
   */
  private async executePetalburgGymSpecial(name: string): Promise<void> {
    if (!this.ctx.setMapMetatile) {
      console.warn(`[ScriptRunner] ${name}: setMapMetatile not available`);
      return;
    }
    const mapId = this.currentMapId;
    // C ref: PetalburgGymSetDoorMetatiles always uses MAPGRID_IMPASSABLE
    const set = (x: number, y: number, id: number) => this.ctx.setMapMetatile!(mapId, x, y, id, 1);
    const ML = METATILE_LABELS;
    const METATILE_ROW_WIDTH_PET = 8; // Standard metatile row width

    const roomNumber = gameVariables.getVar('VAR_0x8004');

    // Door coordinates per room (from C source sPetalburgGymSlidingDoorCoords).
    // C source stores content coordinates (no MAP_OFFSET); our map data is also content-only.
    interface DoorCoord { x: number; y: number }
    const doorCoords: DoorCoord[] = [];
    switch (roomNumber) {
      case 1: doorCoords.push({ x: 1, y: 104 }, { x: 7, y: 104 }); break;
      case 2: doorCoords.push({ x: 1, y: 78 }, { x: 7, y: 78 }); break;
      case 3: doorCoords.push({ x: 1, y: 91 }, { x: 7, y: 91 }); break;
      case 4: doorCoords.push({ x: 7, y: 39 }); break;
      case 5: doorCoords.push({ x: 1, y: 52 }, { x: 7, y: 52 }); break;
      case 6: doorCoords.push({ x: 1, y: 65 }); break;
      case 7: doorCoords.push({ x: 7, y: 13 }); break;
      case 8: doorCoords.push({ x: 1, y: 26 }); break;
    }

    const slidingDoorFrames = [
      ML['METATILE_PetalburgGym_SlidingDoor_Frame0'],
      ML['METATILE_PetalburgGym_SlidingDoor_Frame1'],
      ML['METATILE_PetalburgGym_SlidingDoor_Frame2'],
      ML['METATILE_PetalburgGym_SlidingDoor_Frame3'],
      ML['METATILE_PetalburgGym_SlidingDoor_Frame4'],
    ];

    if (name === 'PetalburgGymUnlockRoomDoors') {
      // Instant: set to final frame
      const finalFrame = slidingDoorFrames[4];
      for (const door of doorCoords) {
        set(door.x, door.y, finalFrame);
        set(door.x, door.y + 1, finalFrame + METATILE_ROW_WIDTH_PET);
      }
    } else if (name === 'PetalburgGymSlideOpenRoomDoors') {
      // Animated: cycle through 5 frames
      for (const frame of slidingDoorFrames) {
        for (const door of doorCoords) {
          set(door.x, door.y, frame);
          set(door.x, door.y + 1, frame + METATILE_ROW_WIDTH_PET);
        }
        await this.ctx.delayFrames(4); // ~4 frame delay between animation frames
      }
    }
  }

  /**
   * Resolve a direction constant (or number) to a direction string.
   */
  private resolveDirection(val: string | number): Direction | null {
    const s = asString(val);
    // GBA: DIR_SOUTH=1, DIR_NORTH=2, DIR_WEST=3, DIR_EAST=4
    if (s === 'DIR_UP' || s === 'DIR_NORTH' || s === '2') return 'up';
    if (s === 'DIR_DOWN' || s === 'DIR_SOUTH' || s === '1') return 'down';
    if (s === 'DIR_LEFT' || s === 'DIR_WEST' || s === '3') return 'left';
    if (s === 'DIR_RIGHT' || s === 'DIR_EAST' || s === '4') return 'right';
    if (s === 'up' || s === 'down' || s === 'left' || s === 'right') return s as Direction;
    return null;
  }
}

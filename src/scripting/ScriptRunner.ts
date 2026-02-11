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
import {
  setDynamicObjectGfxVar,
  getDynamicObjectGfxVar,
  clearDynamicObjectGfxVar,
} from '../game/DynamicObjectGfx';
import { getSpeciesName } from '../data/species';
import { getItemId, getItemName } from '../data/items';
import { bagManager } from '../game/BagManager';
import { saveStateStore } from '../save/SaveStateStore';

/** Direction string used by StoryScriptContext */
type Direction = 'up' | 'down' | 'left' | 'right';

/** Constants that the C source uses but we resolve at runtime */
const GENDER_MALE = 0;
const GENDER_FEMALE = 1;

/**
 * Metatile label → numeric ID mapping.
 * C reference: public/pokeemerald/include/constants/metatile_labels.h
 */
const METATILE_LABELS: Record<string, number> = {
  'METATILE_BrendansMaysHouse_MovingBox_Closed': 0x268,
  'METATILE_BrendansMaysHouse_MovingBox_Open': 0x270,
  'METATILE_InsideOfTruck_ExitLight_Top': 0x208,
  'METATILE_InsideOfTruck_ExitLight_Mid': 0x210,
  'METATILE_InsideOfTruck_ExitLight_Bottom': 0x218,
  'METATILE_InsideOfTruck_DoorClosedFloor_Top': 0x20D,
  'METATILE_InsideOfTruck_DoorClosedFloor_Mid': 0x215,
  'METATILE_InsideOfTruck_DoorClosedFloor_Bottom': 0x21D,
};

/**
 * Resolve a constant name to its numeric value.
 * In the C source these are #defines; we handle the common ones here.
 */
function resolveConstant(val: string | number): string | number {
  if (typeof val === 'number') return val;
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
          const isPlayerObj = resolvedObjId === 'LOCALID_PLAYER' || resolvedObjId === '255';
          // Pre-check: if targeting an NPC that doesn't exist, skip entirely
          if (!isPlayerObj && this.ctx.hasNpc) {
            if (!this.ctx.hasNpc(this.currentMapId, resolvedObjId)) {
              console.warn(`[ScriptRunner] applymovement skipped: NPC ${resolvedObjId} not found on ${this.currentMapId}`);
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
          const promise = this.executeMovement(objectId, steps);
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
          this.ctx.setNpcVisible(this.currentMapId, resolvedId, true);
          break;
        }

        case 'removeobject': {
          const localId = asString(args[0]);
          const resolvedId = localId.startsWith('VAR_')
            ? String(this.getVar(localId))
            : localId;
          this.ctx.setNpcVisible(this.currentMapId, resolvedId, false);
          break;
        }

        case 'setobjectxy':
        case 'setobjectxyperm': {
          const localId = asString(args[0]);
          const x = asNumber(args[1]);
          const y = asNumber(args[2]);
          this.ctx.setNpcPosition(this.currentMapId, localId, x, y);
          break;
        }

        case 'copyobjectxytoperm': {
          // C ref: ScrCmd_copyobjectxytoperm in scrcmd.c
          // Copies NPC's current runtime position back to the persistent template
          // so the NPC stays at the new position across save/load.
          const localId = this.resolveObjectId(asString(args[0]));
          if (this.ctx.getNpcPosition && this.ctx.getMapOffset) {
            const worldPos = this.ctx.getNpcPosition(this.currentMapId, localId);
            const mapOffset = this.ctx.getMapOffset(this.currentMapId);
            if (worldPos && mapOffset) {
              // Convert world coords back to map-local (subtract map offset)
              const localX = worldPos.tileX - mapOffset.offsetX;
              const localY = worldPos.tileY - mapOffset.offsetY;
              saveStateStore.setObjectEventOverride(this.currentMapId, localId, localX, localY);
            }
          }
          break;
        }

        case 'turnobject': {
          const localId = asString(args[0]);
          const dir = this.resolveDirection(args[1]);
          if (dir) {
            this.ctx.moveNpc(this.currentMapId, localId, dir, 'face');
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
          this.ctx.queueWarp(mapId, x, y, 'up');
          break;
        }

        case 'setdynamicwarp': {
          const mapId = args[0] as string;
          const x = asNumber(args[1]);
          const y = asNumber(args[2]);
          setDynamicWarpTarget(mapId, x, y);
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
          this.executeSpecial(specialName);
          break;
        }

        case 'specialvar': {
          const destVar = asString(args[0]);
          const specialName = asString(args[1]);
          const result = this.executeSpecial(specialName);
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
          if (this.ctx.setMapMetatile) {
            this.ctx.setMapMetatile(this.currentMapId, x, y, metatileId);
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

        // --- hideobjectat: hide NPC at specific map ---
        case 'hideobjectat': {
          const localId = asString(args[0]);
          const mapId = args.length > 1 ? asString(args[1]) : this.currentMapId;
          this.ctx.setNpcVisible(mapId, localId, false);
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

        case 'trainerbattle_no_intro': {
          const trainerId = asString(args[0]);
          if (this.ctx.startTrainerBattle) {
            await this.ctx.startTrainerBattle(trainerId);
          } else {
            console.warn(`[ScriptRunner] trainerbattle_no_intro not available in context: ${trainerId}`);
          }

          const defeatTextLabel = args.length > 1 ? asString(args[1]) : null;
          if (defeatTextLabel) {
            const rawText = this.findText(defeatTextLabel);
            if (rawText) {
              await this.ctx.showMessage(formatScriptText(rawText, this.playerName, this.playerGender));
            }
          }
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

        // --- setwildbattle: store species/level for upcoming wild battle ---
        case 'setwildbattle': {
          const species = asString(args[0]);
          const level = asNumber(args[1]);
          console.log(`[ScriptRunner] setwildbattle: ${species} lv${level} (stub — no battle system)`);
          break;
        }

        // --- dowildbattle: initiate wild battle (stub: auto-win) ---
        case 'dowildbattle':
          console.log('[ScriptRunner] dowildbattle: auto-win (no battle system yet)');
          await this.ctx.delayFrames(16); // Brief pause to simulate battle
          break;

        // --- fadescreenswapbuffers: alias for fadescreen ---
        case 'fadescreenswapbuffers':
          await this.ctx.delayFrames(16);
          break;

        // --- Commands that are parsed but not yet implemented ---
        case 'setstepcallback':
        case 'setrespawn':
        case 'incrementgamestat':
        case 'trainerbattle':
        case 'multichoice':
        case 'compare':
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

  private async executeMovement(objectId: string, steps: string[]): Promise<void> {
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
          this.ctx.faceNpcToPlayer(this.currentMapId, resolvedId);
        }
        await this.ctx.delayFrames(1);
        continue;
      }

      // --- face_away_player: NPC turns away from player ---
      if (step === 'face_away_player') {
        // Approximate: face toward player (should be reverse, but needs player pos)
        if (!isPlayer) {
          this.ctx.faceNpcToPlayer(this.currentMapId, resolvedId);
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
        else if (this.ctx.setSpriteHidden) this.ctx.setSpriteHidden(this.currentMapId, resolvedId, true);
        else this.ctx.setNpcVisible(this.currentMapId, resolvedId, false);
        continue;
      }
      if (step === 'set_visible') {
        if (isPlayer) this.ctx.setPlayerVisible(true);
        else if (this.ctx.setSpriteHidden) this.ctx.setSpriteHidden(this.currentMapId, resolvedId, false);
        else this.ctx.setNpcVisible(this.currentMapId, resolvedId, true);
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
          await this.ctx.moveNpc(this.currentMapId, resolvedId, firstDir as Direction, 'face');
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
        let mode: 'walk' | 'face' | 'jump' | 'jump_in_place';

        if (step.startsWith('face_')) {
          // face_right, face_down, face_up, face_left — turn without moving
          mode = 'face';
        } else if (step.startsWith('walk_in_place') || step.startsWith('walk_in_place_slow_') ||
            step.startsWith('walk_in_place_fast_') || step.startsWith('walk_in_place_faster_')) {
          mode = 'face';
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
        } else {
          // walk_*, walk_fast_*, walk_faster_*, walk_slow_*, slide_*,
          // player_run_*, ride_water_current_*, acro_wheelie_hop_*,
          // acro_wheelie_move_*, acro_pop_wheelie_move_*, acro_end_wheelie_move_*
          mode = 'walk';
        }

        if (isPlayer) {
          await this.ctx.movePlayer(dir, mode);
        } else {
          await this.ctx.moveNpc(this.currentMapId, resolvedId, dir, mode);
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
  private executeSpecial(name: string): number | undefined {
    switch (name) {
      case 'GetRivalSonDaughterString':
        // Male player → rival is female → "daughter"; Female → "son"
        stringVars['STR_VAR_1'] = this.ctx.getPlayerGender() === 0 ? 'daughter' : 'son';
        return undefined;
      case 'GetPlayerBigGuyGirlString':
        stringVars['STR_VAR_1'] = this.ctx.getPlayerGender() === 0 ? 'big guy' : 'big girl';
        return undefined;
      case 'GetBattleOutcome':
        // Return B_OUTCOME_WON (1) — no battle system yet, auto-win
        return 1;
      default:
        console.warn(`[ScriptRunner] Unimplemented special: ${name}`);
        return undefined;
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

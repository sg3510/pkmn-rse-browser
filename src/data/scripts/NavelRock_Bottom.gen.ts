// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "NavelRock_Bottom_OnTransition",
    onResume: "NavelRock_Bottom_OnResume",
  },
  scripts: {
    "NavelRock_Bottom_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_CAUGHT_LUGIA", "NavelRock_Bottom_EventScript_HideLugia"] },
      { cmd: "call_if_unset", args: ["FLAG_CAUGHT_LUGIA", "NavelRock_Bottom_EventScript_TryShowLugia"] },
      { cmd: "end" },
    ],
    "NavelRock_Bottom_EventScript_HideLugia": [
      { cmd: "setflag", args: ["FLAG_HIDE_LUGIA"] },
      { cmd: "return" },
    ],
    "NavelRock_Bottom_EventScript_TryShowLugia": [
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_LUGIA", "Common_EventScript_NopReturn"] },
      { cmd: "clearflag", args: ["FLAG_HIDE_LUGIA"] },
      { cmd: "return" },
    ],
    "NavelRock_Bottom_OnResume": [
      { cmd: "call_if_set", args: ["FLAG_SYS_CTRL_OBJ_DELETE", "NavelRock_Bottom_EventScript_TryRemoveLugia"] },
      { cmd: "end" },
    ],
    "NavelRock_Bottom_EventScript_TryRemoveLugia": [
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "B_OUTCOME_CAUGHT", "Common_EventScript_NopReturn"] },
      { cmd: "removeobject", args: ["LOCALID_NAVEL_ROCK_LUGIA"] },
      { cmd: "return" },
    ],
    "NavelRock_Bottom_EventScript_Lugia": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "delay", args: [20] },
      { cmd: "playse", args: ["SE_THUNDERSTORM_STOP"] },
      { cmd: "setvar", args: ["VAR_0x8004", 0] },
      { cmd: "setvar", args: ["VAR_0x8005", 3] },
      { cmd: "setvar", args: ["VAR_0x8006", 4] },
      { cmd: "setvar", args: ["VAR_0x8007", 2] },
      { cmd: "special", args: ["ShakeCamera"] },
      { cmd: "delay", args: [30] },
      { cmd: "playse", args: ["SE_THUNDERSTORM_STOP"] },
      { cmd: "setvar", args: ["VAR_0x8004", 0] },
      { cmd: "setvar", args: ["VAR_0x8005", 3] },
      { cmd: "setvar", args: ["VAR_0x8006", 4] },
      { cmd: "setvar", args: ["VAR_0x8007", 2] },
      { cmd: "special", args: ["ShakeCamera"] },
      { cmd: "delay", args: [30] },
      { cmd: "delay", args: [50] },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_LUGIA", "CRY_MODE_ENCOUNTER"] },
      { cmd: "waitmoncry" },
      { cmd: "delay", args: [20] },
      { cmd: "seteventmon", args: ["SPECIES_LUGIA", 70] },
      { cmd: "setflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "special", args: ["BattleSetup_StartLegendaryBattle"] },
      { cmd: "waitstate" },
      { cmd: "clearflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_WON", "NavelRock_Bottom_EventScript_DefeatedLugia"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_RAN", "NavelRock_Bottom_EventScript_RanFromLugia"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_PLAYER_TELEPORTED", "NavelRock_Bottom_EventScript_RanFromLugia"] },
      { cmd: "setflag", args: ["FLAG_CAUGHT_LUGIA"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "NavelRock_Bottom_EventScript_DefeatedLugia": [
      { cmd: "setflag", args: ["FLAG_DEFEATED_LUGIA"] },
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIES_LUGIA"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
    "NavelRock_Bottom_EventScript_RanFromLugia": [
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIES_LUGIA"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

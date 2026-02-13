// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "BirthIsland_Exterior_OnTransition",
    onResume: "BirthIsland_Exterior_OnResume",
    onReturnToField: "BirthIsland_Exterior_OnReturnToField",
  },
  scripts: {
    "BirthIsland_Exterior_OnReturnToField": [
      { cmd: "special", args: ["SetDeoxysRockPalette"] },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_OnTransition": [
      { cmd: "setflag", args: ["FLAG_MAP_SCRIPT_CHECKED_DEOXYS"] },
      { cmd: "setvar", args: ["VAR_OBJ_GFX_ID_0", "OBJ_EVENT_GFX_RIVAL_BRENDAN_NORMAL"] },
      { cmd: "setvar", args: ["VAR_DEOXYS_ROCK_STEP_COUNT", 0] },
      { cmd: "setvar", args: ["VAR_DEOXYS_ROCK_LEVEL", 0] },
      { cmd: "call_if_set", args: ["FLAG_BATTLED_DEOXYS", "BirthIsland_Exterior_EventScript_HideDeoxysAndPuzzle"] },
      { cmd: "call_if_unset", args: ["FLAG_BATTLED_DEOXYS", "BirthIsland_Exterior_EventScript_TryShowDeoxysPuzzle"] },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_EventScript_HideDeoxysAndPuzzle": [
      { cmd: "setflag", args: ["FLAG_HIDE_DEOXYS"] },
      { cmd: "setflag", args: ["FLAG_HIDE_BIRTH_ISLAND_DEOXYS_TRIANGLE"] },
      { cmd: "return" },
    ],
    "BirthIsland_Exterior_EventScript_TryShowDeoxysPuzzle": [
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_DEOXYS", "Common_EventScript_NopReturn"] },
      { cmd: "clearflag", args: ["FLAG_HIDE_BIRTH_ISLAND_DEOXYS_TRIANGLE"] },
      { cmd: "clearflag", args: ["FLAG_DEOXYS_ROCK_COMPLETE"] },
      { cmd: "return" },
    ],
    "BirthIsland_Exterior_OnResume": [
      { cmd: "call_if_set", args: ["FLAG_SYS_CTRL_OBJ_DELETE", "BirthIsland_Exterior_EventScript_TryRemoveDeoxys"] },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_EventScript_TryRemoveDeoxys": [
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "B_OUTCOME_CAUGHT", "Common_EventScript_NopReturn"] },
      { cmd: "removeobject", args: ["LOCALID_BIRTH_ISLAND_DEOXYS"] },
      { cmd: "return" },
    ],
    "BirthIsland_Exterior_EventScript_Triangle": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "special", args: ["DoDeoxysRockInteraction"] },
      { cmd: "waitstate" },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: ["DEOXYS_ROCK_FAILED", "BirthIsland_Exterior_EventScript_Failed"] },
      { cmd: "case", args: ["DEOXYS_ROCK_PROGRESSED", "BirthIsland_Exterior_EventScript_Progressed"] },
      { cmd: "case", args: ["DEOXYS_ROCK_SOLVED", "BirthIsland_Exterior_EventScript_Deoxys"] },
      { cmd: "case", args: ["DEOXYS_ROCK_COMPLETE", "BirthIsland_Exterior_EventScript_Complete"] },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_EventScript_Failed": [
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_EventScript_Progressed": [
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_EventScript_Complete": [
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_EventScript_Deoxys": [
      { cmd: "waitse" },
      { cmd: "setfieldeffectargument", args: [0, "LOCALID_BIRTH_ISLAND_EXTERIOR_ROCK"] },
      { cmd: "setfieldeffectargument", args: [1, "MAP_NUM(MAP_BIRTH_ISLAND_EXTERIOR)"] },
      { cmd: "setfieldeffectargument", args: [2, "MAP_GROUP(MAP_BIRTH_ISLAND_EXTERIOR)"] },
      { cmd: "dofieldeffect", args: ["FLDEFF_DESTROY_DEOXYS_ROCK"] },
      { cmd: "playbgm", args: ["MUS_RG_ENCOUNTER_DEOXYS", "FALSE"] },
      { cmd: "waitfieldeffect", args: ["FLDEFF_DESTROY_DEOXYS_ROCK"] },
      { cmd: "addobject", args: ["LOCALID_BIRTH_ISLAND_DEOXYS"] },
      { cmd: "applymovement", args: ["LOCALID_BIRTH_ISLAND_DEOXYS", "BirthIsland_Exterior_Movement_DeoxysApproach"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_DEOXYS", "CRY_MODE_ENCOUNTER"] },
      { cmd: "delay", args: [40] },
      { cmd: "waitmoncry" },
      { cmd: "setvar", args: ["VAR_LAST_TALKED", "LOCALID_BIRTH_ISLAND_DEOXYS"] },
      { cmd: "seteventmon", args: ["SPECIES_DEOXYS", 30] },
      { cmd: "setflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "special", args: ["BattleSetup_StartLegendaryBattle"] },
      { cmd: "waitstate" },
      { cmd: "clearflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_WON", "BirthIsland_Exterior_EventScript_DefeatedDeoxys"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_RAN", "BirthIsland_Exterior_EventScript_RanFromDeoxys"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_PLAYER_TELEPORTED", "BirthIsland_Exterior_EventScript_RanFromDeoxys"] },
      { cmd: "setflag", args: ["FLAG_BATTLED_DEOXYS"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_EventScript_DefeatedDeoxys": [
      { cmd: "setflag", args: ["FLAG_DEFEATED_DEOXYS"] },
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIES_DEOXYS"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
    "BirthIsland_Exterior_EventScript_RanFromDeoxys": [
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIES_DEOXYS"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "BirthIsland_Exterior_Movement_DeoxysApproach": ["walk_slow_down", "walk_slow_down", "walk_slow_down", "walk_slow_down", "walk_slow_down", "walk_slow_down", "walk_slow_down"],
  },
  text: {
  },
};

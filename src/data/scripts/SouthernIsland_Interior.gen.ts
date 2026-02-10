// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SouthernIsland_Interior_OnTransition",
    onResume: "SouthernIsland_Interior_OnResume",
  },
  scripts: {
    "SouthernIsland_Interior_OnResume": [
      { cmd: "call_if_set", args: ["FLAG_SYS_CTRL_OBJ_DELETE", "SouthernIsland_Interior_EventScript_TryRemoveLati"] },
      { cmd: "end" },
    ],
    "SouthernIsland_Interior_EventScript_TryRemoveLati": [
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "B_OUTCOME_CAUGHT", "Common_EventScript_NopReturn"] },
      { cmd: "removeobject", args: ["LOCALID_SOUTHERN_ISLAND_LATI"] },
      { cmd: "return" },
    ],
    "SouthernIsland_Interior_OnTransition": [
      { cmd: "call_if_eq", args: ["VAR_ROAMER_POKEMON", 0, "SouthernIsland_Interior_EventScript_SetUpLatios"] },
      { cmd: "call_if_ne", args: ["VAR_ROAMER_POKEMON", 0, "SouthernIsland_Interior_EventScript_SetUpLatias"] },
      { cmd: "call", args: ["SouthernIsland_Interior_EventScript_SetUpPlayerGfx"] },
      { cmd: "end" },
    ],
    "SouthernIsland_Interior_EventScript_SetUpLatios": [
      { cmd: "setvar", args: ["VAR_OBJ_GFX_ID_1", "OBJ_EVENT_GFX_LATIOS"] },
      { cmd: "setvar", args: ["VAR_TEMP_4", "SPECIES_LATIOS"] },
      { cmd: "return" },
    ],
    "SouthernIsland_Interior_EventScript_SetUpLatias": [
      { cmd: "setvar", args: ["VAR_OBJ_GFX_ID_1", "OBJ_EVENT_GFX_LATIAS"] },
      { cmd: "setvar", args: ["VAR_TEMP_4", "SPECIES_LATIAS"] },
      { cmd: "return" },
    ],
    "SouthernIsland_Interior_EventScript_SetUpPlayerGfx": [
      { cmd: "checkplayergender" },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "MALE", "SouthernIsland_Interior_EventScript_SetBrendanGfx"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FEMALE", "SouthernIsland_Interior_EventScript_SetMayGfx"] },
      { cmd: "end" },
    ],
    "SouthernIsland_Interior_EventScript_SetBrendanGfx": [
      { cmd: "setvar", args: ["VAR_OBJ_GFX_ID_0", "OBJ_EVENT_GFX_RIVAL_BRENDAN_NORMAL"] },
      { cmd: "return" },
    ],
    "SouthernIsland_Interior_EventScript_SetMayGfx": [
      { cmd: "setvar", args: ["VAR_OBJ_GFX_ID_0", "OBJ_EVENT_GFX_RIVAL_MAY_NORMAL"] },
      { cmd: "return" },
    ],
    "SouthernIsland_Interior_EventScript_TryLatiEncounter": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8008", 12] },
      { cmd: "goto", args: ["SouthernIsland_Interior_EventScript_Lati"] },
      { cmd: "end" },
    ],
    "SouthernIsland_Interior_EventScript_Lati": [
      { cmd: "goto_if_set", args: ["FLAG_TEMP_2", "SouthernIsland_Interior_EventScript_Sign"] },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_LATIAS_OR_LATIOS", "SouthernIsland_Interior_EventScript_Sign"] },
      { cmd: "goto_if_set", args: ["FLAG_CAUGHT_LATIAS_OR_LATIOS", "SouthernIsland_Interior_EventScript_Sign"] },
      { cmd: "goto_if_unset", args: ["FLAG_ENABLE_SHIP_SOUTHERN_ISLAND", "SouthernIsland_Interior_EventScript_Sign"] },
      { cmd: "setflag", args: ["FLAG_ENCOUNTERED_LATIAS_OR_LATIOS"] },
      { cmd: "setflag", args: ["FLAG_TEMP_2"] },
      { cmd: "special", args: ["SpawnCameraObject"] },
      { cmd: "applymovement", args: ["LOCALID_CAMERA", "SouthernIsland_Interior_Movement_CameraPanUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [50] },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["VAR_TEMP_4", "CRY_MODE_NORMAL"] },
      { cmd: "delay", args: [30] },
      { cmd: "waitmoncry" },
      { cmd: "addobject", args: ["LOCALID_SOUTHERN_ISLAND_LATI"] },
      { cmd: "delay", args: [30] },
      { cmd: "applymovement", args: ["LOCALID_CAMERA", "SouthernIsland_Interior_Movement_CameraPanDown"] },
      { cmd: "applymovement", args: ["LOCALID_SOUTHERN_ISLAND_LATI", "SouthernIsland_Interior_Movement_LatiApproach"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [50] },
      { cmd: "special", args: ["RemoveCameraObject"] },
      { cmd: "setvar", args: ["VAR_LAST_TALKED", "LOCALID_SOUTHERN_ISLAND_LATI"] },
      { cmd: "call_if_eq", args: ["VAR_ROAMER_POKEMON", 0, "SouthernIsland_Interior_EventScript_SetLatiosBattleVars"] },
      { cmd: "call_if_ne", args: ["VAR_ROAMER_POKEMON", 0, "SouthernIsland_Interior_EventScript_SetLatiasBattleVars"] },
      { cmd: "setflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "special", args: ["BattleSetup_StartLatiBattle"] },
      { cmd: "waitstate" },
      { cmd: "clearflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_WON", "SouthernIsland_Interior_EventScript_LatiDefeated"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_RAN", "SouthernIsland_Interior_EventScript_RanFromLati"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_PLAYER_TELEPORTED", "SouthernIsland_Interior_EventScript_RanFromLati"] },
      { cmd: "setflag", args: ["FLAG_CAUGHT_LATIAS_OR_LATIOS"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SouthernIsland_Interior_EventScript_LatiDefeated": [
      { cmd: "setflag", args: ["FLAG_DEFEATED_LATIAS_OR_LATIOS"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_TEMP_4"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
    "SouthernIsland_Interior_EventScript_RanFromLati": [
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_TEMP_4"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
    "SouthernIsland_Interior_EventScript_Sign": [
      { cmd: "msgbox", args: ["SouthernIsland_Interior_Text_Sign", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SouthernIsland_Interior_EventScript_SetLatiosBattleVars": [
      { cmd: "seteventmon", args: ["SPECIES_LATIOS", 50, "ITEM_SOUL_DEW"] },
      { cmd: "return" },
    ],
    "SouthernIsland_Interior_EventScript_SetLatiasBattleVars": [
      { cmd: "seteventmon", args: ["SPECIES_LATIAS", 50, "ITEM_SOUL_DEW"] },
      { cmd: "return" },
    ],
  },
  movements: {
    "SouthernIsland_Interior_Movement_CameraPanUp": ["walk_up", "walk_up", "walk_up"],
    "SouthernIsland_Interior_Movement_CameraPanDown": ["delay_16", "delay_16", "delay_16", "delay_16", "delay_16", "delay_16", "delay_16", "walk_down", "walk_down", "walk_down", "walk_in_place_faster_up"],
    "SouthernIsland_Interior_Movement_LatiApproach": ["walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "delay_16", "delay_16", "walk_down", "walk_down", "walk_down", "walk_down"],
  },
  text: {
  },
};

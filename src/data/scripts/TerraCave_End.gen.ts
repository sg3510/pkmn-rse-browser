// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "TerraCave_End_OnTransition",
    onResume: "TerraCave_End_OnResume",
  },
  scripts: {
    "TerraCave_End_OnResume": [
      { cmd: "call_if_set", args: ["FLAG_SYS_CTRL_OBJ_DELETE", "TerraCave_End_EventScript_TryRemoveGroudon"] },
      { cmd: "end" },
    ],
    "TerraCave_End_EventScript_TryRemoveGroudon": [
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "B_OUTCOME_CAUGHT", "Common_EventScript_NopReturn"] },
      { cmd: "removeobject", args: ["LOCALID_TERRA_CAVE_GROUDON"] },
      { cmd: "return" },
    ],
    "TerraCave_End_OnTransition": [
      { cmd: "call_if_unset", args: ["FLAG_DEFEATED_GROUDON", "TerraCave_End_EventScript_ShowGroudon"] },
      { cmd: "end" },
    ],
    "TerraCave_End_EventScript_ShowGroudon": [
      { cmd: "clearflag", args: ["FLAG_HIDE_TERRA_CAVE_GROUDON"] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "return" },
    ],
    "TerraCave_End_EventScript_Groudon": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Common_Movement_FaceUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_TERRA_CAVE_GROUDON", "TerraCave_End_Movement_GroudonApproach"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_GROUDON", "CRY_MODE_ENCOUNTER"] },
      { cmd: "delay", args: [40] },
      { cmd: "waitmoncry" },
      { cmd: "setvar", args: ["VAR_LAST_TALKED", "LOCALID_TERRA_CAVE_GROUDON"] },
      { cmd: "setwildbattle", args: ["SPECIES_GROUDON", 70] },
      { cmd: "setflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "special", args: ["BattleSetup_StartLegendaryBattle"] },
      { cmd: "waitstate" },
      { cmd: "clearflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 0] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_WON", "TerraCave_End_EventScript_DefeatedGroudon"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_RAN", "TerraCave_End_EventScript_RanFromGroudon"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_PLAYER_TELEPORTED", "TerraCave_End_EventScript_RanFromGroudon"] },
      { cmd: "setvar", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1] },
      { cmd: "setflag", args: ["FLAG_DEFEATED_GROUDON"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "TerraCave_End_EventScript_DefeatedGroudon": [
      { cmd: "setvar", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1] },
      { cmd: "setflag", args: ["FLAG_DEFEATED_GROUDON"] },
      { cmd: "goto", args: ["Common_EventScript_RemoveStaticPokemon"] },
      { cmd: "end" },
    ],
    "TerraCave_End_EventScript_RanFromGroudon": [
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIES_GROUDON"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "TerraCave_End_Movement_GroudonApproach": ["init_affine_anim", "walk_down_start_affine", "delay_16", "delay_16", "walk_down_affine", "delay_16", "delay_16", "walk_down_affine"],
  },
  text: {
  },
};

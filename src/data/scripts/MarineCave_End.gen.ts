// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "MarineCave_End_OnTransition",
    onResume: "MarineCave_End_OnResume",
  },
  scripts: {
    "MarineCave_End_OnResume": [
      { cmd: "call_if_set", args: ["FLAG_SYS_CTRL_OBJ_DELETE", "MarineCave_End_EventScript_TryRemoveKyogre"] },
      { cmd: "end" },
    ],
    "MarineCave_End_EventScript_TryRemoveKyogre": [
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "B_OUTCOME_CAUGHT", "Common_EventScript_NopReturn"] },
      { cmd: "removeobject", args: ["LOCALID_MARINE_CAVE_KYOGRE"] },
      { cmd: "return" },
    ],
    "MarineCave_End_OnTransition": [
      { cmd: "call_if_unset", args: ["FLAG_DEFEATED_KYOGRE", "MarineCave_End_EventScript_ShowKyogre"] },
      { cmd: "end" },
    ],
    "MarineCave_End_EventScript_ShowKyogre": [
      { cmd: "clearflag", args: ["FLAG_HIDE_MARINE_CAVE_KYOGRE"] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "return" },
    ],
    "MarineCave_End_EventScript_Kyogre": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Common_Movement_FaceUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_MARINE_CAVE_KYOGRE", "MarineCave_End_Movement_KyogreApproach"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_KYOGRE", "CRY_MODE_ENCOUNTER"] },
      { cmd: "delay", args: [40] },
      { cmd: "waitmoncry" },
      { cmd: "setvar", args: ["VAR_LAST_TALKED", "LOCALID_MARINE_CAVE_KYOGRE"] },
      { cmd: "setwildbattle", args: ["SPECIES_KYOGRE", 70] },
      { cmd: "setflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "special", args: ["BattleSetup_StartLegendaryBattle"] },
      { cmd: "waitstate" },
      { cmd: "clearflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 0] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_WON", "MarineCave_End_EventScript_DefeatedKyogre"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_RAN", "MarineCave_End_EventScript_RanFromKyogre"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_PLAYER_TELEPORTED", "MarineCave_End_EventScript_RanFromKyogre"] },
      { cmd: "setvar", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1] },
      { cmd: "setflag", args: ["FLAG_DEFEATED_KYOGRE"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "MarineCave_End_EventScript_DefeatedKyogre": [
      { cmd: "setvar", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1] },
      { cmd: "setflag", args: ["FLAG_DEFEATED_KYOGRE"] },
      { cmd: "goto", args: ["Common_EventScript_RemoveStaticPokemon"] },
      { cmd: "end" },
    ],
    "MarineCave_End_EventScript_RanFromKyogre": [
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIES_KYOGRE"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "MarineCave_End_Movement_KyogreApproach": ["init_affine_anim", "walk_down_start_affine", "delay_16", "delay_16", "walk_down_affine", "delay_16", "delay_16", "walk_down_affine"],
  },
  text: {
  },
};

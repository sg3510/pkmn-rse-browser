// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "BattleFrontier_BattleTowerCorridor_OnLoad",
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "BattleFrontier_BattleTowerCorridor_EventScript_EnterCorridor" },
    ],
  },
  scripts: {
    "BattleFrontier_BattleTowerCorridor_OnLoad": [
      { cmd: "goto_if_eq", args: ["VAR_0x8006", 1, "BattleFrontier_BattleTowerCorridor_EventScript_OpenFarDoor"] },
      { cmd: "setmetatile", args: [12, 0, "METATILE_BattleFrontier_CorridorOpenDoor_Top", "FALSE"] },
      { cmd: "setmetatile", args: [12, 1, "METATILE_BattleFrontier_CorridorOpenDoor_Bottom", "FALSE"] },
      { cmd: "end" },
    ],
    "BattleFrontier_BattleTowerCorridor_EventScript_OpenFarDoor": [
      { cmd: "setmetatile", args: [15, 0, "METATILE_BattleFrontier_CorridorOpenDoor_Top", "FALSE"] },
      { cmd: "setmetatile", args: [15, 1, "METATILE_BattleFrontier_CorridorOpenDoor_Bottom", "FALSE"] },
      { cmd: "end" },
    ],
    "BattleFrontier_BattleTowerCorridor_EventScript_EnterCorridor": [
      { cmd: "setvar", args: ["VAR_TEMP_0", 1] },
      { cmd: "goto_if_eq", args: ["VAR_0x8006", 1, "BattleFrontier_BattleTowerCorridor_EventScript_WalkToFarDoor"] },
      { cmd: "applymovement", args: ["LOCALID_TOWER_CORRIDOR_ATTENDANT", "BattleFrontier_BattleTowerCorridor_Movement_AttendantWalkToDoor"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleTowerCorridor_Movement_PlayerWalkToDoor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "goto", args: ["BattleFrontier_BattleTowerCorridor_EventScript_WarpToBattleRoom"] },
    ],
    "BattleFrontier_BattleTowerCorridor_EventScript_WalkToFarDoor": [
      { cmd: "applymovement", args: ["LOCALID_TOWER_CORRIDOR_ATTENDANT", "BattleFrontier_BattleTowerCorridor_Movement_AttendantWalkToFarDoor"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleTowerCorridor_Movement_PlayerWalkToFarDoor"] },
      { cmd: "waitmovement", args: [0] },
    ],
    "BattleFrontier_BattleTowerCorridor_EventScript_WarpToBattleRoom": [
      { cmd: "setvar", args: ["VAR_TEMP_0", 0] },
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_TOWER_BATTLE_ROOM", 4, 8] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
  },
  movements: {
    "BattleFrontier_BattleTowerCorridor_Movement_PlayerWalkToFarDoor": ["walk_right"],
    "BattleFrontier_BattleTowerCorridor_Movement_AttendantWalkToFarDoor": ["walk_right", "walk_right"],
    "BattleFrontier_BattleTowerCorridor_Movement_PlayerWalkToDoor": ["walk_right"],
    "BattleFrontier_BattleTowerCorridor_Movement_AttendantWalkToDoor": ["walk_right", "walk_right", "walk_right", "walk_up", "set_invisible"],
  },
  text: {
  },
};

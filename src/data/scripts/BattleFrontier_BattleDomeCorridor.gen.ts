// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "BattleFrontier_BattleDomeCorridor_EventScript_EnterCorridor" },
    ],
  },
  scripts: {
    "BattleFrontier_BattleDomeCorridor_EventScript_EnterCorridor": [
      { cmd: "delay", args: [16] },
      { cmd: "setvar", args: ["VAR_TEMP_0", 1] },
      { cmd: "frontier_get", args: ["FRONTIER_DATA_LVL_MODE"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FRONTIER_LVL_OPEN", "BattleFrontier_BattleDomeCorridor_EventScript_WalkToBattleRoomLvOpen"] },
      { cmd: "applymovement", args: ["LOCALID_DOME_CORRIDOR_ATTENDANT", "BattleFrontier_BattleDomeCorridor_Movement_AttendantWalkToDoorLv50"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleDomeCorridor_Movement_PlayerWalkToDoorLv50"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "opendoor", args: [13, 3] },
      { cmd: "waitdooranim" },
      { cmd: "applymovement", args: ["LOCALID_DOME_CORRIDOR_ATTENDANT", "BattleFrontier_BattleDomeCorridor_Movement_AttendantEnterDoorLv50"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleDomeCorridor_Movement_PlayerEnterDoorLv50"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "closedoor", args: [13, 3] },
      { cmd: "waitdooranim" },
      { cmd: "goto", args: ["BattleFrontier_BattleDomeCorridor_EventScript_WarpToPreBattleRoom"] },
    ],
    "BattleFrontier_BattleDomeCorridor_EventScript_WalkToBattleRoomLvOpen": [
      { cmd: "applymovement", args: ["LOCALID_DOME_CORRIDOR_ATTENDANT", "BattleFrontier_BattleDomeCorridor_Movement_AttendantWalkToDoorLvOpen"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleDomeCorridor_Movement_PlayerWalkToDoorLvOpen"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "opendoor", args: [37, 3] },
      { cmd: "waitdooranim" },
      { cmd: "applymovement", args: ["LOCALID_DOME_CORRIDOR_ATTENDANT", "BattleFrontier_BattleDomeCorridor_Movement_AttendantEnterDoorLvOpen"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleDomeCorridor_Movement_PlayerEnterDoorLvOpen"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "closedoor", args: [37, 3] },
      { cmd: "waitdooranim" },
    ],
    "BattleFrontier_BattleDomeCorridor_EventScript_WarpToPreBattleRoom": [
      { cmd: "waitmovement", args: [0] },
      { cmd: "setvar", args: ["VAR_0x8006", 0] },
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_DOME_PRE_BATTLE_ROOM", 5, 7] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
  },
  movements: {
    "BattleFrontier_BattleDomeCorridor_Movement_PlayerWalkToDoorLv50": ["walk_up", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_in_place_faster_up"],
    "BattleFrontier_BattleDomeCorridor_Movement_PlayerEnterDoorLv50": ["walk_up", "walk_up", "set_invisible"],
    "BattleFrontier_BattleDomeCorridor_Movement_AttendantWalkToDoorLv50": ["walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_up"],
    "BattleFrontier_BattleDomeCorridor_Movement_AttendantEnterDoorLv50": ["walk_up", "set_invisible"],
    "BattleFrontier_BattleDomeCorridor_Movement_PlayerWalkToDoorLvOpen": ["walk_up", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_in_place_faster_up"],
    "BattleFrontier_BattleDomeCorridor_Movement_PlayerEnterDoorLvOpen": ["walk_up", "walk_up", "set_invisible"],
    "BattleFrontier_BattleDomeCorridor_Movement_AttendantWalkToDoorLvOpen": ["walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_up"],
    "BattleFrontier_BattleDomeCorridor_Movement_AttendantEnterDoorLvOpen": ["walk_up", "set_invisible"],
    "BattleFrontier_BattleDomeCorridor_Movement_WalkToBattleRoomMidRight": ["walk_up", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_up", "walk_up", "set_invisible"],
  },
  text: {
  },
};

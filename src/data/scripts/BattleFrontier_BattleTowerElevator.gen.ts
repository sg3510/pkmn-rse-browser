// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "BattleFrontier_BattleTowerElevator_EventScript_EnterElevator" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_1", value: 0, script: "BattleFrontier_BattleTowerElevator_EventScript_TurnPlayerNorth" },
    ],
  },
  scripts: {
    "BattleFrontier_BattleTowerElevator_EventScript_EnterElevator": [
      { cmd: "setvar", args: ["VAR_TEMP_0", 1] },
      { cmd: "applymovement", args: ["LOCALID_TOWER_ELEVATOR_ATTENDANT", "BattleFrontier_BattleTowerElevator_Movement_AttendantEnter"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleTowerElevator_Movement_PlayerEnter"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "special", args: ["BufferBattleTowerElevatorFloors"] },
      { cmd: "waitse" },
      { cmd: "special", args: ["MoveElevator"] },
      { cmd: "waitstate" },
      { cmd: "delay", args: [48] },
      { cmd: "applymovement", args: ["LOCALID_TOWER_ELEVATOR_ATTENDANT", "BattleFrontier_BattleTowerElevator_Movement_AttendantExit"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleTowerElevator_Movement_PlayerExit"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "call", args: ["BattleFrontier_BattleTowerElevator_EventScript_WarpToNextRoom"] },
      { cmd: "end" },
    ],
    "BattleFrontier_BattleTowerElevator_EventScript_WarpToNextRoom": [
      { cmd: "call_if_eq", args: ["VAR_FRONTIER_BATTLE_MODE", "FRONTIER_MODE_SINGLES", "BattleFrontier_BattleTowerElevator_EventScript_WarpToCorridor"] },
      { cmd: "call_if_eq", args: ["VAR_FRONTIER_BATTLE_MODE", "FRONTIER_MODE_DOUBLES", "BattleFrontier_BattleTowerElevator_EventScript_WarpToCorridor"] },
      { cmd: "call_if_eq", args: ["VAR_FRONTIER_BATTLE_MODE", "FRONTIER_MODE_MULTIS", "BattleFrontier_BattleTowerElevator_EventScript_WarpToNextRoomMulti"] },
      { cmd: "call_if_eq", args: ["VAR_FRONTIER_BATTLE_MODE", "FRONTIER_MODE_LINK_MULTIS", "BattleFrontier_BattleTowerElevator_EventScript_WarpToCorridorMulti"] },
      { cmd: "return" },
    ],
    "BattleFrontier_BattleTowerElevator_EventScript_WarpToCorridor": [
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_TOWER_CORRIDOR", 8, 1] },
      { cmd: "waitstate" },
      { cmd: "return" },
    ],
    "BattleFrontier_BattleTowerElevator_EventScript_WarpToNextRoomMulti": [
      { cmd: "goto_if_unset", args: ["FLAG_CHOSEN_MULTI_BATTLE_NPC_PARTNER", "BattleFrontier_BattleTowerElevator_EventScript_WarpToPartnerRoom"] },
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_TOWER_MULTI_CORRIDOR", 7, 2] },
      { cmd: "waitstate" },
      { cmd: "return" },
    ],
    "BattleFrontier_BattleTowerElevator_EventScript_WarpToCorridorMulti": [
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_TOWER_MULTI_CORRIDOR", 7, 2] },
      { cmd: "waitstate" },
      { cmd: "return" },
    ],
    "BattleFrontier_BattleTowerElevator_EventScript_WarpToPartnerRoom": [
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_TOWER_MULTI_PARTNER_ROOM", 10, 1] },
      { cmd: "waitstate" },
      { cmd: "return" },
    ],
    "BattleFrontier_BattleTowerElevator_EventScript_TurnPlayerNorth": [
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "BattleFrontier_BattleTowerElevator_Movement_AttendantEnter": ["walk_up", "walk_right", "face_down"],
    "BattleFrontier_BattleTowerElevator_Movement_PlayerEnter": ["walk_up", "walk_up", "face_down"],
    "BattleFrontier_BattleTowerElevator_Movement_AttendantExit": ["walk_down", "walk_down", "set_invisible"],
    "BattleFrontier_BattleTowerElevator_Movement_PlayerExit": ["walk_right", "walk_down", "walk_down"],
  },
  text: {
  },
};

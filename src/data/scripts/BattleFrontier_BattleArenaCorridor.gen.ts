// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "BattleFrontier_BattleArenaCorridor_EventScript_WalkToBattleRoom" },
    ],
  },
  scripts: {
    "BattleFrontier_BattleArenaCorridor_EventScript_WalkToBattleRoom": [
      { cmd: "delay", args: [16] },
      { cmd: "setvar", args: ["VAR_TEMP_0", 1] },
      { cmd: "applymovement", args: ["LOCALID_ARENA_CORRIDOR_ATTENDANT", "BattleFrontier_BattleArenaCorridor_Movement_AttendantWalkToDoor"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleArenaCorridor_Movement_PlayerWalkToDoor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_ARENA_CORRIDOR_ATTENDANT", "BattleFrontier_BattleArenaCorridor_Movement_AttendantFacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["BattleFrontier_BattleArenaCorridor_Text_PleaseStepIn", "MSGBOX_SIGN"] },
      { cmd: "applymovement", args: ["LOCALID_ARENA_CORRIDOR_ATTENDANT", "BattleFrontier_BattleArenaCorridor_Movement_AttendantMoveOutOfWay"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattleArenaCorridor_Movement_PlayerEnterDoor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setvar", args: ["VAR_0x8006", 0] },
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_ARENA_BATTLE_ROOM", 7, 5] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
  },
  movements: {
    "BattleFrontier_BattleArenaCorridor_Movement_PlayerWalkToDoor": ["walk_up", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_right", "walk_right", "walk_right"],
    "BattleFrontier_BattleArenaCorridor_Movement_PlayerEnterDoor": ["walk_right", "set_invisible"],
    "BattleFrontier_BattleArenaCorridor_Movement_AttendantWalkToDoor": ["walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_right", "walk_right", "walk_right", "walk_right"],
    "BattleFrontier_BattleArenaCorridor_Movement_AttendantFacePlayer": ["walk_in_place_faster_left"],
    "BattleFrontier_BattleArenaCorridor_Movement_AttendantMoveOutOfWay": ["walk_up", "walk_in_place_faster_down"],
  },
  text: {
    "BattleFrontier_BattleArenaCorridor_Text_PleaseStepIn": "Your battles shall be waged in\\nthe next room. Please step in!",
  },
};

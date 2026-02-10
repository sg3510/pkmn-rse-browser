// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "BattleFrontier_BattlePikeCorridor_EventScript_EnterCorridor" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_1", value: 0, script: "BattleFrontier_BattlePikeCorridor_EventScript_TurnPlayerNorth" },
    ],
  },
  scripts: {
    "BattleFrontier_BattlePikeCorridor_EventScript_EnterCorridor": [
      { cmd: "delay", args: [16] },
      { cmd: "frontier_set", args: ["FRONTIER_DATA_BATTLE_NUM", 1] },
      { cmd: "pike_cleartrainerids" },
      { cmd: "pike_nohealing", args: ["TRUE"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattlePikeCorridor_Movement_PlayerEnterCorridor"] },
      { cmd: "applymovement", args: ["LOCALID_PIKE_CORRIDOR_ATTENDANT", "BattleFrontier_BattlePikeCorridor_Movement_AttendantEnterCorridor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "lockall" },
      { cmd: "msgbox", args: ["BattleFrontier_BattlePikeCorridor_Text_YourChallengeHasBegun", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "releaseall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattlePikeCorridor_Movement_PlayerExitCorridor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "frontier_set", args: ["FRONTIER_DATA_CHALLENGE_STATUS", 99] },
      { cmd: "call", args: ["BattleFrontier_BattlePike_EventScript_CloseCurtain"] },
      { cmd: "warpsilent", args: ["MAP_BATTLE_FRONTIER_BATTLE_PIKE_THREE_PATH_ROOM", 6, 10] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "BattleFrontier_BattlePikeCorridor_EventScript_TurnPlayerNorth": [
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "BattleFrontier_BattlePikeCorridor_Movement_PlayerEnterCorridor": ["walk_up", "walk_up"],
    "BattleFrontier_BattlePikeCorridor_Movement_PlayerExitCorridor": ["walk_up", "walk_up", "set_invisible"],
    "BattleFrontier_BattlePikeCorridor_Movement_AttendantEnterCorridor": ["walk_up", "walk_up", "walk_left", "face_down"],
  },
  text: {
    "BattleFrontier_BattlePikeCorridor_Text_YourChallengeHasBegun": "Your Battle Choice challenge\\nhas now begun…",
  },
};

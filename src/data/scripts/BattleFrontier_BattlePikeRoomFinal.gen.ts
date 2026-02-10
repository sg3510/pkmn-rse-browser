// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "BattleFrontier_BattlePikeRoomFinal_EventScript_EnterRoom" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_4", value: 0, script: "BattleFrontier_BattlePikeRoomFinal_EventScript_TurnPlayerNorth" },
    ],
  },
  scripts: {
    "BattleFrontier_BattlePikeRoomFinal_EventScript_EnterRoom": [
      { cmd: "delay", args: [16] },
      { cmd: "applymovement", args: ["LOCALID_PIKE_FINAL_ROOM_ATTENDANT", "BattleFrontier_BattlePikeRoomFinal_Movement_AttendantApproachPlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "frontier_set", args: ["FRONTIER_DATA_CHALLENGE_STATUS", "CHALLENGE_STATUS_WON"] },
      { cmd: "lockall" },
      { cmd: "msgbox", args: ["BattleFrontier_BattlePikeRoomFinal_Text_CongratsThisWayPlease", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "releaseall" },
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_PIKE_LOBBY", 5, 6] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "BattleFrontier_BattlePikeRoomFinal_EventScript_TurnPlayerNorth": [
      { cmd: "setvar", args: ["VAR_TEMP_4", 1] },
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "BattleFrontier_BattlePikeRoomFinal_Movement_AttendantApproachPlayer": ["walk_down", "walk_down"],
  },
  text: {
    "BattleFrontier_BattlePikeRoomFinal_Text_CongratsThisWayPlease": "Congratulations…\\nNow, this way, please…",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onResume: "BattleFrontier_BattlePikeRoomWildMons_OnResume",
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "BattleFrontier_BattlePikeRoomWildMons_EventScript_SetInWildMonRoom" },
      { var: "VAR_TEMP_1", value: 1, script: "BattleFrontier_BattlePikeRoomWildMons_EventScript_WarpToLobbyLost" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_4", value: 0, script: "BattleFrontier_BattlePikeRoomWildMons_EventScript_TurnPlayerNorth" },
    ],
  },
  scripts: {
    "BattleFrontier_BattlePikeRoomWildMons_EventScript_SetInWildMonRoom": [
      { cmd: "setvar", args: ["VAR_TEMP_0", 1] },
      { cmd: "pike_inwildmonroom" },
      { cmd: "end" },
    ],
    "BattleFrontier_BattlePikeRoomWildMons_EventScript_WarpToLobbyLost": [
      { cmd: "frontier_set", args: ["FRONTIER_DATA_CHALLENGE_STATUS", "CHALLENGE_STATUS_LOST"] },
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_PIKE_LOBBY", 5, 6] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "BattleFrontier_BattlePikeRoomWildMons_EventScript_TurnPlayerNorth": [
      { cmd: "setvar", args: ["VAR_TEMP_4", 1] },
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
    "BattleFrontier_BattlePikeRoomWildMons_OnResume": [
      { cmd: "call", args: ["BattleFrontier_BattlePikeRoom_EventScript_ResetSketchedMoves"] },
      { cmd: "frontier_get", args: ["FRONTIER_DATA_BATTLE_OUTCOME"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_LOST", "BattleFrontier_BattlePikeRoomWildMons_EventScript_SetLost"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_DREW", "BattleFrontier_BattlePikeRoomWildMons_EventScript_SetLost"] },
      { cmd: "end" },
    ],
    "BattleFrontier_BattlePikeRoomWildMons_EventScript_SetLost": [
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

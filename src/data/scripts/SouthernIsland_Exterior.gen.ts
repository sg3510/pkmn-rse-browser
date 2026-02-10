// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SouthernIsland_Exterior_OnTransition",
  },
  scripts: {
    "SouthernIsland_Exterior_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_SOUTHERN_ISLAND"] },
      { cmd: "end" },
    ],
    "SouthernIsland_Exterior_EventScript_Sailor": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["EventTicket_Text_SouthernIslandSailBack", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "SouthernIsland_Exterior_EventScript_AsYouLike"] },
      { cmd: "msgbox", args: ["EventTicket_Text_SailHome", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_WalkInPlaceFasterDown"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [30] },
      { cmd: "hideobjectat", args: ["LOCALID_SOUTHERN_ISLAND_SAILOR", "MAP_SOUTHERN_ISLAND_EXTERIOR"] },
      { cmd: "setvar", args: ["VAR_0x8004", "LOCALID_SOUTHERN_ISLAND_SS_TIDAL"] },
      { cmd: "call", args: ["Common_EventScript_FerryDepartIsland"] },
      { cmd: "warp", args: ["MAP_LILYCOVE_CITY_HARBOR", 8, 11] },
      { cmd: "waitstate" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SouthernIsland_Exterior_EventScript_AsYouLike": [
      { cmd: "msgbox", args: ["EventTicket_Text_AsYouLike", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Ferry_EventScript_DepartIslandSouth": [
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Ferry_Movement_DepartIslandBoardSouth"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "Ferry_EventScript_DepartIslandWest": [
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Ferry_Movement_DepartIslandBoardWest"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "SouthernIsland_Exterior_EventScript_Sign": [
      { cmd: "msgbox", args: ["SouthernIsland_Exterior_Text_Sign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "Ferry_Movement_DepartIslandBoardSouth": ["walk_down"],
    "Ferry_Movement_DepartIslandBoardWest": ["walk_left", "walk_in_place_faster_down"],
  },
  text: {
  },
};

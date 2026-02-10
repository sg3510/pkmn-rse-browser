// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "FarawayIsland_Entrance_OnTransition",
  },
  scripts: {
    "FarawayIsland_Entrance_OnTransition": [
      { cmd: "setflag", args: ["FLAG_ARRIVED_ON_FARAWAY_ISLAND"] },
      { cmd: "end" },
    ],
    "FarawayIsland_Entrance_EventScript_SetCloudsWeather": [
      { cmd: "setweather", args: ["WEATHER_SUNNY_CLOUDS"] },
      { cmd: "doweather" },
      { cmd: "end" },
    ],
    "FarawayIsland_Entrance_EventScript_ClearWeather": [
      { cmd: "setweather", args: ["WEATHER_NONE"] },
      { cmd: "doweather" },
      { cmd: "end" },
    ],
    "FarawayIsland_Entrance_EventScript_Sailor": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["FarawayIsland_Entrance_Text_SailorReturn", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "FarawayIsland_Entrance_EventScript_AsYouLike"] },
      { cmd: "msgbox", args: ["EventTicket_Text_SailHome", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_WalkInPlaceFasterDown"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [30] },
      { cmd: "hideobjectat", args: ["LOCALID_FARAWAY_ISLAND_SAILOR", "MAP_FARAWAY_ISLAND_ENTRANCE"] },
      { cmd: "setvar", args: ["VAR_0x8004", "LOCALID_FARAWAY_ISLAND_SS_TIDAL"] },
      { cmd: "call", args: ["Common_EventScript_FerryDepartIsland"] },
      { cmd: "warp", args: ["MAP_LILYCOVE_CITY_HARBOR", 8, 11] },
      { cmd: "waitstate" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FarawayIsland_Entrance_EventScript_AsYouLike": [
      { cmd: "msgbox", args: ["EventTicket_Text_AsYouLike", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FarawayIsland_Entrance_EventScript_Sign": [
      { cmd: "msgbox", args: ["FarawayIsland_Entrance_Text_Sign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

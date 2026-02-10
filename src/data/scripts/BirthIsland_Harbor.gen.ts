// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "BirthIsland_Harbor_EventScript_Sailor": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["BirthIsland_Harbor_Text_SailorReturn", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "BirthIsland_Harbor_EventScript_AsYouLike"] },
      { cmd: "msgbox", args: ["EventTicket_Text_SailHome", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_WalkInPlaceFasterDown"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [30] },
      { cmd: "hideobjectat", args: ["LOCALID_BIRTH_ISLAND_SAILOR", "MAP_BIRTH_ISLAND_HARBOR"] },
      { cmd: "setvar", args: ["VAR_0x8004", "LOCALID_BIRTH_ISLAND_SS_TIDAL"] },
      { cmd: "call", args: ["Common_EventScript_FerryDepartIsland"] },
      { cmd: "warp", args: ["MAP_LILYCOVE_CITY_HARBOR", 8, 11] },
      { cmd: "waitstate" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BirthIsland_Harbor_EventScript_AsYouLike": [
      { cmd: "msgbox", args: ["EventTicket_Text_AsYouLike", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

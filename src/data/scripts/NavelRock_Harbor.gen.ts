// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "NavelRock_Harbor_EventScript_Sailor": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["NavelRock_Harbor_Text_SailorReturn", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "NavelRock_Harbor_EventScript_AsYouLike"] },
      { cmd: "msgbox", args: ["EventTicket_Text_SailHome", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_WalkInPlaceFasterDown"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [30] },
      { cmd: "hideobjectat", args: ["LOCALID_NAVEL_ROCK_SAILOR", "MAP_NAVEL_ROCK_HARBOR"] },
      { cmd: "setvar", args: ["VAR_0x8004", "LOCALID_NAVEL_ROCK_SS_TIDAL"] },
      { cmd: "call", args: ["Common_EventScript_FerryDepartIsland"] },
      { cmd: "warp", args: ["MAP_LILYCOVE_CITY_HARBOR", 8, 11] },
      { cmd: "waitstate" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "NavelRock_Harbor_EventScript_AsYouLike": [
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

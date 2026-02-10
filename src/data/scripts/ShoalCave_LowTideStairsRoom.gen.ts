// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "ShoalCave_LowTideStairsRoom_OnLoad",
  },
  scripts: {
    "ShoalCave_LowTideStairsRoom_OnLoad": [
      { cmd: "call", args: ["ShoalCave_LowTideStairsRoom_EventScript_SetShoalItemMetatiles"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideStairsRoom_EventScript_SetShoalItemMetatiles": [
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SALT_3", "ShoalCave_LowTideStairsRoom_EventScript_SetShoalItemMetatilesEnd"] },
      { cmd: "setmetatile", args: [11, 11, "METATILE_Cave_ShoalCave_DirtPile_Large", "TRUE"] },
      { cmd: "return" },
    ],
    "ShoalCave_LowTideStairsRoom_EventScript_SetShoalItemMetatilesEnd": [
      { cmd: "return" },
    ],
    "ShoalCave_LowTideStairsRoom_EventScript_ShoalSalt3": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SALT_3", "ShoalCave_LowTideStairsRoom_EventScript_ReceivedShoalSalt"] },
      { cmd: "giveitem", args: ["ITEM_SHOAL_SALT"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setmetatile", args: [11, 11, "METATILE_Cave_ShoalCave_DirtPile_Small", "FALSE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SHOAL_SALT_3"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideStairsRoom_EventScript_ReceivedShoalSalt": [
      { cmd: "msgbox", args: ["ShoalCave_Text_WasShoalSaltNowNothing", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

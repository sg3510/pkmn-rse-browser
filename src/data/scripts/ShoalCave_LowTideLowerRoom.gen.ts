// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "ShoalCave_LowTideLowerRoom_OnLoad",
  },
  scripts: {
    "ShoalCave_LowTideLowerRoom_OnLoad": [
      { cmd: "call", args: ["ShoalCave_LowTideLowerRoom_EventScript_SetShoalItemMetatiles"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideLowerRoom_EventScript_SetShoalItemMetatiles": [
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SALT_4", "ShoalCave_LowTideLowerRoom_EventScript_SetShoalItemMetatilesEnd"] },
      { cmd: "setmetatile", args: [18, 2, "METATILE_Cave_ShoalCave_DirtPile_Large", "TRUE"] },
      { cmd: "return" },
    ],
    "ShoalCave_LowTideLowerRoom_EventScript_SetShoalItemMetatilesEnd": [
      { cmd: "return" },
    ],
    "ShoalCave_LowTideLowerRoom_EventScript_ShoalSalt4": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SALT_4", "ShoalCave_LowTideLowerRoom_EventScript_ReceivedShoalSalt"] },
      { cmd: "giveitem", args: ["ITEM_SHOAL_SALT"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setmetatile", args: [18, 2, "METATILE_Cave_ShoalCave_DirtPile_Small", "FALSE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SHOAL_SALT_4"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideLowerRoom_EventScript_ReceivedShoalSalt": [
      { cmd: "msgbox", args: ["ShoalCave_Text_WasShoalSaltNowNothing", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideLowerRoom_EventScript_BlackBelt": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_FOCUS_BAND", "ShoalCave_LowTideLowerRoom_EventScript_ReceivedFocusBand"] },
      { cmd: "msgbox", args: ["ShoalCave_LowTideLowerRoom_Text_CanOvercomeColdWithFocus", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_FOCUS_BAND"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_FOCUS_BAND"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideLowerRoom_EventScript_ReceivedFocusBand": [
      { cmd: "msgbox", args: ["ShoalCave_LowTideLowerRoom_Text_EverythingStartsWithFocus", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "ShoalCave_LowTideLowerRoom_Text_CanOvercomeColdWithFocus": "The penetrating cold around these\\nparts is an impediment to training.\\pBut with focus, one can overcome!\\pWith this FOCUS BAND, buckle down and\\nwithstand the cold!",
    "ShoalCave_LowTideLowerRoom_Text_EverythingStartsWithFocus": "Everything starts with focus!",
  },
};

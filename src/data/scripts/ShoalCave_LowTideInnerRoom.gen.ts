// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "ShoalCave_LowTideInnerRoom_OnLoad",
    onTransition: "ShoalCave_LowTideInnerRoom_OnTransition",
  },
  scripts: {
    "ShoalCave_LowTideInnerRoom_OnTransition": [
      { cmd: "goto_if_set", args: ["FLAG_SYS_SHOAL_TIDE", "ShoalCave_LowTideInnerRoom_EventScript_SetHighTide"] },
      { cmd: "goto", args: ["ShoalCave_LowTideInnerRoom_EventScript_SetLowTide"] },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetHighTide": [
      { cmd: "setmaplayoutindex", args: ["LAYOUT_SHOAL_CAVE_HIGH_TIDE_INNER_ROOM"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetLowTide": [
      { cmd: "setmaplayoutindex", args: ["LAYOUT_SHOAL_CAVE_LOW_TIDE_INNER_ROOM"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_OnLoad": [
      { cmd: "call", args: ["ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles": [
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SALT_1", "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles2"] },
      { cmd: "goto_if_set", args: ["FLAG_SYS_SHOAL_TIDE", "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles2"] },
      { cmd: "setmetatile", args: [31, 8, "METATILE_Cave_ShoalCave_DirtPile_Large", "TRUE"] },
      { cmd: "goto", args: ["ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles2"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles2": [
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SALT_2", "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles3"] },
      { cmd: "goto_if_set", args: ["FLAG_SYS_SHOAL_TIDE", "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles3"] },
      { cmd: "setmetatile", args: [14, 26, "METATILE_Cave_ShoalCave_DirtPile_Large", "TRUE"] },
      { cmd: "goto", args: ["ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles3"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles3": [
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SHELL_1", "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles4"] },
      { cmd: "setmetatile", args: [41, 20, "METATILE_Cave_ShoalCave_BlueStone_Large", "TRUE"] },
      { cmd: "goto", args: ["ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles4"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles4": [
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SHELL_2", "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles5"] },
      { cmd: "setmetatile", args: [41, 10, "METATILE_Cave_ShoalCave_BlueStone_Large", "TRUE"] },
      { cmd: "goto", args: ["ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles5"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles5": [
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SHELL_3", "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles6"] },
      { cmd: "setmetatile", args: [6, 9, "METATILE_Cave_ShoalCave_BlueStone_Large", "TRUE"] },
      { cmd: "goto", args: ["ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles6"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatiles6": [
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SHELL_4", "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatilesEnd"] },
      { cmd: "setmetatile", args: [16, 13, "METATILE_Cave_ShoalCave_BlueStone_Large", "TRUE"] },
      { cmd: "return" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_SetShoalItemMetatilesEnd": [
      { cmd: "return" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_ShoalShell1": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SHELL_1", "ShoalCave_LowTideInnerRoom_EventScript_ReceivedShoalShell"] },
      { cmd: "giveitem", args: ["ITEM_SHOAL_SHELL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setmetatile", args: [41, 20, "METATILE_Cave_ShoalCave_BlueStone_Small", "FALSE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SHOAL_SHELL_1"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_ReceivedShoalShell": [
      { cmd: "msgbox", args: ["ShoalCave_Text_WasShoallShellNowNothing", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_ShoalShell2": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SHELL_2", "ShoalCave_LowTideInnerRoom_EventScript_ReceivedShoalShell"] },
      { cmd: "giveitem", args: ["ITEM_SHOAL_SHELL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setmetatile", args: [41, 10, "METATILE_Cave_ShoalCave_BlueStone_Small", "FALSE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SHOAL_SHELL_2"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_ShoalShell3": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SHELL_3", "ShoalCave_LowTideInnerRoom_EventScript_ReceivedShoalShell"] },
      { cmd: "giveitem", args: ["ITEM_SHOAL_SHELL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setmetatile", args: [6, 9, "METATILE_Cave_ShoalCave_BlueStone_Small", "FALSE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SHOAL_SHELL_3"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_ShoalShell4": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SHELL_4", "ShoalCave_LowTideInnerRoom_EventScript_ReceivedShoalShell"] },
      { cmd: "giveitem", args: ["ITEM_SHOAL_SHELL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setmetatile", args: [16, 13, "METATILE_Cave_ShoalCave_BlueStone_Small", "FALSE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SHOAL_SHELL_4"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_ShoalSalt1": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SALT_1", "ShoalCave_LowTideInnerRoom_EventScript_ReceivedShoalSalt"] },
      { cmd: "giveitem", args: ["ITEM_SHOAL_SALT"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setmetatile", args: [31, 8, "METATILE_Cave_ShoalCave_DirtPile_Small", "FALSE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SHOAL_SALT_1"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_ReceivedShoalSalt": [
      { cmd: "msgbox", args: ["ShoalCave_Text_WasShoalSaltNowNothing", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideInnerRoom_EventScript_ShoalSalt2": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SHOAL_SALT_2", "ShoalCave_LowTideInnerRoom_EventScript_ReceivedShoalSalt"] },
      { cmd: "giveitem", args: ["ITEM_SHOAL_SALT"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setmetatile", args: [14, 26, "METATILE_Cave_ShoalCave_DirtPile_Small", "FALSE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SHOAL_SALT_2"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

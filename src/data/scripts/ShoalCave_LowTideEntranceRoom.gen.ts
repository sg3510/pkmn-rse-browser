// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "ShoalCave_LowTideEntranceRoom_OnTransition",
  },
  scripts: {
    "ShoalCave_LowTideEntranceRoom_OnTransition": [
      { cmd: "special", args: ["UpdateShoalTideFlag"] },
      { cmd: "goto_if_set", args: ["FLAG_SYS_SHOAL_TIDE", "ShoalCave_LowTideEntranceRoom_EventScript_SetHighTide"] },
      { cmd: "goto", args: ["ShoalCave_LowTideEntranceRoom_EventScript_SetLowTide"] },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_SetHighTide": [
      { cmd: "setmaplayoutindex", args: ["LAYOUT_SHOAL_CAVE_HIGH_TIDE_ENTRANCE_ROOM"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_SetLowTide": [
      { cmd: "setmaplayoutindex", args: ["LAYOUT_SHOAL_CAVE_LOW_TIDE_ENTRANCE_ROOM"] },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_ShellBellExpert": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "dotimebasedevents" },
      { cmd: "call_if_set", args: ["FLAG_SYS_SHOAL_ITEM", "ShoalCave_LowTideEntranceRoom_EventScript_ResetShoalItems"] },
      { cmd: "checkitem", args: ["ITEM_SHOAL_SALT", 4] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "ShoalCave_LowTideEntranceRoom_EventScript_NotEnoughShoalSaltOrShells"] },
      { cmd: "checkitem", args: ["ITEM_SHOAL_SHELL", 4] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "ShoalCave_LowTideEntranceRoom_EventScript_NotEnoughShoalSaltOrShells"] },
      { cmd: "msgbox", args: ["ShoalCave_LowTideEntranceRoom_Text_WouldYouLikeShellBell", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "ShoalCave_LowTideEntranceRoom_EventScript_DeclineShellBell"] },
      { cmd: "checkitemspace", args: ["ITEM_SHELL_BELL"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "FALSE", "ShoalCave_LowTideEntranceRoom_EventScript_CheckSpaceWillBeFreed"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 2, "ShoalCave_LowTideEntranceRoom_EventScript_NoRoomForShellBell"] },
      { cmd: "msgbox", args: ["ShoalCave_LowTideEntranceRoom_Text_MakeShellBellRightAway", "MSGBOX_DEFAULT"] },
      { cmd: "removeitem", args: ["ITEM_SHOAL_SALT", 4] },
      { cmd: "removeitem", args: ["ITEM_SHOAL_SHELL", 4] },
      { cmd: "giveitem", args: ["ITEM_SHELL_BELL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "msgbox", args: ["ShoalCave_LowTideEntranceRoom_Text_ExplainShellBell", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_TEMP_2"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_CheckSpaceWillBeFreed": [
      { cmd: "checkitem", args: ["ITEM_SHOAL_SALT", 5] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "ShoalCave_LowTideEntranceRoom_EventScript_CheckSpaceWillBeFreedShells"] },
      { cmd: "return" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_CheckSpaceWillBeFreedShells": [
      { cmd: "checkitem", args: ["ITEM_SHOAL_SHELL", 5] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "ShoalCave_LowTideEntranceRoom_EventScript_NoSpaceWillBeFreed"] },
      { cmd: "return" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_NoSpaceWillBeFreed": [
      { cmd: "setvar", args: ["VAR_RESULT", 2] },
      { cmd: "return" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_NoRoomForShellBell": [
      { cmd: "msgbox", args: ["ShoalCave_LowTideEntranceRoom_Text_NoSpaceInYourBag", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_NotEnoughShoalSaltOrShells": [
      { cmd: "checkitem", args: ["ITEM_SHOAL_SALT"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "ShoalCave_LowTideEntranceRoom_EventScript_HasSomeShoalSaltOrShell"] },
      { cmd: "checkitem", args: ["ITEM_SHOAL_SHELL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "ShoalCave_LowTideEntranceRoom_EventScript_HasSomeShoalSaltOrShell"] },
      { cmd: "msgbox", args: ["ShoalCave_LowTideEntranceRoom_Text_AreYouPlanningOnGoingInThere", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_HasSomeShoalSaltOrShell": [
      { cmd: "msgbox", args: ["ShoalCave_LowTideEntranceRoom_Text_BringMe4ShoalSaltAndShells", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_DeclineShellBell": [
      { cmd: "msgbox", args: ["ShoalCave_LowTideEntranceRoom_Text_WantedToMakeShellBell", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "ShoalCave_LowTideEntranceRoom_EventScript_ResetShoalItems": [
      { cmd: "clearflag", args: ["FLAG_RECEIVED_SHOAL_SALT_1"] },
      { cmd: "clearflag", args: ["FLAG_RECEIVED_SHOAL_SALT_2"] },
      { cmd: "clearflag", args: ["FLAG_RECEIVED_SHOAL_SALT_3"] },
      { cmd: "clearflag", args: ["FLAG_RECEIVED_SHOAL_SALT_4"] },
      { cmd: "clearflag", args: ["FLAG_RECEIVED_SHOAL_SHELL_1"] },
      { cmd: "clearflag", args: ["FLAG_RECEIVED_SHOAL_SHELL_2"] },
      { cmd: "clearflag", args: ["FLAG_RECEIVED_SHOAL_SHELL_3"] },
      { cmd: "clearflag", args: ["FLAG_RECEIVED_SHOAL_SHELL_4"] },
      { cmd: "clearflag", args: ["FLAG_SYS_SHOAL_ITEM"] },
      { cmd: "return" },
    ],
  },
  movements: {
  },
  text: {
  },
};

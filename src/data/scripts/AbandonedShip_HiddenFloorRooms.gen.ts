// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_1", value: 0, script: "AbandonedShip_HiddenFloorRooms_EventScript_DoHiddenItemSparkle" },
    ],
  },
  scripts: {
    "AbandonedShip_HiddenFloorRooms_EventScript_DoHiddenItemSparkle": [
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "getplayerxy", args: ["VAR_TEMP_2", "VAR_TEMP_3"] },
      { cmd: "setvar", args: ["VAR_TEMP_4", 1] },
      { cmd: "call_if_eq", args: ["VAR_TEMP_2", 21, "AbandonedShip_HiddenFloorRooms_EventScript_InMiddleRoomColumn"] },
      { cmd: "call_if_eq", args: ["VAR_TEMP_2", 36, "AbandonedShip_HiddenFloorRooms_EventScript_InRightRoomColumn"] },
      { cmd: "call_if_eq", args: ["VAR_TEMP_3", 2, "AbandonedShip_HiddenFloorRooms_EventScript_InUpperRoomRow"] },
      { cmd: "switch", args: ["VAR_TEMP_4"] },
      { cmd: "case", args: [1, "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm1"] },
      { cmd: "case", args: [2, "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm2"] },
      { cmd: "case", args: [3, "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm3"] },
      { cmd: "case", args: [4, "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm4"] },
      { cmd: "case", args: [5, "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm5"] },
      { cmd: "case", args: [6, "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm6"] },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_InMiddleRoomColumn": [
      { cmd: "addvar", args: ["VAR_TEMP_4", 1] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_InRightRoomColumn": [
      { cmd: "addvar", args: ["VAR_TEMP_4", 2] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_InUpperRoomRow": [
      { cmd: "addvar", args: ["VAR_TEMP_4", 3] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm1": [
      { cmd: "delay", args: [20] },
      { cmd: "dofieldeffectsparkle", args: [10, 10, 0] },
      { cmd: "specialvar", args: ["VAR_RESULT", "FoundAbandonedShipRoom4Key"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_HiddenFloorRooms_EventScript_Rm4KeySparkle"] },
      { cmd: "waitfieldeffect", args: ["FLDEFF_SPARKLE"] },
      { cmd: "delay", args: [10] },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm2": [
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm3": [
      { cmd: "specialvar", args: ["VAR_RESULT", "FoundAbandonedShipRoom1Key"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "AbandonedShip_HiddenFloorRooms_EventScript_Rm3NoSparkle"] },
      { cmd: "delay", args: [20] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_HiddenFloorRooms_EventScript_Rm1KeySparkle"] },
      { cmd: "waitfieldeffect", args: ["FLDEFF_SPARKLE"] },
      { cmd: "delay", args: [10] },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_Rm3NoSparkle": [
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm4": [
      { cmd: "delay", args: [20] },
      { cmd: "dofieldeffectsparkle", args: [8, 5, 0] },
      { cmd: "dofieldeffectsparkle", args: [11, 3, 0] },
      { cmd: "specialvar", args: ["VAR_RESULT", "FoundAbandonedShipRoom6Key"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_HiddenFloorRooms_EventScript_Rm6KeySparkle"] },
      { cmd: "waitfieldeffect", args: ["FLDEFF_SPARKLE"] },
      { cmd: "delay", args: [10] },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm5": [
      { cmd: "delay", args: [20] },
      { cmd: "dofieldeffectsparkle", args: [16, 3, 0] },
      { cmd: "dofieldeffectsparkle", args: [25, 2, 0] },
      { cmd: "dofieldeffectsparkle", args: [24, 6, 0] },
      { cmd: "specialvar", args: ["VAR_RESULT", "FoundAbandonedShipRoom2Key"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_HiddenFloorRooms_EventScript_Rm2KeySparkle"] },
      { cmd: "waitfieldeffect", args: ["FLDEFF_SPARKLE"] },
      { cmd: "delay", args: [10] },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_EnterRm6": [
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_Rm1KeySparkle": [
      { cmd: "dofieldeffectsparkle", args: [42, 10, 0] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_Rm2KeySparkle": [
      { cmd: "dofieldeffectsparkle", args: [20, 5, 0] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_Rm4KeySparkle": [
      { cmd: "dofieldeffectsparkle", args: [1, 12, 0] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_Rm6KeySparkle": [
      { cmd: "dofieldeffectsparkle", args: [1, 2, 0] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorRooms_EventScript_Trash": [
      { cmd: "lockall" },
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorRooms_Text_BrightShinyTrash", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AbandonedShip_HiddenFloorRooms_Text_BrightShinyTrash": "It's bright and shiny!\\nBut it's just trash…",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "SealedChamber_OuterRoom_OnLoad",
    onTransition: "SealedChamber_OuterRoom_OnTransition",
    onResume: "SealedChamber_OuterRoom_OnResume",
  },
  scripts: {
    "SealedChamber_OuterRoom_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_UNDERWATER_SEALED_CHAMBER", 12, 44] },
      { cmd: "setescapewarp", args: ["MAP_UNDERWATER_SEALED_CHAMBER", 12, 44] },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_SEALED_CHAMBER"] },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_OnLoad": [
      { cmd: "call_if_unset", args: ["FLAG_SYS_BRAILLE_DIG", "SealedChamber_OuterRoom_EventScript_CloseInnerRoomEntrance"] },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_CloseInnerRoomEntrance": [
      { cmd: "setmetatile", args: [9, 1, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [10, 1, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [11, 1, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [9, 2, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "setmetatile", args: [10, 2, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "setmetatile", args: [11, 2, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "return" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleABC": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_ABC"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleGHI": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_GHI"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleMNO": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_MNO"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleTUV": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_TUV"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleDEF": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_DEF"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleJKL": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_JKL"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BraillePQRS": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_PQRS"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BraillePeriod": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_Period"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleWXYZ": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_WXYZ"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleComma": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_Comma"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_InnerRoomEntranceWall": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_SYS_BRAILLE_DIG", "SealedChamber_OuterRoom_EventScript_HoleInWall"] },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_DigHere"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_HoleInWall": [
      { cmd: "msgbox", args: ["gText_BigHoleInTheWall", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_OuterRoom_EventScript_BrailleDigHere": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_OuterRoom_Braille_DigHere"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

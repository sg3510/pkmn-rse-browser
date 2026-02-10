// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SealedChamber_InnerRoom_EventScript_BrailleBackWall": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_InnerRoom_Braille_FirstWailordLastRelicanth"] },
      { cmd: "goto_if_set", args: ["FLAG_REGI_DOORS_OPENED", "SealedChamber_InnerRoom_EventScript_NoEffect"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "CheckRelicanthWailord"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "SealedChamber_InnerRoom_EventScript_NoEffect"] },
      { cmd: "fadeoutbgm", args: [0] },
      { cmd: "playse", args: ["SE_TRUCK_MOVE"] },
      { cmd: "special", args: ["DoSealedChamberShakingEffect_Long"] },
      { cmd: "waitstate" },
      { cmd: "delay", args: [40] },
      { cmd: "special", args: ["DoSealedChamberShakingEffect_Short"] },
      { cmd: "waitstate" },
      { cmd: "playse", args: ["SE_DOOR"] },
      { cmd: "delay", args: [40] },
      { cmd: "special", args: ["DoSealedChamberShakingEffect_Short"] },
      { cmd: "waitstate" },
      { cmd: "playse", args: ["SE_DOOR"] },
      { cmd: "delay", args: [40] },
      { cmd: "special", args: ["DoSealedChamberShakingEffect_Short"] },
      { cmd: "waitstate" },
      { cmd: "playse", args: ["SE_DOOR"] },
      { cmd: "delay", args: [40] },
      { cmd: "msgbox", args: ["gText_DoorOpenedFarAway", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "fadeinbgm", args: [0] },
      { cmd: "setflag", args: ["FLAG_REGI_DOORS_OPENED"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_InnerRoom_EventScript_NoEffect": [
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_InnerRoom_EventScript_BrailleStoryPart1": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_InnerRoom_Braille_InThisCaveWeHaveLived"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_InnerRoom_EventScript_BrailleStoryPart2": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_InnerRoom_Braille_WeOweAllToThePokemon"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_InnerRoom_EventScript_BrailleStoryPart3": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_InnerRoom_Braille_ButWeSealedThePokemonAway"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_InnerRoom_EventScript_BrailleStoryPart4": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_InnerRoom_Braille_WeFearedIt"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_InnerRoom_EventScript_BrailleStoryPart5": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_InnerRoom_Braille_ThoseWithCourageHope"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SealedChamber_InnerRoom_EventScript_BrailleStoryPart6": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["SealedChamber_InnerRoom_Braille_OpenDoorEternalPokemonWaits"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

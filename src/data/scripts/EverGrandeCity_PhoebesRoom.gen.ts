// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "EverGrandeCity_PhoebesRoom_OnLoad",
    onFrame: [
      { var: "VAR_ELITE_4_STATE", value: 1, script: "EverGrandeCity_PhoebesRoom_EventScript_WalkInCloseDoor" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_1", value: 0, script: "EverGrandeCity_PhoebesRoom_EventScript_PlayerTurnNorth" },
    ],
  },
  scripts: {
    "EverGrandeCity_PhoebesRoom_EventScript_PlayerTurnNorth": [
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_PhoebesRoom_EventScript_WalkInCloseDoor": [
      { cmd: "lockall" },
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_WalkInCloseDoor"] },
      { cmd: "setvar", args: ["VAR_ELITE_4_STATE", 2] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "EverGrandeCity_PhoebesRoom_OnLoad": [
      { cmd: "call_if_set", args: ["FLAG_DEFEATED_ELITE_4_PHOEBE", "EverGrandeCity_PhoebesRoom_EventScript_ResetAdvanceToNextRoom"] },
      { cmd: "call_if_eq", args: ["VAR_ELITE_4_STATE", 2, "EverGrandeCity_PhoebesRoom_EventScript_CloseDoor"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_PhoebesRoom_EventScript_ResetAdvanceToNextRoom": [
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_ResetAdvanceToNextRoom"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_PhoebesRoom_EventScript_CloseDoor": [
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_CloseDoor"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_PhoebesRoom_EventScript_Phoebe": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_ELITE_4_PHOEBE", "EverGrandeCity_PhoebesRoom_EventScript_PostBattleSpeech"] },
      { cmd: "playbgm", args: ["MUS_ENCOUNTER_ELITE_FOUR", "FALSE"] },
      { cmd: "msgbox", args: ["EverGrandeCity_PhoebesRoom_Text_IntroSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "trainerbattle_no_intro", args: ["TRAINER_PHOEBE", "EverGrandeCity_PhoebesRoom_Text_Defeat"] },
      { cmd: "goto", args: ["EverGrandeCity_PhoebesRoom_EventScript_Defeated"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_PhoebesRoom_EventScript_PostBattleSpeech": [
      { cmd: "msgbox", args: ["EverGrandeCity_PhoebesRoom_Text_PostBattleSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "EverGrandeCity_PhoebesRoom_EventScript_Defeated": [
      { cmd: "setflag", args: ["FLAG_DEFEATED_ELITE_4_PHOEBE"] },
      { cmd: "call", args: ["PokemonLeague_EliteFour_SetAdvanceToNextRoomMetatiles"] },
      { cmd: "msgbox", args: ["EverGrandeCity_PhoebesRoom_Text_PostBattleSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "EverGrandeCity_PhoebesRoom_Text_IntroSpeech": "Ahahaha!\\pI'm PHOEBE of the ELITE FOUR.\\nI did my training on MT. PYRE.\\pWhile I trained, I gained the ability\\nto commune with GHOST-type POKéMON.\\pYes, the bond I developed with POKéMON\\nis extremely tight.\\pSo, come on, just try and see if you can\\neven inflict damage on my POKéMON!",
    "EverGrandeCity_PhoebesRoom_Text_Defeat": "Oh, darn.\\nI've gone and lost.",
    "EverGrandeCity_PhoebesRoom_Text_PostBattleSpeech": "There's a definite bond between you\\nand your POKéMON, too.\\pI didn't recognize it, so it's only\\nnatural that I lost.\\pYup, I'd like to see how far your bond\\nwill carry you.\\pGo ahead, move on to the next room.",
  },
};

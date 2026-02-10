// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "EverGrandeCity_GlaciasRoom_OnLoad",
    onFrame: [
      { var: "VAR_ELITE_4_STATE", value: 2, script: "EverGrandeCity_GlaciasRoom_EventScript_WalkInCloseDoor" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_1", value: 0, script: "EverGrandeCity_GlaciasRoom_EventScript_PlayerTurnNorth" },
    ],
  },
  scripts: {
    "EverGrandeCity_GlaciasRoom_EventScript_PlayerTurnNorth": [
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_GlaciasRoom_EventScript_WalkInCloseDoor": [
      { cmd: "lockall" },
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_WalkInCloseDoor"] },
      { cmd: "setvar", args: ["VAR_ELITE_4_STATE", 3] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "EverGrandeCity_GlaciasRoom_OnLoad": [
      { cmd: "call_if_set", args: ["FLAG_DEFEATED_ELITE_4_GLACIA", "EverGrandeCity_GlaciasRoom_EventScript_ResetAdvanceToNextRoom"] },
      { cmd: "call_if_eq", args: ["VAR_ELITE_4_STATE", 3, "EverGrandeCity_GlaciasRoom_EventScript_CloseDoor"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_GlaciasRoom_EventScript_ResetAdvanceToNextRoom": [
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_ResetAdvanceToNextRoom"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_GlaciasRoom_EventScript_CloseDoor": [
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_CloseDoor"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_GlaciasRoom_EventScript_Glacia": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_ELITE_4_GLACIA", "EverGrandeCity_GlaciasRoom_EventScript_PostBattleSpeech"] },
      { cmd: "playbgm", args: ["MUS_ENCOUNTER_ELITE_FOUR", "FALSE"] },
      { cmd: "msgbox", args: ["EverGrandeCity_GlaciasRoom_Text_IntroSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "trainerbattle_no_intro", args: ["TRAINER_GLACIA", "EverGrandeCity_GlaciasRoom_Text_Defeat"] },
      { cmd: "goto", args: ["EverGrandeCity_GlaciasRoom_EventScript_Defeated"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_GlaciasRoom_EventScript_PostBattleSpeech": [
      { cmd: "msgbox", args: ["EverGrandeCity_GlaciasRoom_Text_PostBattleSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "EverGrandeCity_GlaciasRoom_EventScript_Defeated": [
      { cmd: "setflag", args: ["FLAG_DEFEATED_ELITE_4_GLACIA"] },
      { cmd: "call", args: ["PokemonLeague_EliteFour_SetAdvanceToNextRoomMetatiles"] },
      { cmd: "msgbox", args: ["EverGrandeCity_GlaciasRoom_Text_PostBattleSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "EverGrandeCity_GlaciasRoom_Text_IntroSpeech": "Welcome, my name is GLACIA\\nof the ELITE FOUR.\\pI've traveled from afar to HOENN\\nso that I may hone my ice skills.\\pBut all I have seen are challenges by\\nweak TRAINERS and their POKéMON.\\pWhat about you?\\pIt would please me to no end if I could\\ngo all out against you!",
    "EverGrandeCity_GlaciasRoom_Text_Defeat": "You and your POKéMON…\\nHow hot your spirits burn!\\pThe all-consuming heat overwhelms.\\pIt's no surprise that my icy skills\\nfailed to harm you.",
    "EverGrandeCity_GlaciasRoom_Text_PostBattleSpeech": "Advance to the next room.\\pAnd there, confirm the truly fearsome\\nside of the POKéMON LEAGUE.",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "EverGrandeCity_SidneysRoom_OnLoad",
    onTransition: "EverGrandeCity_SidneysRoom_OnTransition",
    onFrame: [
      { var: "VAR_ELITE_4_STATE", value: 0, script: "EverGrandeCity_SidneysRoom_EventScript_WalkInCloseDoor" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_1", value: 0, script: "EverGrandeCity_SidneysRoom_EventScript_PlayerTurnNorth" },
    ],
  },
  scripts: {
    "EverGrandeCity_SidneysRoom_OnTransition": [
      { cmd: "setflag", args: ["FLAG_MET_SCOTT_IN_EVERGRANDE"] },
      { cmd: "setflag", args: ["FLAG_HIDE_EVER_GRANDE_POKEMON_CENTER_1F_SCOTT"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_SidneysRoom_OnLoad": [
      { cmd: "call_if_set", args: ["FLAG_DEFEATED_ELITE_4_SIDNEY", "EverGrandeCity_SidneysRoom_EventScript_ResetAdvanceToNextRoom"] },
      { cmd: "call_if_eq", args: ["VAR_ELITE_4_STATE", 1, "EverGrandeCity_SidneysRoom_EventScript_CloseDoor"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_SidneysRoom_EventScript_ResetAdvanceToNextRoom": [
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_ResetAdvanceToNextRoom"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_SidneysRoom_EventScript_CloseDoor": [
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_CloseDoor"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_SidneysRoom_EventScript_PlayerTurnNorth": [
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_SidneysRoom_EventScript_WalkInCloseDoor": [
      { cmd: "lockall" },
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_WalkInCloseDoor"] },
      { cmd: "setvar", args: ["VAR_ELITE_4_STATE", 1] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "EverGrandeCity_SidneysRoom_EventScript_Sidney": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_ELITE_4_SIDNEY", "EverGrandeCity_SidneysRoom_EventScript_PostBattleSpeech"] },
      { cmd: "playbgm", args: ["MUS_ENCOUNTER_ELITE_FOUR", "FALSE"] },
      { cmd: "msgbox", args: ["EverGrandeCity_SidneysRoom_Text_IntroSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "trainerbattle_no_intro", args: ["TRAINER_SIDNEY", "EverGrandeCity_SidneysRoom_Text_Defeat"] },
      { cmd: "goto", args: ["EverGrandeCity_SidneysRoom_EventScript_Defeated"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_SidneysRoom_EventScript_PostBattleSpeech": [
      { cmd: "msgbox", args: ["EverGrandeCity_SidneysRoom_Text_PostBattleSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "EverGrandeCity_SidneysRoom_EventScript_Defeated": [
      { cmd: "setflag", args: ["FLAG_DEFEATED_ELITE_4_SIDNEY"] },
      { cmd: "call", args: ["PokemonLeague_EliteFour_SetAdvanceToNextRoomMetatiles"] },
      { cmd: "msgbox", args: ["EverGrandeCity_SidneysRoom_Text_PostBattleSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "EverGrandeCity_SidneysRoom_Text_IntroSpeech": "Welcome, challenger!\\nI'm SIDNEY of the ELITE FOUR.\\pI like that look you're giving me.\\nI guess you'll give me a good match.\\lThat's good! Looking real good!\\pAll right! You and me, let's enjoy\\na battle that can only be staged\\lhere in the POKéMON LEAGUE!",
    "EverGrandeCity_SidneysRoom_Text_Defeat": "Well, how do you like that? I lost!\\nEh, it was fun, so it doesn't matter.",
    "EverGrandeCity_SidneysRoom_Text_PostBattleSpeech": "Well, listen to what this loser has\\nto say.\\pYou've got what it takes to go far.\\nNow, go on to the next room and enjoy\\lyour next battle!",
  },
};

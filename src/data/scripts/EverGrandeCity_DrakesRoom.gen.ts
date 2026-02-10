// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "EverGrandeCity_DrakesRoom_OnLoad",
    onFrame: [
      { var: "VAR_ELITE_4_STATE", value: 3, script: "EverGrandeCity_DrakesRoom_EventScript_WalkInCloseDoor" },
    ],
  },
  scripts: {
    "EverGrandeCity_DrakesRoom_EventScript_PlayerTurnNorth": [
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_DrakesRoom_EventScript_WalkInCloseDoor": [
      { cmd: "lockall" },
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_WalkInCloseDoor"] },
      { cmd: "setvar", args: ["VAR_ELITE_4_STATE", 4] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "EverGrandeCity_DrakesRoom_OnLoad": [
      { cmd: "call_if_set", args: ["FLAG_DEFEATED_ELITE_4_DRAKE", "EverGrandeCity_DrakesRoom_EventScript_ResetAdvanceToNextRoom"] },
      { cmd: "call_if_eq", args: ["VAR_ELITE_4_STATE", 4, "EverGrandeCity_DrakesRoom_EventScript_CloseDoor"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_DrakesRoom_EventScript_ResetAdvanceToNextRoom": [
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_ResetAdvanceToNextRoom"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_DrakesRoom_EventScript_CloseDoor": [
      { cmd: "call", args: ["PokemonLeague_EliteFour_EventScript_CloseDoor"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_DrakesRoom_EventScript_Drake": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_ELITE_4_DRAKE", "EverGrandeCity_DrakesRoom_EventScript_PostBattleSpeech"] },
      { cmd: "playbgm", args: ["MUS_ENCOUNTER_ELITE_FOUR", "FALSE"] },
      { cmd: "msgbox", args: ["EverGrandeCity_DrakesRoom_Text_IntroSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "trainerbattle_no_intro", args: ["TRAINER_DRAKE", "EverGrandeCity_DrakesRoom_Text_Defeat"] },
      { cmd: "goto", args: ["EverGrandeCity_DrakesRoom_EventScript_Defeated"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_DrakesRoom_EventScript_PostBattleSpeech": [
      { cmd: "msgbox", args: ["EverGrandeCity_DrakesRoom_Text_PostBattleSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "EverGrandeCity_DrakesRoom_EventScript_Defeated": [
      { cmd: "setvar", args: ["VAR_0x8004", "FANCOUNTER_DEFEATED_DRAKE"] },
      { cmd: "special", args: ["Script_TryGainNewFanFromCounter"] },
      { cmd: "setflag", args: ["FLAG_DEFEATED_ELITE_4_DRAKE"] },
      { cmd: "call", args: ["PokemonLeague_EliteFour_SetAdvanceToNextRoomMetatiles"] },
      { cmd: "msgbox", args: ["EverGrandeCity_DrakesRoom_Text_PostBattleSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "EverGrandeCity_DrakesRoom_Text_IntroSpeech": "I am the last of the POKéMON LEAGUE\\nELITE FOUR, DRAKE the DRAGON master!\\pIn their natural state, POKéMON are\\nwild living things. They are free.\\pAt times, they hinder us.\\nAt times, they help us.\\pFor us to battle with POKéMON as\\npartners, do you know what it takes?\\pDo you know what is needed?\\pIf you don't, then you will never\\nprevail over me!",
    "EverGrandeCity_DrakesRoom_Text_Defeat": "Superb, it should be said.",
    "EverGrandeCity_DrakesRoom_Text_PostBattleSpeech": "You deserve every credit for coming\\nthis far as a TRAINER of POKéMON.\\pYou do seem to know what is needed.\\pYes, what a TRAINER needs is a\\nvirtuous heart.\\pPOKéMON touch the good hearts of\\nTRAINERS and learn good from wrong.\\pThey touch the good hearts of\\nTRAINERS and grow strong.\\pGo! Go onwards!\\nThe CHAMPION is waiting!",
  },
};

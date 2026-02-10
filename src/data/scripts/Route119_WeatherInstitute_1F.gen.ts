// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route119_WeatherInstitute_1F_OnTransition",
  },
  scripts: {
    "Route119_WeatherInstitute_1F_OnTransition": [
      { cmd: "call_if_eq", args: ["VAR_WEATHER_INSTITUTE_STATE", 0, "Route119_WeatherInstitute_1F_EventScript_SetLittleBoyPos"] },
      { cmd: "end" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_SetLittleBoyPos": [
      { cmd: "setobjectxyperm", args: ["LOCALID_WEATHER_INSTITUTE_LITTLE_BOY", 0, 5] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_WEATHER_INSTITUTE_LITTLE_BOY", "MOVEMENT_TYPE_FACE_RIGHT"] },
      { cmd: "return" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_LittleBoy": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "special", args: ["GetPlayerBigGuyGirlString"] },
      { cmd: "goto_if_eq", args: ["VAR_WEATHER_INSTITUTE_STATE", 0, "Route119_WeatherInstitute_1F_EventScript_LittleBoyTeamAquaHere"] },
      { cmd: "msgbox", args: ["Route119_WeatherInstitute_1F_Text_WowYoureStrong", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_LittleBoyTeamAquaHere": [
      { cmd: "msgbox", args: ["Route119_WeatherInstitute_1F_Text_EveryoneWentUpstairs", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_InstituteWorker1": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_unset", args: ["FLAG_SYS_GAME_CLEAR", "Route119_WeatherInstitute_1F_EventScript_StudyingRain"] },
      { cmd: "setvar", args: ["VAR_0x8004", 0] },
      { cmd: "call_if_set", args: ["FLAG_DEFEATED_KYOGRE", "Route119_WeatherInstitute_1F_EventScript_LegendaryDefeated"] },
      { cmd: "call_if_set", args: ["FLAG_DEFEATED_GROUDON", "Route119_WeatherInstitute_1F_EventScript_LegendaryDefeated"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", 2, "Route119_WeatherInstitute_1F_EventScript_StudyingRain"] },
      { cmd: "msgbox", args: ["Route119_WeatherInstitute_1F_Text_NoticingAbnormalWeather", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_LegendaryDefeated": [
      { cmd: "addvar", args: ["VAR_0x8004", 1] },
      { cmd: "return" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_StudyingRain": [
      { cmd: "msgbox", args: ["Route119_WeatherInstitute_1F_Text_ProfStudyingRain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_InstituteWorker2": [
      { cmd: "msgbox", args: ["Route119_WeatherInstitute_1F_Text_WhatWereAquasUpTo", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_Bed": [
      { cmd: "lockall" },
      { cmd: "msgbox", args: ["Route119_WeatherInstitute_1F_Text_TakeRestInBed", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "call", args: ["Common_EventScript_OutOfCenterPartyHeal"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_Grunt1": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_WEATHER_INST_1", "Route119_WeatherInstitute_1F_Text_Grunt1Intro", "Route119_WeatherInstitute_1F_Text_Grunt1Defeat"] },
      { cmd: "msgbox", args: ["Route119_WeatherInstitute_1F_Text_Grunt1PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route119_WeatherInstitute_1F_EventScript_Grunt4": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_WEATHER_INST_4", "Route119_WeatherInstitute_1F_Text_Grunt4Intro", "Route119_WeatherInstitute_1F_Text_Grunt4Defeat"] },
      { cmd: "msgbox", args: ["Route119_WeatherInstitute_1F_Text_Grunt4PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route119_WeatherInstitute_1F_Text_Grunt1Intro": "The BOSS got interested in\\nthe research they have going here,\\lso he sent us out.\\pYou quit meddling!",
    "Route119_WeatherInstitute_1F_Text_Grunt1Defeat": "Blast it…\\nBlasted by a kid…",
    "Route119_WeatherInstitute_1F_Text_Grunt1PostBattle": "Our BOSS knows everything.\\pBut I'm just a GRUNT. What would I know\\nabout what he's thinking?",
    "Route119_WeatherInstitute_1F_Text_Grunt4Intro": "Huh?\\nWhat's a kid doing here?",
    "Route119_WeatherInstitute_1F_Text_Grunt4Defeat": "Huh?\\nI lost?!",
    "Route119_WeatherInstitute_1F_Text_Grunt4PostBattle": "Oh, no…\\nI'll catch an earful for losing to a kid…\\pI should just take a nap in the bed…",
    "Route119_WeatherInstitute_1F_Text_EveryoneWentUpstairs": "While I was sleeping, everyone went\\nupstairs!",
    "Route119_WeatherInstitute_1F_Text_WowYoureStrong": "Wow, you're really strong!\\pI wish I could be a POKéMON TRAINER\\nlike you!",
    "Route119_WeatherInstitute_1F_Text_ProfStudyingRain": "The PROFESSOR loves rain.\\nThat's a fact.\\pBut if it keeps raining, people will be in\\ntrouble. That's another fact.\\pAnd thus, the PROFESSOR is studying\\nif the rain can be put to good use.",
    "Route119_WeatherInstitute_1F_Text_NoticingAbnormalWeather": "On the 2nd floor of the INSTITUTE,\\nwe study the weather patterns over\\lthe HOENN region.\\pWe've been noticing temporary and\\nisolated cases of droughts and\\lheavy rain lately…",
    "Route119_WeatherInstitute_1F_Text_WhatWereAquasUpTo": "Hello!\\nWe've been saved by your actions!\\pWhat I don't understand is what on\\nearth the AQUAS were up to.",
    "Route119_WeatherInstitute_1F_Text_TakeRestInBed": "There's a bed…\\nLet's take a rest.",
  },
};

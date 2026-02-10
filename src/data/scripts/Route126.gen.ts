// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route126_OnTransition",
  },
  scripts: {
    "Route126_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_SYS_WEATHER_CTRL", "Common_EventScript_SetAbnormalWeather"] },
      { cmd: "end" },
    ],
    "Route126_EventScript_Barry": [
      { cmd: "trainerbattle_single", args: ["TRAINER_BARRY", "Route126_Text_BarryIntro", "Route126_Text_BarryDefeat"] },
      { cmd: "msgbox", args: ["Route126_Text_BarryPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route126_EventScript_Dean": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DEAN", "Route126_Text_DeanIntro", "Route126_Text_DeanDefeat"] },
      { cmd: "msgbox", args: ["Route126_Text_DeanPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route126_EventScript_Nikki": [
      { cmd: "trainerbattle_single", args: ["TRAINER_NIKKI", "Route126_Text_NikkiIntro", "Route126_Text_NikkiDefeat"] },
      { cmd: "msgbox", args: ["Route126_Text_NikkiPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route126_EventScript_Brenda": [
      { cmd: "trainerbattle_single", args: ["TRAINER_BRENDA", "Route126_Text_BrendaIntro", "Route126_Text_BrendaDefeat"] },
      { cmd: "msgbox", args: ["Route126_Text_BrendaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route126_EventScript_Leonardo": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LEONARDO", "Route126_Text_LeonardoIntro", "Route126_Text_LeonardoDefeat"] },
      { cmd: "msgbox", args: ["Route126_Text_LeonardoPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route126_EventScript_Isobel": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ISOBEL", "Route126_Text_IsobelIntro", "Route126_Text_IsobelDefeat"] },
      { cmd: "msgbox", args: ["Route126_Text_IsobelPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route126_EventScript_Sienna": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SIENNA", "Route126_Text_SiennaIntro", "Route126_Text_SiennaDefeat"] },
      { cmd: "msgbox", args: ["Route126_Text_SiennaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route126_EventScript_Pablo": [
      { cmd: "trainerbattle_single", args: ["TRAINER_PABLO_1", "Route126_Text_PabloIntro", "Route126_Text_PabloDefeat", "Route126_EventScript_RegisterPablo"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route126_EventScript_RematchPablo"] },
      { cmd: "msgbox", args: ["Route126_Text_PabloPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route126_EventScript_RegisterPablo": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route126_Text_PabloRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_PABLO_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route126_EventScript_RematchPablo": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_PABLO_1", "Route126_Text_PabloRematchIntro", "Route126_Text_PabloRematchDefeat"] },
      { cmd: "msgbox", args: ["Route126_Text_PabloPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

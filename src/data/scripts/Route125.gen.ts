// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Route125_OnLoad",
    onTransition: "Route125_OnTransition",
    onFrame: [
      { var: "VAR_SHOULD_END_ABNORMAL_WEATHER", value: 1, script: "AbnormalWeather_EventScript_EndEventAndCleanup_1" },
    ],
  },
  scripts: {
    "Route125_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_SYS_WEATHER_CTRL", "Common_EventScript_SetAbnormalWeather"] },
      { cmd: "call_if_eq", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1, "AbnormalWeather_EventScript_HideMapNamePopup"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_125_WEST", "AbnormalWeather_StartKyogreWeather"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_125_EAST", "AbnormalWeather_StartKyogreWeather"] },
      { cmd: "end" },
    ],
    "Route125_OnLoad": [
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_125_WEST", "AbnormalWeather_EventScript_PlaceTilesRoute125West"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_125_EAST", "AbnormalWeather_EventScript_PlaceTilesRoute125East"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Nolen": [
      { cmd: "trainerbattle_single", args: ["TRAINER_NOLEN", "Route125_Text_NolenIntro", "Route125_Text_NolenDefeat"] },
      { cmd: "msgbox", args: ["Route125_Text_NolenPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Stan": [
      { cmd: "trainerbattle_single", args: ["TRAINER_STAN", "Route125_Text_StanIntro", "Route125_Text_StanDefeat"] },
      { cmd: "msgbox", args: ["Route125_Text_StanPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Tanya": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TANYA", "Route125_Text_TanyaIntro", "Route125_Text_TanyaDefeat"] },
      { cmd: "msgbox", args: ["Route125_Text_TanyaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Sharon": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SHARON", "Route125_Text_SharonIntro", "Route125_Text_SharonDefeat"] },
      { cmd: "msgbox", args: ["Route125_Text_SharonPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Ernest": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ERNEST_1", "Route125_Text_ErnestIntro", "Route125_Text_ErnestDefeat", "Route125_EventScript_RegisterErnest"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route125_EventScript_RematchErnest"] },
      { cmd: "msgbox", args: ["Route125_Text_ErnestPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route125_EventScript_RegisterErnest": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route125_Text_ErnestRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_ERNEST_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route125_EventScript_RematchErnest": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_ERNEST_1", "Route125_Text_ErnestRematchIntro", "Route125_Text_ErnestRematchDefeat"] },
      { cmd: "msgbox", args: ["Route125_Text_ErnestRematchPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Kim": [
      { cmd: "trainerbattle_double", args: ["TRAINER_KIM_AND_IRIS", "Route125_Text_KimIntro", "Route125_Text_KimDefeat", "Route125_Text_KimNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route125_Text_KimPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Iris": [
      { cmd: "trainerbattle_double", args: ["TRAINER_KIM_AND_IRIS", "Route125_Text_IrisIntro", "Route125_Text_IrisDefeat", "Route125_Text_IrisNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route125_Text_IrisPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Presley": [
      { cmd: "trainerbattle_single", args: ["TRAINER_PRESLEY", "Route125_Text_PresleyIntro", "Route125_Text_PresleyDefeat"] },
      { cmd: "msgbox", args: ["Route125_Text_PresleyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route125_EventScript_Auron": [
      { cmd: "trainerbattle_single", args: ["TRAINER_AURON", "Route125_Text_AuronIntro", "Route125_Text_AuronDefeat"] },
      { cmd: "msgbox", args: ["Route125_Text_AuronPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

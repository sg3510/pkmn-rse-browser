// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Route127_OnLoad",
    onTransition: "Route127_OnTransition",
    onFrame: [
      { var: "VAR_SHOULD_END_ABNORMAL_WEATHER", value: 1, script: "AbnormalWeather_EventScript_EndEventAndCleanup_1" },
    ],
  },
  scripts: {
    "Route127_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_SYS_WEATHER_CTRL", "Common_EventScript_SetAbnormalWeather"] },
      { cmd: "call_if_eq", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1, "AbnormalWeather_EventScript_HideMapNamePopup"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_127_NORTH", "AbnormalWeather_StartKyogreWeather"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_127_SOUTH", "AbnormalWeather_StartKyogreWeather"] },
      { cmd: "end" },
    ],
    "Route127_OnLoad": [
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_127_NORTH", "AbnormalWeather_EventScript_PlaceTilesRoute127North"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_127_SOUTH", "AbnormalWeather_EventScript_PlaceTilesRoute127South"] },
      { cmd: "end" },
    ],
    "Route127_EventScript_Camden": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CAMDEN", "Route127_Text_CamdenIntro", "Route127_Text_CamdenDefeat"] },
      { cmd: "msgbox", args: ["Route127_Text_CamdenPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route127_EventScript_Donny": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DONNY", "Route127_Text_DonnyIntro", "Route127_Text_DonnyDefeat"] },
      { cmd: "msgbox", args: ["Route127_Text_DonnyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route127_EventScript_Jonah": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JONAH", "Route127_Text_JonahIntro", "Route127_Text_JonahDefeat"] },
      { cmd: "msgbox", args: ["Route127_Text_JonahPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route127_EventScript_Henry": [
      { cmd: "trainerbattle_single", args: ["TRAINER_HENRY", "Route127_Text_HenryIntro", "Route127_Text_HenryDefeat"] },
      { cmd: "msgbox", args: ["Route127_Text_HenryPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route127_EventScript_Roger": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ROGER", "Route127_Text_RogerIntro", "Route127_Text_RogerDefeat"] },
      { cmd: "msgbox", args: ["Route127_Text_RogerPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route127_EventScript_Aidan": [
      { cmd: "trainerbattle_single", args: ["TRAINER_AIDAN", "Route127_Text_AidanIntro", "Route127_Text_AidanDefeat"] },
      { cmd: "msgbox", args: ["Route127_Text_AidanPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route127_EventScript_Athena": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ATHENA", "Route127_Text_AthenaIntro", "Route127_Text_AthenaDefeat"] },
      { cmd: "msgbox", args: ["Route127_Text_AthenaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route127_EventScript_Koji": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KOJI_1", "Route127_Text_KojiIntro", "Route127_Text_KojiDefeat", "Route127_EventScript_RegisterKoji"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route127_EventScript_RematchKoji"] },
      { cmd: "msgbox", args: ["Route127_Text_KojiPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route127_EventScript_RegisterKoji": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route127_Text_KojiRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_KOJI_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route127_EventScript_RematchKoji": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_KOJI_1", "Route127_Text_KojiRematchIntro", "Route127_Text_KojiRematchDefeat"] },
      { cmd: "msgbox", args: ["Route127_Text_KojiPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

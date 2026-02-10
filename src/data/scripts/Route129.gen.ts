// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Route129_OnLoad",
    onTransition: "Route129_OnTransition",
    onFrame: [
      { var: "VAR_SHOULD_END_ABNORMAL_WEATHER", value: 1, script: "AbnormalWeather_EventScript_EndEventAndCleanup_1" },
    ],
  },
  scripts: {
    "Route129_OnLoad": [
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_129_WEST", "AbnormalWeather_EventScript_PlaceTilesRoute129West"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_129_EAST", "AbnormalWeather_EventScript_PlaceTilesRoute129East"] },
      { cmd: "end" },
    ],
    "Route129_OnTransition": [
      { cmd: "call_if_eq", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1, "AbnormalWeather_EventScript_HideMapNamePopup"] },
      { cmd: "call_if_ge", args: ["VAR_SOOTOPOLIS_CITY_STATE", 4, "Route129_EventScript_CheckSetAbnormalWeather"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_129_WEST", "AbnormalWeather_StartKyogreWeather"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_129_EAST", "AbnormalWeather_StartKyogreWeather"] },
      { cmd: "end" },
    ],
    "Route129_EventScript_CheckSetAbnormalWeather": [
      { cmd: "call_if_set", args: ["FLAG_SYS_WEATHER_CTRL", "Common_EventScript_SetAbnormalWeather"] },
      { cmd: "return" },
    ],
    "Route129_EventScript_Chase": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CHASE", "Route129_Text_ChaseIntro", "Route129_Text_ChaseDefeat"] },
      { cmd: "msgbox", args: ["Route129_Text_ChasePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route129_EventScript_Allison": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ALLISON", "Route129_Text_AllisonIntro", "Route129_Text_AllisonDefeat"] },
      { cmd: "msgbox", args: ["Route129_Text_AllisonPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route129_EventScript_Reed": [
      { cmd: "trainerbattle_single", args: ["TRAINER_REED", "Route129_Text_ReedIntro", "Route129_Text_ReedDefeat"] },
      { cmd: "msgbox", args: ["Route129_Text_ReedPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route129_EventScript_Tisha": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TISHA", "Route129_Text_TishaIntro", "Route129_Text_TishaDefeat"] },
      { cmd: "msgbox", args: ["Route129_Text_TishaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route129_EventScript_Clarence": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CLARENCE", "Route129_Text_ClarenceIntro", "Route129_Text_ClarenceDefeat"] },
      { cmd: "msgbox", args: ["Route129_Text_ClarencePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

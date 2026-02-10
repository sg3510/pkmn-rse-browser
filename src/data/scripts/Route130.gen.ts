// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route130_OnTransition",
  },
  scripts: {
    "Route130_OnTransition": [
      { cmd: "call_if_ge", args: ["VAR_SOOTOPOLIS_CITY_STATE", 4, "Route130_EventScript_CheckSetAbnormalWeather"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "IsMirageIslandPresent"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route130_EventScript_SetMirageIslandLayout"] },
      { cmd: "setflag", args: ["FLAG_TEMP_HIDE_MIRAGE_ISLAND_BERRY_TREE"] },
      { cmd: "setflag", args: ["FLAG_TEMP_12"] },
      { cmd: "setflag", args: ["FLAG_TEMP_13"] },
      { cmd: "setflag", args: ["FLAG_TEMP_14"] },
      { cmd: "setflag", args: ["FLAG_TEMP_15"] },
      { cmd: "setflag", args: ["FLAG_TEMP_16"] },
      { cmd: "setflag", args: ["FLAG_TEMP_17"] },
      { cmd: "setflag", args: ["FLAG_TEMP_18"] },
      { cmd: "setflag", args: ["FLAG_TEMP_19"] },
      { cmd: "setflag", args: ["FLAG_TEMP_1A"] },
      { cmd: "setflag", args: ["FLAG_TEMP_1B"] },
      { cmd: "setflag", args: ["FLAG_TEMP_1C"] },
      { cmd: "setflag", args: ["FLAG_TEMP_1D"] },
      { cmd: "setflag", args: ["FLAG_TEMP_1E"] },
      { cmd: "setflag", args: ["FLAG_TEMP_1F"] },
      { cmd: "setmaplayoutindex", args: ["LAYOUT_ROUTE130"] },
      { cmd: "end" },
    ],
    "Route130_EventScript_SetMirageIslandLayout": [
      { cmd: "setmaplayoutindex", args: ["LAYOUT_ROUTE130_MIRAGE_ISLAND"] },
      { cmd: "end" },
    ],
    "Route130_EventScript_CheckSetAbnormalWeather": [
      { cmd: "call_if_set", args: ["FLAG_SYS_WEATHER_CTRL", "Common_EventScript_SetAbnormalWeather"] },
      { cmd: "return" },
    ],
    "Route130_EventScript_Rodney": [
      { cmd: "trainerbattle_single", args: ["TRAINER_RODNEY", "Route130_Text_RodneyIntro", "Route130_Text_RodneyDefeat"] },
      { cmd: "msgbox", args: ["Route130_Text_RodneyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route130_EventScript_Katie": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KATIE", "Route130_Text_KatieIntro", "Route130_Text_KatieDefeat"] },
      { cmd: "msgbox", args: ["Route130_Text_KatiePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route130_EventScript_Santiago": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SANTIAGO", "Route130_Text_SantiagoIntro", "Route130_Text_SantiagoDefeat"] },
      { cmd: "msgbox", args: ["Route130_Text_SantiagoPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

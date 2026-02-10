// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route131_OnTransition",
  },
  scripts: {
    "Route131_OnTransition": [
      { cmd: "call_if_ge", args: ["VAR_SOOTOPOLIS_CITY_STATE", 4, "Route131_EventScript_CheckSetAbnormalWeather"] },
      { cmd: "call", args: ["Route131_EventScript_SetLayout"] },
      { cmd: "end" },
    ],
    "Route131_EventScript_SetLayout": [
      { cmd: "setmaplayoutindex", args: ["LAYOUT_ROUTE131_SKY_PILLAR"] },
      { cmd: "return" },
    ],
    "Route131_EventScript_CheckSetAbnormalWeather": [
      { cmd: "call_if_set", args: ["FLAG_SYS_WEATHER_CTRL", "Common_EventScript_SetAbnormalWeather"] },
      { cmd: "return" },
    ],
    "Route131_EventScript_Richard": [
      { cmd: "trainerbattle_single", args: ["TRAINER_RICHARD", "Route131_Text_RichardIntro", "Route131_Text_RichardDefeat"] },
      { cmd: "msgbox", args: ["Route131_Text_RichardPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route131_EventScript_Herman": [
      { cmd: "trainerbattle_single", args: ["TRAINER_HERMAN", "Route131_Text_HermanIntro", "Route131_Text_HermanDefeat"] },
      { cmd: "msgbox", args: ["Route131_Text_HermanPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route131_EventScript_Susie": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SUSIE", "Route131_Text_SusieIntro", "Route131_Text_SusieDefeat"] },
      { cmd: "msgbox", args: ["Route131_Text_SusiePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route131_EventScript_Kara": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KARA", "Route131_Text_KaraIntro", "Route131_Text_KaraDefeat"] },
      { cmd: "msgbox", args: ["Route131_Text_KaraPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route131_EventScript_Reli": [
      { cmd: "trainerbattle_double", args: ["TRAINER_RELI_AND_IAN", "Route131_Text_ReliIntro", "Route131_Text_ReliDefeat", "Route131_Text_ReliNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route131_Text_ReliPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route131_EventScript_Ian": [
      { cmd: "trainerbattle_double", args: ["TRAINER_RELI_AND_IAN", "Route131_Text_IanIntro", "Route131_Text_IanDefeat", "Route131_Text_IanNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route131_Text_IanPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route131_EventScript_Talia": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TALIA", "Route131_Text_TaliaIntro", "Route131_Text_TaliaDefeat"] },
      { cmd: "msgbox", args: ["Route131_Text_TaliaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route131_EventScript_Kevin": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KEVIN", "Route131_Text_KevinIntro", "Route131_Text_KevinDefeat"] },
      { cmd: "msgbox", args: ["Route131_Text_KevinPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

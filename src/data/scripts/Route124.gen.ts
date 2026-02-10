// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route124_OnTransition",
  },
  scripts: {
    "Route124_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_SYS_WEATHER_CTRL", "Common_EventScript_SetAbnormalWeather"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_HuntersHouseSign": [
      { cmd: "msgbox", args: ["Route124_Text_HuntersHouse", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Spencer": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SPENCER", "Route124_Text_SpencerIntro", "Route124_Text_SpencerDefeat"] },
      { cmd: "msgbox", args: ["Route124_Text_SpencerPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Roland": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ROLAND", "Route124_Text_RolandIntro", "Route124_Text_RolandDefeat"] },
      { cmd: "msgbox", args: ["Route124_Text_RolandPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Jenny": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JENNY_1", "Route124_Text_JennyIntro", "Route124_Text_JennyDefeat", "Route124_EventScript_RegisterJenny"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route124_EventScript_RematchJenny"] },
      { cmd: "msgbox", args: ["Route124_Text_JennyPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route124_EventScript_RegisterJenny": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route124_Text_JennyRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_JENNY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route124_EventScript_RematchJenny": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_JENNY_1", "Route124_Text_JennyRematchIntro", "Route124_Text_JennyRematchDefeat"] },
      { cmd: "msgbox", args: ["Route124_Text_JennyPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Grace": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRACE", "Route124_Text_GraceIntro", "Route124_Text_GraceDefeat"] },
      { cmd: "msgbox", args: ["Route124_Text_GracePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Chad": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CHAD", "Route124_Text_ChadIntro", "Route124_Text_ChadDefeat"] },
      { cmd: "msgbox", args: ["Route124_Text_ChadPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Lila": [
      { cmd: "trainerbattle_double", args: ["TRAINER_LILA_AND_ROY_1", "Route124_Text_LilaIntro", "Route124_Text_LilaDefeat", "Route124_Text_LilaNotEnoughMons", "Route124_EventScript_RegisterLila"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route124_EventScript_RematchLila"] },
      { cmd: "msgbox", args: ["Route124_Text_LilaPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route124_EventScript_RegisterLila": [
      { cmd: "msgbox", args: ["Route124_Text_LilaRoyRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_LILA_AND_ROY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route124_EventScript_RematchLila": [
      { cmd: "trainerbattle_rematch_double", args: ["TRAINER_LILA_AND_ROY_1", "Route124_Text_LilaRematchIntro", "Route124_Text_LilaRematchDefeat", "Route124_Text_LilaRematchNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route124_Text_LilaPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Roy": [
      { cmd: "trainerbattle_double", args: ["TRAINER_LILA_AND_ROY_1", "Route124_Text_RoyIntro", "Route124_Text_RoyDefeat", "Route124_Text_RoyNotEnoughMons", "Route124_EventScript_RegisterRoy"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route124_EventScript_RematchRoy"] },
      { cmd: "msgbox", args: ["Route124_Text_RoyPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route124_EventScript_RegisterRoy": [
      { cmd: "msgbox", args: ["Route124_Text_LilaRoyRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_LILA_AND_ROY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route124_EventScript_RematchRoy": [
      { cmd: "trainerbattle_rematch_double", args: ["TRAINER_LILA_AND_ROY_1", "Route124_Text_RoyRematchIntro", "Route124_Text_RoyRematchDefeat", "Route124_Text_RoyRematchNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route124_Text_RoyPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Declan": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DECLAN", "Route124_Text_DeclanIntro", "Route124_Text_DeclanDefeat"] },
      { cmd: "msgbox", args: ["Route124_Text_DeclanPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route124_EventScript_Isabella": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ISABELLA", "Route124_Text_IsabellaIntro", "Route124_Text_IsabellaDefeat"] },
      { cmd: "msgbox", args: ["Route124_Text_IsabellaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route124_Text_HuntersHouse": "HUNTER'S HOUSE",
  },
};

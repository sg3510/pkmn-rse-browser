// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Route105_OnLoad",
    onTransition: "Route105_OnTransition",
    onFrame: [
      { var: "VAR_SHOULD_END_ABNORMAL_WEATHER", value: 1, script: "AbnormalWeather_EventScript_EndEventAndCleanup_1" },
    ],
  },
  scripts: {
    "Route105_OnLoad": [
      { cmd: "call_if_unset", args: ["FLAG_REGI_DOORS_OPENED", "Route105_CloseRegiEntrance"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_105_NORTH", "AbnormalWeather_EventScript_PlaceTilesRoute105North"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_105_SOUTH", "AbnormalWeather_EventScript_PlaceTilesRoute105South"] },
      { cmd: "end" },
    ],
    "Route105_CloseRegiEntrance": [
      { cmd: "setmetatile", args: [9, 19, "METATILE_General_RockWall_RockBase", "TRUE"] },
      { cmd: "setmetatile", args: [9, 20, "METATILE_General_RockWall_SandBase", "TRUE"] },
      { cmd: "return" },
    ],
    "Route105_OnTransition": [
      { cmd: "call_if_eq", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1, "AbnormalWeather_EventScript_HideMapNamePopup"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_105_NORTH", "AbnormalWeather_StartKyogreWeather"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_105_SOUTH", "AbnormalWeather_StartKyogreWeather"] },
      { cmd: "end" },
    ],
    "Route105_EventScript_Foster": [
      { cmd: "trainerbattle_single", args: ["TRAINER_FOSTER", "Route105_Text_FosterIntro", "Route105_Text_FosterDefeated"] },
      { cmd: "msgbox", args: ["Route105_Text_FosterPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route105_EventScript_Luis": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LUIS", "Route105_Text_LuisIntro", "Route105_Text_LuisDefeated"] },
      { cmd: "msgbox", args: ["Route105_Text_LuisPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route105_EventScript_Dominik": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DOMINIK", "Route105_Text_DominikIntro", "Route105_Text_DominikDefeated"] },
      { cmd: "msgbox", args: ["Route105_Text_DominikPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route105_EventScript_Beverly": [
      { cmd: "trainerbattle_single", args: ["TRAINER_BEVERLY", "Route105_Text_BeverlyIntro", "Route105_Text_BeverlyDefeated"] },
      { cmd: "msgbox", args: ["Route105_Text_PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route105_EventScript_Imani": [
      { cmd: "trainerbattle_single", args: ["TRAINER_IMANI", "Route105_Text_ImaniIntro", "Route105_Text_ImaniDefeated"] },
      { cmd: "msgbox", args: ["Route105_Text_ImaniPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route105_EventScript_Josue": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JOSUE", "Route105_Text_JosueIntro", "Route105_Text_JosueDefeated"] },
      { cmd: "msgbox", args: ["Route105_Text_JosuePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route105_EventScript_Andres": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ANDRES_1", "Route105_Text_AndresIntro", "Route105_Text_AndresDefeated", "Route105_EventScript_AndresRegisterMatchCallAfterBattle"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route105_EventScript_AndresRematch"] },
      { cmd: "msgbox", args: ["Route105_Text_AndresPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route105_EventScript_AndresRegisterMatchCallAfterBattle": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route105_Text_AndresRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_ANDRES_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route105_EventScript_AndresRematch": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_ANDRES_1", "Route105_Text_AndresRematchIntro", "Route105_Text_AndresRematchDefeated"] },
      { cmd: "msgbox", args: ["Route105_Text_AndresRematchPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route104_Text_DadPokenavCall": "… … … … … …\\n… … … … … Beep!\\pDAD: Oh, {PLAYER}?\\p… … … … … …\\nWhere are you now?\\lIt sounds windy wherever you are.\\pI just heard from DEVON's MR. STONE\\nabout your POKéNAV, so I decided\\lto give you a call.\\pIt sounds like you're doing fine,\\nso that's fine with me.\\pYou take care now.\\p… … … … … …\\n… … … … … Click!",
    "Route104_Text_RegisteredDadInPokenav": "Registered DAD NORMAN\\nin the POKéNAV.",
  },
};

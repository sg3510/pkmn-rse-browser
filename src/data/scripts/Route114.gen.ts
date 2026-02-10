// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Route114_OnLoad",
    onTransition: "Route114_OnTransition",
    onFrame: [
      { var: "VAR_SHOULD_END_ABNORMAL_WEATHER", value: 1, script: "AbnormalWeather_EventScript_EndEventAndCleanup_1" },
    ],
  },
  scripts: {
    "Route114_OnTransition": [
      { cmd: "call_if_eq", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1, "AbnormalWeather_EventScript_HideMapNamePopup"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_114_NORTH", "AbnormalWeather_StartGroudonWeather"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_114_SOUTH", "AbnormalWeather_StartGroudonWeather"] },
      { cmd: "end" },
    ],
    "Route114_OnLoad": [
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_114_NORTH", "AbnormalWeather_EventScript_PlaceTilesRoute114North"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_114_SOUTH", "AbnormalWeather_EventScript_PlaceTilesRoute114South"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Man": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "dotimebasedevents" },
      { cmd: "goto_if_set", args: ["FLAG_DAILY_ROUTE_114_RECEIVED_BERRY", "Route114_EventScript_ReceivedBerry"] },
      { cmd: "msgbox", args: ["Route114_Text_LoveUsingBerryCrushShareBerry", "MSGBOX_DEFAULT"] },
      { cmd: "random", args: ["NUM_ROUTE_114_MAN_BERRIES"] },
      { cmd: "addvar", args: ["VAR_RESULT", "NUM_ROUTE_114_MAN_BERRIES_SKIPPED"] },
      { cmd: "addvar", args: ["VAR_RESULT", "FIRST_BERRY_INDEX"] },
      { cmd: "giveitem", args: ["VAR_RESULT"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_DAILY_ROUTE_114_RECEIVED_BERRY"] },
      { cmd: "msgbox", args: ["Route114_Text_TryBerryCrushWithFriends", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_ReceivedBerry": [
      { cmd: "msgbox", args: ["Route114_Text_FunToThinkAboutBerries", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_RoarGentleman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_TM_ROAR", "Route114_EventScript_ReceivedRoar"] },
      { cmd: "msgbox", args: ["Route114_Text_AllMyMonDoesIsRoarTakeThis", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_TM_ROAR"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_TM_ROAR"] },
      { cmd: "msgbox", args: ["Route114_Text_ExplainRoar", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_ReceivedRoar": [
      { cmd: "msgbox", args: ["Route114_Text_ExplainRoar", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_Poochyena": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_POOCHYENA", "CRY_MODE_ENCOUNTER"] },
      { cmd: "msgbox", args: ["Route114_Text_Poochyena", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_MeteorFallsSign": [
      { cmd: "msgbox", args: ["Route114_Text_MeteorFallsSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_FossilManiacsHouseSign": [
      { cmd: "msgbox", args: ["Route114_Text_FossilManiacsHouseSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_LanettesHouseSign": [
      { cmd: "msgbox", args: ["Route114_Text_LanettesHouse", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Lenny": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LENNY", "Route114_Text_LennyIntro", "Route114_Text_LennyDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_LennyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Lucas": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LUCAS_1", "Route114_Text_LucasIntro", "Route114_Text_LucasDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_LucasPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Shane": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SHANE", "Route114_Text_ShaneIntro", "Route114_Text_ShaneDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_ShanePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Nancy": [
      { cmd: "trainerbattle_single", args: ["TRAINER_NANCY", "Route114_Text_NancyIntro", "Route114_Text_NancyDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_NancyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Steve": [
      { cmd: "trainerbattle_single", args: ["TRAINER_STEVE_1", "Route114_Text_SteveIntro", "Route114_Text_SteveDefeat", "Route114_EventScript_RegisterSteve"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route114_EventScript_RematchSteve"] },
      { cmd: "msgbox", args: ["Route114_Text_StevePostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_RegisterSteve": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route114_Text_SteveRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_STEVE_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_RematchSteve": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_STEVE_1", "Route114_Text_SteveRematchIntro", "Route114_Text_SteveRematchDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_StevePostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Bernie": [
      { cmd: "trainerbattle_single", args: ["TRAINER_BERNIE_1", "Route114_Text_BernieIntro", "Route114_Text_BernieDefeat", "Route114_EventScript_RegisterBernie"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route114_EventScript_RematchBernie"] },
      { cmd: "msgbox", args: ["Route114_Text_BerniePostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_RegisterBernie": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route114_Text_BernieRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_BERNIE_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_EventScript_RematchBernie": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_BERNIE_1", "Route114_Text_BernieRematchIntro", "Route114_Text_BernieRematchDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_BerniePostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Claude": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CLAUDE", "Route114_Text_ClaudeIntro", "Route114_Text_ClaudeDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_ClaudePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Nolan": [
      { cmd: "trainerbattle_single", args: ["TRAINER_NOLAN", "Route114_Text_NolanIntro", "Route114_Text_NolanDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_NolanPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Tyra": [
      { cmd: "trainerbattle_double", args: ["TRAINER_TYRA_AND_IVY", "Route114_Text_TyraIntro", "Route114_Text_TyraDefeat", "Route114_Text_TyraNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route114_Text_TyraPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Ivy": [
      { cmd: "trainerbattle_double", args: ["TRAINER_TYRA_AND_IVY", "Route114_Text_IvyIntro", "Route114_Text_IvyDefeat", "Route114_Text_IvyNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route114_Text_IvyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Angelina": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ANGELINA", "Route114_Text_AngelinaIntro", "Route114_Text_AngelinaDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_AngelinaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Charlotte": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CHARLOTTE", "Route114_Text_CharlotteIntro", "Route114_Text_CharlotteDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_CharlottePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route114_EventScript_Kai": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KAI", "Route114_Text_KaiIntro", "Route114_Text_KaiDefeat"] },
      { cmd: "msgbox", args: ["Route114_Text_KaiPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route114_Text_AllMyMonDoesIsRoarTakeThis": "All my POKéMON does is ROAR…\\nNo one dares to come near me…\\pSigh… If you would, please take\\nthis TM away…",
    "Route114_Text_ExplainRoar": "TM05 contains ROAR.\\nA ROAR sends POKéMON scurrying.",
    "Route114_Text_Poochyena": "Bow! Bowwow!",
    "Route114_Text_MeteorFallsSign": "METEOR FALLS\\nRUSTBORO CITY THROUGH HERE",
    "Route114_Text_FossilManiacsHouseSign": "FOSSIL MANIAC'S HOUSE\\n“Fossils gratefully accepted!”",
    "Route114_Text_LanettesHouse": "LANETTE'S HOUSE",
  },
};

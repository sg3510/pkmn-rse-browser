// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Route115_OnLoad",
    onTransition: "Route115_OnTransition",
    onFrame: [
      { var: "VAR_SHOULD_END_ABNORMAL_WEATHER", value: 1, script: "AbnormalWeather_EventScript_EndEventAndCleanup_1" },
    ],
  },
  scripts: {
    "Route115_OnLoad": [
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_115_WEST", "AbnormalWeather_EventScript_PlaceTilesRoute115West"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_115_EAST", "AbnormalWeather_EventScript_PlaceTilesRoute115East"] },
      { cmd: "end" },
    ],
    "Route115_OnTransition": [
      { cmd: "call_if_eq", args: ["VAR_SHOULD_END_ABNORMAL_WEATHER", 1, "AbnormalWeather_EventScript_HideMapNamePopup"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_115_WEST", "AbnormalWeather_StartGroudonWeather"] },
      { cmd: "call_if_eq", args: ["VAR_ABNORMAL_WEATHER_LOCATION", "ABNORMAL_WEATHER_ROUTE_115_EAST", "AbnormalWeather_StartGroudonWeather"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Woman": [
      { cmd: "msgbox", args: ["Route115_Text_NeverKnowWhenCavePokemonWillAppear", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_RouteSignRustboro": [
      { cmd: "msgbox", args: ["Route115_Text_RouteSignRustboro", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_MeteorFallsSign": [
      { cmd: "msgbox", args: ["Route115_Text_MeteorFallsSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Timothy": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TIMOTHY_1", "Route115_Text_TimothyIntro", "Route115_Text_TimothyDefeat", "Route115_EventScript_RegisterTimothy"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route115_EventScript_RematchTimothy"] },
      { cmd: "msgbox", args: ["Route115_Text_TimothyPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route115_EventScript_RegisterTimothy": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route115_Text_TimothyRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_TIMOTHY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route115_EventScript_RematchTimothy": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_TIMOTHY_1", "Route115_Text_TimothyRematchIntro", "Route115_Text_TimothyRematchDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_TimothyPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Koichi": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KOICHI", "Route115_Text_KoichiIntro", "Route115_Text_KoichiDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_KoichiPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Nob": [
      { cmd: "trainerbattle_single", args: ["TRAINER_NOB_1", "Route115_Text_NobIntro", "Route115_Text_NobDefeat", "Route115_EventScript_RegisterNob"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route115_EventScript_RematchNob"] },
      { cmd: "msgbox", args: ["Route115_Text_NobPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route115_EventScript_RegisterNob": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route115_Text_NobRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_NOB_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route115_EventScript_RematchNob": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_NOB_1", "Route115_Text_NobRematchIntro", "Route115_Text_NobRematchDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_NobPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Cyndy": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CYNDY_1", "Route115_Text_CyndyIntro", "Route115_Text_CyndyDefeat", "Route115_EventScript_RegisterCyndy"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route115_EventScript_RematchCyndy"] },
      { cmd: "msgbox", args: ["Route115_Text_CyndyPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route115_EventScript_RegisterCyndy": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route115_Text_CyndyRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_CYNDY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route115_EventScript_RematchCyndy": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_CYNDY_1", "Route115_Text_CyndyRematchIntro", "Route115_Text_CyndyRematchDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_CyndyPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Hector": [
      { cmd: "trainerbattle_single", args: ["TRAINER_HECTOR", "Route115_Text_HectorIntro", "Route115_Text_HectorDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_HectorPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Kyra": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KYRA", "Route115_Text_KyraIntro", "Route115_Text_KyraDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_KyraPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Jaiden": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JAIDEN", "Route115_Text_JaidenIntro", "Route115_Text_JaidenDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_JaidenPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Alix": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ALIX", "Route115_Text_AlixIntro", "Route115_Text_AlixDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_AlixPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Helene": [
      { cmd: "trainerbattle_single", args: ["TRAINER_HELENE", "Route115_Text_HeleneIntro", "Route115_Text_HeleneDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_HelenePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route115_EventScript_Marlene": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MARLENE", "Route115_Text_MarleneIntro", "Route115_Text_MarleneDefeat"] },
      { cmd: "msgbox", args: ["Route115_Text_MarlenePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route115_Text_NeverKnowWhenCavePokemonWillAppear": "Exploring a cave isn't like walking\\non a road.\\pYou never know when wild POKéMON will\\nappear. It's full of suspense.",
    "Route115_Text_RouteSignRustboro": "ROUTE 115\\n{DOWN_ARROW} RUSTBORO CITY",
    "Route115_Text_MeteorFallsSign": "METEOR FALLS\\nFALLARBOR TOWN THROUGH HERE",
  },
};

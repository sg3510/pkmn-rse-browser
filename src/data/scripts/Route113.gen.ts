// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route113_OnTransition",
    onResume: "Route113_OnResume",
  },
  scripts: {
    "Route113_OnResume": [
      { cmd: "setstepcallback", args: ["STEP_CB_ASH"] },
      { cmd: "end" },
    ],
    "Route113_OnTransition": [
      { cmd: "clearflag", args: ["FLAG_FORCE_MIRAGE_TOWER_VISIBLE"] },
      { cmd: "call", args: ["Route113_EventScript_CheckSetAshWeather"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_CheckSetAshWeather": [
      { cmd: "getplayerxy", args: ["VAR_TEMP_0", "VAR_TEMP_1"] },
      { cmd: "goto_if_lt", args: ["VAR_TEMP_0", 19, "Route113_EventScript_DontSetAshWeather"] },
      { cmd: "goto_if_gt", args: ["VAR_TEMP_0", 84, "Route113_EventScript_DontSetAshWeather"] },
      { cmd: "setweather", args: ["WEATHER_VOLCANIC_ASH"] },
      { cmd: "return" },
    ],
    "Route113_EventScript_DontSetAshWeather": [
      { cmd: "return" },
    ],
    "Route113_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["Route113_Text_AshCanBeFashionedIntoGlass", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_NinjaBoy": [
      { cmd: "msgbox", args: ["Route113_Text_FunWalkingThroughAsh", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_RouteSign111": [
      { cmd: "msgbox", args: ["Route113_Text_RouteSign111", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_RouteSignFallarbor": [
      { cmd: "msgbox", args: ["Route113_Text_RouteSignFallarbor", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_GlassWorkshopSign": [
      { cmd: "msgbox", args: ["Route113_Text_GlassWorkshopSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_TrainerTipsRegisterKeyItems": [
      { cmd: "msgbox", args: ["Route113_Text_TrainerTipsRegisterKeyItems", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Jaylen": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JAYLEN", "Route113_Text_JaylenIntro", "Route113_Text_JaylenDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_JaylenPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Dillon": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DILLON", "Route113_Text_DillonIntro", "Route113_Text_DillonDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_DillonPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Madeline": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MADELINE_1", "Route113_Text_MadelineIntro", "Route113_Text_MadelineDefeat", "Route113_EventScript_RegisterMadeline"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route113_EventScript_RematchMadeline"] },
      { cmd: "msgbox", args: ["Route113_Text_MadelinePostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route113_EventScript_RegisterMadeline": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route113_Text_MadelineRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_MADELINE_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route113_EventScript_RematchMadeline": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_MADELINE_1", "Route113_Text_MadelineRematchIntro", "Route113_Text_MadelineRematchDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_MadelinePostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Lao": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LAO_1", "Route113_Text_LaoIntro", "Route113_Text_LaoDefeat", "Route113_EventScript_RegisterLao"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route113_EventScript_RematchLao"] },
      { cmd: "msgbox", args: ["Route113_Text_LaoPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route113_EventScript_RegisterLao": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route113_Text_LaoRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_LAO_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route113_EventScript_RematchLao": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_LAO_1", "Route113_Text_LaoRematchIntro", "Route113_Text_LaoRematchDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_LaoPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Lung": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LUNG", "Route113_Text_LungIntro", "Route113_Text_LungDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_LungPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Tori": [
      { cmd: "trainerbattle_double", args: ["TRAINER_TORI_AND_TIA", "Route113_Text_ToriIntro", "Route113_Text_ToriDefeat", "Route113_Text_ToriNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route113_Text_ToriPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Tia": [
      { cmd: "trainerbattle_double", args: ["TRAINER_TORI_AND_TIA", "Route113_Text_TiaIntro", "Route113_Text_TiaDefeat", "Route113_Text_TiaNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route113_Text_TiaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Sophie": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SOPHIE", "Route113_Text_SophieIntro", "Route113_Text_SophieDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_SophiePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Coby": [
      { cmd: "trainerbattle_single", args: ["TRAINER_COBY", "Route113_Text_CobyIntro", "Route113_Text_CobyDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_CobyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Lawrence": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LAWRENCE", "Route113_Text_LawrenceIntro", "Route113_Text_LawrenceDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_LawrencePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route113_EventScript_Wyatt": [
      { cmd: "trainerbattle_single", args: ["TRAINER_WYATT", "Route113_Text_WyattIntro", "Route113_Text_WyattDefeat"] },
      { cmd: "msgbox", args: ["Route113_Text_WyattPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route113_Text_AshCanBeFashionedIntoGlass": "Wahahaha! Today's technology is a\\nwondrous thing!\\pTake this volcanic ash here.\\nIt can be fashioned into glass.",
    "Route113_Text_FunWalkingThroughAsh": "It's fun walking through the volcano's\\nashes on the ground and grass.\\pYou can see where you walked--it's\\nreally neat!",
    "Route113_Text_RouteSign111": "ROUTE 113\\n{RIGHT_ARROW} ROUTE 111",
    "Route113_Text_RouteSignFallarbor": "ROUTE 113\\n{LEFT_ARROW} FALLARBOR TOWN",
    "Route113_Text_TrainerTipsRegisterKeyItems": "TRAINER TIPS\\pYou may register one of the KEY ITEMS\\nin your BAG as SELECT.\\pSimply press SELECT to use\\nthe registered item conveniently.",
    "Route113_Text_GlassWorkshopSign": "GLASS WORKSHOP\\n“Turning Volcanic Ash into Glass Items”",
  },
};

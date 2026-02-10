// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route117_OnTransition",
  },
  scripts: {
    "Route117_OnTransition": [
      { cmd: "call", args: ["Route117_EventScript_TryMoveDayCareMan"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_TryMoveDayCareMan": [
      { cmd: "goto_if_unset", args: ["FLAG_PENDING_DAYCARE_EGG", "Route117_EventScript_StopMoveDayCareMan"] },
      { cmd: "setobjectxyperm", args: ["LOCALID_DAYCARE_MAN", 47, 6] },
    ],
    "Route117_EventScript_StopMoveDayCareMan": [
      { cmd: "return" },
    ],
    "Route117_EventScript_Woman": [
      { cmd: "msgbox", args: ["Route117_Text_ArentTheseFlowersPretty", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_LittleBoy": [
      { cmd: "msgbox", args: ["Route117_Text_AirIsTastyHere", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Girl": [
      { cmd: "msgbox", args: ["Route117_Text_DayCarePokemonHadNewMove", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_RouteSignVerdanturf": [
      { cmd: "msgbox", args: ["Route117_Text_RouteSignVerdanturf", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_RouteSignMauville": [
      { cmd: "msgbox", args: ["Route117_Text_RouteSignMauville", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_DayCareSign": [
      { cmd: "msgbox", args: ["Route117_Text_DayCareSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Isaac": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ISAAC_1", "Route117_Text_IsaacIntro", "Route117_Text_IsaacDefeat", "Route117_EventScript_RegisterIsaac"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route117_EventScript_RematchIsaac"] },
      { cmd: "msgbox", args: ["Route117_Text_IsaacPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RegisterIsaac": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route117_Text_IsaacRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_ISAAC_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RematchIsaac": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_ISAAC_1", "Route117_Text_IsaacRematchIntro", "Route117_Text_IsaacRematchDefeat"] },
      { cmd: "msgbox", args: ["Route117_Text_IsaacPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Lydia": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LYDIA_1", "Route117_Text_LydiaIntro", "Route117_Text_LydiaDefeat", "Route117_EventScript_RegisterLydia"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route117_EventScript_RematchLydia"] },
      { cmd: "msgbox", args: ["Route117_Text_LydiaPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RegisterLydia": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route117_Text_LydiaRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_LYDIA_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RematchLydia": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_LYDIA_1", "Route117_Text_LydiaRematchIntro", "Route117_Text_LydiaRematchDefeat"] },
      { cmd: "msgbox", args: ["Route117_Text_LydiaPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Dylan": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DYLAN_1", "Route117_Text_DylanIntro", "Route117_Text_DylanDefeat", "Route117_EventScript_RegisterDylan"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route117_EventScript_RematchDylan"] },
      { cmd: "msgbox", args: ["Route117_Text_DylanPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RegisterDylan": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route117_Text_DylanRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_DYLAN_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RematchDylan": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_DYLAN_1", "Route117_Text_DylanRematchIntro", "Route117_Text_DylanRematchDefeat"] },
      { cmd: "msgbox", args: ["Route117_Text_DylanPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Maria": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MARIA_1", "Route117_Text_MariaIntro", "Route117_Text_MariaDefeat", "Route117_EventScript_RegisterMaria"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route117_EventScript_RematchMaria"] },
      { cmd: "msgbox", args: ["Route117_Text_MariaPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RegisterMaria": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route117_Text_MariaRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_MARIA_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RematchMaria": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_MARIA_1", "Route117_Text_MariaRematchIntro", "Route117_Text_MariaRematchDefeat"] },
      { cmd: "msgbox", args: ["Route117_Text_MariaPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Derek": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DEREK", "Route117_Text_DerekIntro", "Route117_Text_DerekDefeat"] },
      { cmd: "msgbox", args: ["Route117_Text_DerekPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Anna": [
      { cmd: "trainerbattle_double", args: ["TRAINER_ANNA_AND_MEG_1", "Route117_Text_AnnaIntro", "Route117_Text_AnnaDefeat", "Route117_Text_AnnaNotEnoughMons", "Route117_EventScript_RegisterAnna"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route117_EventScript_RematchAnna"] },
      { cmd: "msgbox", args: ["Route117_Text_AnnaPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RegisterAnna": [
      { cmd: "msgbox", args: ["Route117_Text_AnnaAndMegRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_ANNA_AND_MEG_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RematchAnna": [
      { cmd: "trainerbattle_rematch_double", args: ["TRAINER_ANNA_AND_MEG_1", "Route117_Text_AnnaRematchIntro", "Route117_Text_AnnaRematchDefeat", "Route117_Text_AnnaRematchNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route117_Text_AnnaPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Meg": [
      { cmd: "trainerbattle_double", args: ["TRAINER_ANNA_AND_MEG_1", "Route117_Text_MegIntro", "Route117_Text_MegDefeat", "Route117_Text_MegNotEnoughMons", "Route117_EventScript_RegisterMeg"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route117_EventScript_RematchMeg"] },
      { cmd: "msgbox", args: ["Route117_Text_MegPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RegisterMeg": [
      { cmd: "msgbox", args: ["Route117_Text_AnnaAndMegRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_ANNA_AND_MEG_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route117_EventScript_RematchMeg": [
      { cmd: "trainerbattle_rematch_double", args: ["TRAINER_ANNA_AND_MEG_1", "Route117_Text_MegRematchIntro", "Route117_Text_MegRematchDefeat", "Route117_Text_MegRematchNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route117_Text_MegPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Melina": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MELINA", "Route117_Text_MelinaIntro", "Route117_Text_MelinaDefeat"] },
      { cmd: "msgbox", args: ["Route117_Text_MelinaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Brandi": [
      { cmd: "trainerbattle_single", args: ["TRAINER_BRANDI", "Route117_Text_BrandiIntro", "Route117_Text_BrandiDefeat"] },
      { cmd: "msgbox", args: ["Route117_Text_BrandiPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route117_EventScript_Aisha": [
      { cmd: "trainerbattle_single", args: ["TRAINER_AISHA", "Route117_Text_AishaIntro", "Route117_Text_AishaDefeat"] },
      { cmd: "msgbox", args: ["Route117_Text_AishaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route117_Text_DayCarePokemonHadNewMove": "I left my POKéMON at the DAY CARE.\\pWhen I got it back, it had a new move\\nthat I didn't teach it.\\lI was really, really surprised.",
    "Route117_Text_ArentTheseFlowersPretty": "What do you think?\\nAren't these flowers pretty?\\pI planted them all!",
    "Route117_Text_AirIsTastyHere": "The air is tasty here!",
    "Route117_Text_RouteSignVerdanturf": "ROUTE 117\\n{LEFT_ARROW} VERDANTURF TOWN",
    "Route117_Text_RouteSignMauville": "ROUTE 117\\n{RIGHT_ARROW} MAUVILLE CITY",
    "Route117_Text_DayCareSign": "POKéMON DAY CARE\\n“Let us raise your POKéMON.”",
  },
};

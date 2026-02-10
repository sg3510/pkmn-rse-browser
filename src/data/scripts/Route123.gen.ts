// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route123_OnTransition",
  },
  scripts: {
    "Route123_OnTransition": [
      { cmd: "special", args: ["SetRoute123Weather"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_GigaDrainGirl": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_TM_GIGA_DRAIN", "Route123_EventScript_ReceivedGigaDrain"] },
      { cmd: "msgbox", args: ["Route123_Text_LoveGrassMonsHaveAny", "MSGBOX_DEFAULT"] },
      { cmd: "special", args: ["IsGrassTypeInParty"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Route123_EventScript_NoGrassMons"] },
      { cmd: "msgbox", args: ["Route123_Text_YouLikeGrassMonsTooHaveThis", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_TM_GIGA_DRAIN"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_TM_GIGA_DRAIN"] },
      { cmd: "msgbox", args: ["Route123_Text_CheckTreesWithMyGrassMon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_NoGrassMons": [
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_ReceivedGigaDrain": [
      { cmd: "msgbox", args: ["Route123_Text_CheckTreesWithMyGrassMon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_RouteSign": [
      { cmd: "msgbox", args: ["Route123_Text_RouteSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_RouteSignMtPyre": [
      { cmd: "msgbox", args: ["Route123_Text_RouteSignMtPyre", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_BerryMastersHouseSign": [
      { cmd: "msgbox", args: ["Route123_Text_BerryMastersHouse", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Wendy": [
      { cmd: "trainerbattle_single", args: ["TRAINER_WENDY", "Route123_Text_WendyIntro", "Route123_Text_WendyDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_WendyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Braxton": [
      { cmd: "trainerbattle_single", args: ["TRAINER_BRAXTON", "Route123_Text_BraxtonIntro", "Route123_Text_BraxtonDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_BraxtonPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Violet": [
      { cmd: "trainerbattle_single", args: ["TRAINER_VIOLET", "Route123_Text_VioletIntro", "Route123_Text_VioletDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_VioletPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Cameron": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CAMERON_1", "Route123_Text_CameronIntro", "Route123_Text_CameronDefeat", "Route123_EventScript_RegisterCameron"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route123_EventScript_RematchCameron"] },
      { cmd: "msgbox", args: ["Route123_Text_CameronPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_RegisterCameron": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route123_Text_CameronRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_CAMERON_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_RematchCameron": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_CAMERON_1", "Route123_Text_CameronRematchIntro", "Route123_Text_CameronRematchDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_CameronPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Jacki": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JACKI_1", "Route123_Text_JackiIntro", "Route123_Text_JackiDefeat", "Route123_EventScript_RegisterJacki"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route123_EventScript_RematchJacki"] },
      { cmd: "msgbox", args: ["Route123_Text_JackiPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_RegisterJacki": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route123_Text_JackiRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_JACKI_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_RematchJacki": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_JACKI_1", "Route123_Text_JackiRematchIntro", "Route123_Text_JackiRematchDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_JackiPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Miu": [
      { cmd: "trainerbattle_double", args: ["TRAINER_MIU_AND_YUKI", "Route123_Text_MiuIntro", "Route123_Text_MiuDefeat", "Route123_Text_MiuNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route123_Text_MiuPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Yuki": [
      { cmd: "trainerbattle_double", args: ["TRAINER_MIU_AND_YUKI", "Route123_Text_YukiIntro", "Route123_Text_YukiDefeat", "Route123_Text_YukiNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route123_Text_YukiPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Kindra": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KINDRA", "Route123_Text_KindraIntro", "Route123_Text_KindraDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_KindraPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Frederick": [
      { cmd: "trainerbattle_single", args: ["TRAINER_FREDRICK", "Route123_Text_FrederickIntro", "Route123_Text_FrederickDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_FrederickPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Alberto": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ALBERTO", "Route123_Text_AlbertoIntro", "Route123_Text_AlbertoDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_AlbertoPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Ed": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ED", "Route123_Text_EdIntro", "Route123_Text_EdDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_EdPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Kayley": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KAYLEY", "Route123_Text_KayleyIntro", "Route123_Text_KayleyDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_KayleyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Jonas": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JONAS", "Route123_Text_JonasIntro", "Route123_Text_JonasDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_JonasPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Jazmyn": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JAZMYN", "Route123_Text_JazmynIntro", "Route123_Text_JazmynDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_JazmynPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Davis": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DAVIS", "Route123_Text_DavisIntro", "Route123_Text_DavisDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_DavisPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route123_EventScript_Fernando": [
      { cmd: "trainerbattle_single", args: ["TRAINER_FERNANDO_1", "Route123_Text_FernandoIntro", "Route123_Text_FernandoDefeat", "Route123_EventScript_RegisterFernando"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route123_EventScript_RematchFernando"] },
      { cmd: "msgbox", args: ["Route123_Text_FernandoPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_RegisterFernando": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route123_Text_FernandoRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_FERNANDO_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route123_EventScript_RematchFernando": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_FERNANDO_1", "Route123_Text_FernandoRematchIntro", "Route123_Text_FernandoRematchDefeat"] },
      { cmd: "msgbox", args: ["Route123_Text_FernandoPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route123_Text_LoveGrassMonsHaveAny": "I love GRASS-type POKéMON!\\pDo you have any GRASS-type POKéMON?",
    "Route123_Text_YouLikeGrassMonsTooHaveThis": "Oh?\\pYou like GRASS-type POKéMON, too,\\ndon't you?\\pI'm so happy, you can have this!\\nIt's a token of our friendship.",
    "Route123_Text_CheckTreesWithMyGrassMon": "I check trees with my GRASS-type\\nPOKéMON. I'm like a tree doctor.",
    "Route123_Text_RouteSign": "{RIGHT_ARROW} ROUTE 123\\n{LEFT_ARROW} ROUTE 118",
    "Route123_Text_RouteSignMtPyre": "{UP_ARROW} MT. PYRE\\n“Forbidden to the faint of heart.”",
    "Route123_Text_BerryMastersHouse": "BERRY MASTER'S HOUSE",
  },
};

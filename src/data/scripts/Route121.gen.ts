// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route121_EventScript_Woman": [
      { cmd: "msgbox", args: ["Route121_Text_AheadLoomsMtPyre", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_MtPyrePierSign": [
      { cmd: "msgbox", args: ["Route121_Text_MtPyrePierSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_SafariZoneSign": [
      { cmd: "msgbox", args: ["Route121_Text_SafariZoneSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_AquaGruntsMoveOut": [
      { cmd: "lockall" },
      { cmd: "playbgm", args: ["MUS_ENCOUNTER_AQUA", "FALSE"] },
      { cmd: "applymovement", args: ["LOCALID_ROUTE121_GRUNT_2", "Common_Movement_WalkInPlaceRight"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route121_Text_OkayMoveOutToMtPyre", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_ROUTE121_GRUNT_1", "Route121_Movement_Grunt1Exit"] },
      { cmd: "applymovement", args: ["LOCALID_ROUTE121_GRUNT_2", "Route121_Movement_Grunt2Exit"] },
      { cmd: "applymovement", args: ["LOCALID_ROUTE121_GRUNT_3", "Route121_Movement_Grunt3Exit"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "fadedefaultbgm" },
      { cmd: "removeobject", args: ["LOCALID_ROUTE121_GRUNT_1"] },
      { cmd: "removeobject", args: ["LOCALID_ROUTE121_GRUNT_2"] },
      { cmd: "removeobject", args: ["LOCALID_ROUTE121_GRUNT_3"] },
      { cmd: "setvar", args: ["VAR_ROUTE121_STATE", 1] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route121_EventScript_Vanessa": [
      { cmd: "trainerbattle_single", args: ["TRAINER_VANESSA", "Route121_Text_VanessaIntro", "Route121_Text_VanessaDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_VanessaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Walter": [
      { cmd: "trainerbattle_single", args: ["TRAINER_WALTER_1", "Route121_Text_WalterIntro", "Route121_Text_WalterDefeat", "Route121_EventScript_RegisterWalter"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route121_EventScript_RematchWalter"] },
      { cmd: "msgbox", args: ["Route121_Text_WalterPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route121_EventScript_RegisterWalter": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route121_Text_WalterRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_WALTER_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route121_EventScript_RematchWalter": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_WALTER_1", "Route121_Text_WalterRematchIntro", "Route121_Text_WalterRematchDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_WalterPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Tammy": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TAMMY", "Route121_Text_TammyIntro", "Route121_Text_TammyDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_TammyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Kate": [
      { cmd: "trainerbattle_double", args: ["TRAINER_KATE_AND_JOY", "Route121_Text_KateIntro", "Route121_Text_KateDefeat", "Route121_Text_KateNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route121_Text_KatePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Joy": [
      { cmd: "trainerbattle_double", args: ["TRAINER_KATE_AND_JOY", "Route121_Text_JoyIntro", "Route121_Text_JoyDefeat", "Route121_Text_JoyNotEnoughMons"] },
      { cmd: "msgbox", args: ["Route121_Text_JoyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Jessica": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JESSICA_1", "Route121_Text_JessicaIntro", "Route121_Text_JessicaDefeat", "Route121_EventScript_RegisterJessica"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route121_EventScript_RematchJessica"] },
      { cmd: "msgbox", args: ["Route121_Text_JessicaPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route121_EventScript_RegisterJessica": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route121_Text_JessicaRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_JESSICA_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route121_EventScript_RematchJessica": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_JESSICA_1", "Route121_Text_JessicaRematchIntro", "Route121_Text_JessicaRematchDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_JessicaPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Cale": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CALE", "Route121_Text_CaleIntro", "Route121_Text_CaleDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_CalePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Myles": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MYLES", "Route121_Text_MylesIntro", "Route121_Text_MylesDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_MylesPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Pat": [
      { cmd: "trainerbattle_single", args: ["TRAINER_PAT", "Route121_Text_PatIntro", "Route121_Text_PatDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_PatPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Marcel": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MARCEL", "Route121_Text_MarcelIntro", "Route121_Text_MarcelDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_MarcelPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route121_EventScript_Cristin": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CRISTIN_1", "Route121_Text_CristinIntro", "Route121_Text_CristinDefeat", "Route121_EventScript_RegisterCristin"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route121_EventScript_RematchCristin"] },
      { cmd: "msgbox", args: ["Route121_Text_CristinPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route121_EventScript_RegisterCristin": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route121_Text_CristinRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_CRISTIN_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route121_EventScript_RematchCristin": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_CRISTIN_1", "Route121_Text_CristinRematchIntro", "Route121_Text_CristinRematchDefeat"] },
      { cmd: "msgbox", args: ["Route121_Text_CristinPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "Route121_Movement_Grunt1Exit": ["walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down"],
    "Route121_Movement_Grunt2Exit": ["walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down"],
    "Route121_Movement_Grunt3Exit": ["walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down", "walk_down"],
  },
  text: {
    "Route121_Text_OkayMoveOutToMtPyre": "Okay!\\nWe're to move out to MT. PYRE!",
    "Route121_Text_AheadLoomsMtPyre": "Ahead looms MT. PYRE…\\pIt is a natural monument to the spirits \\nof departed POKéMON…",
    "Route121_Text_MtPyrePierSign": "MT. PYRE PIER\\p…The sign is old and worn out.\\nThe words are barely legible…",
    "Route121_Text_SafariZoneSign": "“Filled with rare POKéMON!”\\nSAFARI ZONE",
  },
};

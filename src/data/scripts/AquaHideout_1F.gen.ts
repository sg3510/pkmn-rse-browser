// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "AquaHideout_1F_EventScript_HideoutEntranceGrunt1": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_GROUDON_AWAKENED_MAGMA_HIDEOUT", "AquaHideout_1F_EventScript_SlateportHint1"] },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_RED_OR_BLUE_ORB", "AquaHideout_1F_EventScript_MagmaHideoutHint1"] },
      { cmd: "msgbox", args: ["AquaHideout_1F_Text_OurBossIsSnatchingSomething", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_1F_EventScript_MagmaHideoutHint1": [
      { cmd: "msgbox", args: ["AquaHideout_1F_Text_WhereMightMagmaHideoutBe", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_1F_EventScript_SlateportHint1": [
      { cmd: "msgbox", args: ["AquaHideout_1F_Text_BossWentToJackASubmarine", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_1F_EventScript_HideoutEntranceGrunt2": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_GROUDON_AWAKENED_MAGMA_HIDEOUT", "AquaHideout_1F_EventScript_SlateportHint2"] },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_RED_OR_BLUE_ORB", "AquaHideout_1F_EventScript_MagmaHideoutHint2"] },
      { cmd: "msgbox", args: ["AquaHideout_1F_Text_BossIsOnRoute122", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_1F_EventScript_MagmaHideoutHint2": [
      { cmd: "msgbox", args: ["AquaHideout_1F_Text_TeamMagmaAtMtChimney", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_1F_EventScript_SlateportHint2": [
      { cmd: "msgbox", args: ["AquaHideout_1F_Text_BossIsInSlateportCity", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_1F_EventScript_Grunt1": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_AQUA_HIDEOUT_1", "AquaHideout_1F_Text_Grunt1Intro", "AquaHideout_1F_Text_Grunt1Defeat", "AquaHideout_1F_EventScript_Grunt1Defeated"] },
      { cmd: "msgbox", args: ["AquaHideout_1F_Text_Grunt1PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "AquaHideout_1F_EventScript_Grunt1Defeated": [
      { cmd: "msgbox", args: ["AquaHideout_1F_Text_Grunt1PostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AquaHideout_1F_Text_OurBossIsSnatchingSomething": "What? What? What do you want with \\nTEAM AQUA?\\pOur BOSS isn't here! He's gone off to\\nsnatch something important!\\p… …\\nWhere did he go?\\pWahaha! Do you really think I'd tell\\nyou something that crucial?",
    "AquaHideout_1F_Text_WhereMightMagmaHideoutBe": "What? What?\\nAre you a TEAM MAGMA grunt?\\pI hear that TEAM MAGMA is trying to\\nawaken an awesome POKéMON at their\\lHIDEOUT.\\pBut where might their HIDEOUT be?",
    "AquaHideout_1F_Text_BossWentToJackASubmarine": "What? What? What do you want with \\nTEAM AQUA?\\pOur BOSS isn't here!\\nHe's gone off to jack a submarine!\\p… …\\nWhere did he go?\\pWahaha! Do you really think I'd tell\\nyou something that crucial?",
    "AquaHideout_1F_Text_BossIsOnRoute122": "What? What? What do you want with \\nTEAM AQUA?\\pOur BOSS isn't here! He's on his way to\\nMT. PYRE on ROUTE 122!\\p… …\\nWhy did he go?\\pWahaha! Do you really think I'd tell\\nyou something that crucial?",
    "AquaHideout_1F_Text_TeamMagmaAtMtChimney": "What? What?\\nAre you a TEAM MAGMA grunt?\\pI hear that TEAM MAGMA is after\\nan awesome POKéMON at MT. CHIMNEY.\\pBut what is that POKéMON like?",
    "AquaHideout_1F_Text_BossIsInSlateportCity": "What? What? What do you want with\\nTEAM AQUA?\\pOur BOSS isn't here!\\nHe's on his way to SLATEPORT CITY!\\p… …\\nWhy did he go?\\pWahaha! Do you really think I'd tell\\nyou something that crucial?",
    "AquaHideout_1F_Text_Grunt1Intro": "Ayiyiyi!\\nSuspicious character spotted!",
    "AquaHideout_1F_Text_Grunt1Defeat": "Grrrrr…\\nI lost it!",
    "AquaHideout_1F_Text_Grunt1PostBattle": "I took the loss for the TEAM,\\nbut I did my job…",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "AbandonedShip_Rooms2_1F_EventScript_Dan": [
      { cmd: "trainerbattle_double", args: ["TRAINER_KIRA_AND_DAN_1", "AbandonedShip_Rooms2_1F_Text_DanIntro", "AbandonedShip_Rooms2_1F_Text_DanDefeat", "AbandonedShip_Rooms2_1F_Text_DanNotEnoughMons", "AbandonedShip_Rooms2_1F_EventScript_RegisterDan"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "AbandonedShip_Rooms2_1F_EventScript_DanRematch"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms2_1F_Text_DanPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms2_1F_EventScript_RegisterDan": [
      { cmd: "msgbox", args: ["AbandonedShip_Rooms2_1F_Text_KiraRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_KIRA_AND_DAN_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms2_1F_EventScript_DanRematch": [
      { cmd: "trainerbattle_rematch_double", args: ["TRAINER_KIRA_AND_DAN_1", "AbandonedShip_Rooms2_1F_Text_DanRematchIntro", "AbandonedShip_Rooms2_1F_Text_DanRematchDefeat", "AbandonedShip_Rooms2_1F_Text_DanRematchNotEnoughMons"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms2_1F_Text_DanPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms2_1F_EventScript_Kira": [
      { cmd: "trainerbattle_double", args: ["TRAINER_KIRA_AND_DAN_1", "AbandonedShip_Rooms2_1F_Text_KiraIntro", "AbandonedShip_Rooms2_1F_Text_KiraDefeat", "AbandonedShip_Rooms2_1F_Text_KiraNotEnoughMons", "AbandonedShip_Rooms2_1F_EventScript_RegisterKira"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "AbandonedShip_Rooms2_1F_EventScript_KiraRematch"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms2_1F_Text_KiraPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms2_1F_EventScript_RegisterKira": [
      { cmd: "msgbox", args: ["AbandonedShip_Rooms2_1F_Text_KiraRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_KIRA_AND_DAN_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms2_1F_EventScript_KiraRematch": [
      { cmd: "trainerbattle_rematch_double", args: ["TRAINER_KIRA_AND_DAN_1", "AbandonedShip_Rooms2_1F_Text_KiraRematchIntro", "AbandonedShip_Rooms2_1F_Text_KiraRematchDefeat", "AbandonedShip_Rooms2_1F_Text_KiraRematchNotEnoughMons"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms2_1F_Text_KiraPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms2_1F_EventScript_Jani": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JANI", "AbandonedShip_Rooms2_1F_Text_JaniIntro", "AbandonedShip_Rooms2_1F_Text_JaniDefeat"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms2_1F_Text_JaniPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms2_1F_EventScript_Garrison": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GARRISON", "AbandonedShip_Rooms2_1F_Text_GarrisonIntro", "AbandonedShip_Rooms2_1F_Text_GarrisonDefeat"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms2_1F_Text_GarrisonPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AbandonedShip_Rooms2_1F_Text_DanIntro": "DAN: While searching for treasures,\\nwe discovered a TRAINER!",
    "AbandonedShip_Rooms2_1F_Text_DanDefeat": "DAN: We couldn't win even though\\nwe worked together…",
    "AbandonedShip_Rooms2_1F_Text_DanPostBattle": "DAN: We can't find any treasures…\\nI wonder if someone got them already?",
    "AbandonedShip_Rooms2_1F_Text_DanNotEnoughMons": "DAN: You don't even have two POKéMON.\\nYou can't expect to beat us like that.",
    "AbandonedShip_Rooms2_1F_Text_KiraIntro": "KIRA: Oh?\\nWe were searching for treasures.\\lBut we discovered a TRAINER instead!",
    "AbandonedShip_Rooms2_1F_Text_KiraDefeat": "KIRA: Ooh, so strong!",
    "AbandonedShip_Rooms2_1F_Text_KiraPostBattle": "KIRA: Where could the treasures be?\\pI've already decided what I'm buying\\nwhen we find the treasures!",
    "AbandonedShip_Rooms2_1F_Text_KiraNotEnoughMons": "KIRA: Oh, you don't have two POKéMON?\\nWe'll have to battle some other time!",
    "AbandonedShip_Rooms2_1F_Text_KiraRegister": "KIRA: Oh, you make me so angry!\\nI'm going to register you for that!",
    "AbandonedShip_Rooms2_1F_Text_DanRematchIntro": "DAN: We've been searching for\\ntreasures all this time.\\pOur POKéMON have grown stronger, too.\\nLet us show you, okay?",
    "AbandonedShip_Rooms2_1F_Text_DanRematchDefeat": "DAN: You're strong, as usual!",
    "AbandonedShip_Rooms2_1F_Text_DanPostRematch": "DAN: We can't find any treasures,\\nwe lose at POKéMON…\\pI want to go home… But if I say that,\\nshe gets all angry with me…",
    "AbandonedShip_Rooms2_1F_Text_DanRematchNotEnoughMons": "DAN: You don't even have two POKéMON.\\nYou can't expect to beat us like that.",
    "AbandonedShip_Rooms2_1F_Text_KiraRematchIntro": "KIRA: Oh? We meet again!\\pJust like us, you still haven't given up\\nsearching for treasures, have you?\\pWant to make it so the loser has\\nto give up searching?",
    "AbandonedShip_Rooms2_1F_Text_KiraRematchDefeat": "KIRA: Oh, we lost again…",
    "AbandonedShip_Rooms2_1F_Text_KiraPostRematch": "KIRA: We're not leaving until we raise\\nour POKéMON some more and we find\\lthe treasures here!",
    "AbandonedShip_Rooms2_1F_Text_KiraRematchNotEnoughMons": "KIRA: Oh, you don't have two POKéMON?\\nWe'll have to battle some other time!",
    "AbandonedShip_Rooms2_1F_Text_JaniIntro": "I'm not good at swimming,\\nbut I am good at battles!",
    "AbandonedShip_Rooms2_1F_Text_JaniDefeat": "Oops.\\nThat didn't go very well.",
    "AbandonedShip_Rooms2_1F_Text_JaniPostBattle": "Walking around barefoot in this ship\\nis kind of gross.",
    "AbandonedShip_Rooms2_1F_Text_GarrisonIntro": "Strength and compassion…\\nThose are a TRAINER's treasures!",
    "AbandonedShip_Rooms2_1F_Text_GarrisonDefeat": "Ah, there is something about you\\nthat sparkles.",
    "AbandonedShip_Rooms2_1F_Text_GarrisonPostBattle": "In a cabin somewhere on board,\\nI saw something sparkle.",
  },
};

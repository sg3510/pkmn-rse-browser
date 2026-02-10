// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MeteorFalls_1F_2R_EventScript_Nicolas": [
      { cmd: "trainerbattle_single", args: ["TRAINER_NICOLAS_1", "MeteorFalls_1F_2R_Text_NicolasIntro", "MeteorFalls_1F_2R_Text_NicolasDefeat", "MeteorFalls_1F_2R_EventScript_RegisterNicolas"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "MeteorFalls_1F_2R_EventScript_RematchNicolas"] },
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_NicolasPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MeteorFalls_1F_2R_EventScript_RegisterNicolas": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_NicolasRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_NICOLAS_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MeteorFalls_1F_2R_EventScript_RematchNicolas": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_NICOLAS_1", "MeteorFalls_1F_2R_Text_NicolasRematchIntro", "MeteorFalls_1F_2R_Text_NicolasRematchDefeat"] },
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_NicolasPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "MeteorFalls_1F_2R_EventScript_John": [
      { cmd: "trainerbattle_double", args: ["TRAINER_JOHN_AND_JAY_1", "MeteorFalls_1F_2R_Text_JohnIntro", "MeteorFalls_1F_2R_Text_JohnDefeat", "MeteorFalls_1F_2R_Text_JohnNotEnoughMons", "MeteorFalls_1F_2R_EventScript_RegisterJohn"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "MeteorFalls_1F_2R_EventScript_RematchJohn"] },
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_JohnPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MeteorFalls_1F_2R_EventScript_RegisterJohn": [
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_JohnRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_JOHN_AND_JAY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MeteorFalls_1F_2R_EventScript_RematchJohn": [
      { cmd: "trainerbattle_rematch_double", args: ["TRAINER_JOHN_AND_JAY_1", "MeteorFalls_1F_2R_Text_JohnRematchIntro", "MeteorFalls_1F_2R_Text_JohnRematchDefeat", "MeteorFalls_1F_2R_Text_JohnRematchNotEnoughMons"] },
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_JohnPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "MeteorFalls_1F_2R_EventScript_Jay": [
      { cmd: "trainerbattle_double", args: ["TRAINER_JOHN_AND_JAY_1", "MeteorFalls_1F_2R_Text_JayIntro", "MeteorFalls_1F_2R_Text_JayDefeat", "MeteorFalls_1F_2R_Text_JayNotEnoughMons", "MeteorFalls_1F_2R_EventScript_RegisterJay"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "MeteorFalls_1F_2R_EventScript_RematchJay"] },
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_JayPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MeteorFalls_1F_2R_EventScript_RegisterJay": [
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_JohnRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_JOHN_AND_JAY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MeteorFalls_1F_2R_EventScript_RematchJay": [
      { cmd: "trainerbattle_rematch_double", args: ["TRAINER_JOHN_AND_JAY_1", "MeteorFalls_1F_2R_Text_JayRematchIntro", "MeteorFalls_1F_2R_Text_JayRematchDefeat", "MeteorFalls_1F_2R_Text_JayRematchNotEnoughMons"] },
      { cmd: "msgbox", args: ["MeteorFalls_1F_2R_Text_JayPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MeteorFalls_1F_2R_Text_NicolasIntro": "This is where we DRAGON users do our\\ntraining.\\pThe CHAMPION even visits.\\nNow do you see how special it is here?",
    "MeteorFalls_1F_2R_Text_NicolasDefeat": "Urgh!\\nI didn't expect you to be so strong!",
    "MeteorFalls_1F_2R_Text_NicolasPostBattle": "The road ahead remains long and harsh.\\pWhen will my POKéMON and I become\\nthe best?",
    "MeteorFalls_1F_2R_Text_NicolasRegister": "I want to know more about your power.\\nLet me register you in my POKéNAV.",
    "MeteorFalls_1F_2R_Text_NicolasRematchIntro": "Since we met, we have trained hard\\nwith our sights on number one.\\pHelp us see how much stronger we've\\nbecome!",
    "MeteorFalls_1F_2R_Text_NicolasRematchDefeat": "Urgh!\\nI didn't expect you to be so strong!",
    "MeteorFalls_1F_2R_Text_NicolasPostRematch": "You've obviously kept up your\\nPOKéMON training.\\pSo long as you remain strong, I, too,\\ncan become stronger!",
    "MeteorFalls_1F_2R_Text_JohnIntro": "JOHN: We've always battled POKéMON\\ntogether as a twosome.\\lWe've confidence in ourselves.",
    "MeteorFalls_1F_2R_Text_JohnDefeat": "JOHN: Oh, my.\\nWe've lost, dear wife.",
    "MeteorFalls_1F_2R_Text_JohnPostBattle": "JOHN: We've been married for\\nfifty years.\\pCome to think of it, I've yet to beat\\nmy dear wife in a battle.",
    "MeteorFalls_1F_2R_Text_JohnNotEnoughMons": "JOHN: Well, well, what a young TRAINER!\\pWill you battle with us? If so, you'll\\nhave to return with more POKéMON.",
    "MeteorFalls_1F_2R_Text_JohnRegister": "JOHN: Young TRAINER, if the chance\\narises, will you battle with us again?",
    "MeteorFalls_1F_2R_Text_JayIntro": "JAY: We've been married for\\nfifty years.\\pThe bond we share as a couple could\\nnever be broken.",
    "MeteorFalls_1F_2R_Text_JayDefeat": "JAY: Oh, dear.\\nWe've lost, my dear husband.",
    "MeteorFalls_1F_2R_Text_JayPostBattle": "JAY: Fifty years of marriage…\\pIf we ever argued, we always settled\\nit with a POKéMON battle…",
    "MeteorFalls_1F_2R_Text_JayNotEnoughMons": "JAY: Well, well, aren't you a young\\nTRAINER?\\pIf you'd care to battle with us, you'll\\nhave to come back with more POKéMON.",
    "MeteorFalls_1F_2R_Text_JohnRematchIntro": "JOHN: We've always battled POKéMON\\ntogether as a twosome.\\lWe've confidence in ourselves.",
    "MeteorFalls_1F_2R_Text_JohnRematchDefeat": "JOHN: Oh, my.\\nWe've lost, dear wife.",
    "MeteorFalls_1F_2R_Text_JohnPostRematch": "JOHN: Married for fifty years…\\pOn reflection, the dear wife and I,\\nwe battled day in and day out…",
    "MeteorFalls_1F_2R_Text_JohnRematchNotEnoughMons": "JOHN: Well, well, what a young TRAINER!\\pWill you battle with us? If so, you'll\\nhave to return with more POKéMON.",
    "MeteorFalls_1F_2R_Text_JayRematchIntro": "JAY: We've been married for\\nfifty years.\\pWe've supported each other all that\\ntime. We've made ourselves strong.",
    "MeteorFalls_1F_2R_Text_JayRematchDefeat": "JAY: Oh, dear.\\nWe've lost, my dear husband.",
    "MeteorFalls_1F_2R_Text_JayPostRematch": "JAY: Fifty years of marriage…\\nMany things have happened.\\pI hope that we will continue to make\\nhappy memories together.",
    "MeteorFalls_1F_2R_Text_JayRematchNotEnoughMons": "JAY: Well, well, aren't you a young\\nTRAINER?\\pIf you'd care to battle with us, you'll\\nhave to come back with more POKéMON.",
  },
};

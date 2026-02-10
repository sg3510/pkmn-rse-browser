// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MtPyre_6F_EventScript_Valerie": [
      { cmd: "trainerbattle_single", args: ["TRAINER_VALERIE_1", "MtPyre_6F_Text_ValerieIntro", "MtPyre_6F_Text_ValerieDefeat", "MtPyre_6F_EventScript_RegisterValerie"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "MtPyre_6F_EventScript_RematchValerie"] },
      { cmd: "msgbox", args: ["MtPyre_6F_Text_ValeriePostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MtPyre_6F_EventScript_RegisterValerie": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["MtPyre_6F_Text_ValerieRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_VALERIE_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MtPyre_6F_EventScript_RematchValerie": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_VALERIE_1", "MtPyre_6F_Text_ValerieRematchIntro", "MtPyre_6F_Text_ValerieRematchDefeat"] },
      { cmd: "msgbox", args: ["MtPyre_6F_Text_ValeriePostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "MtPyre_6F_EventScript_Cedric": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CEDRIC", "MtPyre_6F_Text_CedricIntro", "MtPyre_6F_Text_CedricDefeat"] },
      { cmd: "msgbox", args: ["MtPyre_6F_Text_CedricPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MtPyre_6F_Text_ValerieIntro": "When I'm here…\\nA curious power flows into me…",
    "MtPyre_6F_Text_ValerieDefeat": "The power is ebbing away…",
    "MtPyre_6F_Text_ValeriePostBattle": "Perhaps the power is from the spirits\\nof POKéMON in fitful sleep here…",
    "MtPyre_6F_Text_ValerieRegister": "Fufufu… I lost the match, but…\\nI have this little ability…\\pWithout ever laying my hands on\\nyour POKéNAV… Hiyah!",
    "MtPyre_6F_Text_ValerieRematchIntro": "Behind you…\\nWhat is it…",
    "MtPyre_6F_Text_ValerieRematchDefeat": "Something faded away…",
    "MtPyre_6F_Text_ValeriePostRematch": "The POKéMON at rest here…\\nSometimes, they play…",
    "MtPyre_6F_Text_CedricIntro": "Have you lost your bearings?\\nHave no fear for I am here!",
    "MtPyre_6F_Text_CedricDefeat": "Weren't you lost?",
    "MtPyre_6F_Text_CedricPostBattle": "I had this feeling that a lost TRAINER\\nwould be panicked and easy to beat.\\pIt's dirty and I won't try it again…",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MtPyre_3F_EventScript_William": [
      { cmd: "trainerbattle_single", args: ["TRAINER_WILLIAM", "MtPyre_3F_Text_WilliamIntro", "MtPyre_3F_Text_WilliamDefeat"] },
      { cmd: "msgbox", args: ["MtPyre_3F_Text_WilliamPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "MtPyre_3F_EventScript_Kayla": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KAYLA", "MtPyre_3F_Text_KaylaIntro", "MtPyre_3F_Text_KaylaDefeat"] },
      { cmd: "msgbox", args: ["MtPyre_3F_Text_KaylaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "MtPyre_3F_EventScript_Gabrielle": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GABRIELLE_1", "MtPyre_3F_Text_GabrielleIntro", "MtPyre_3F_Text_GabrielleDefeat", "MtPyre_3F_EventScript_RegisterGabrielle"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "MtPyre_3F_EventScript_RematchGabrielle"] },
      { cmd: "msgbox", args: ["MtPyre_3F_Text_GabriellePostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MtPyre_3F_EventScript_RegisterGabrielle": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["MtPyre_3F_Text_GabrielleRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_GABRIELLE_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MtPyre_3F_EventScript_RematchGabrielle": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_GABRIELLE_1", "MtPyre_3F_Text_GabrielleRematchIntro", "MtPyre_3F_Text_GabrielleRematchDefeat"] },
      { cmd: "msgbox", args: ["MtPyre_3F_Text_GabriellePostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MtPyre_3F_Text_WilliamIntro": "The rich atmosphere of the mountain\\nhas elevated my psychic power!\\pA mere child like you…\\nYou dream of winning?",
    "MtPyre_3F_Text_WilliamDefeat": "I drown in self-pity…",
    "MtPyre_3F_Text_WilliamPostBattle": "My psychic powers have surely\\ngrown several times, but…",
    "MtPyre_3F_Text_KaylaIntro": "Ahahahaha!\\pThis is no place for children, least\\nof all you!",
    "MtPyre_3F_Text_KaylaDefeat": "I lost that cleanly…",
    "MtPyre_3F_Text_KaylaPostBattle": "This means my training is still not\\nenough…\\pI've got to keep working toward the\\nsummit…\\pGo, me!",
    "MtPyre_3F_Text_GabrielleIntro": "Why have you come here?",
    "MtPyre_3F_Text_GabrielleDefeat": "That was amazing!\\nYou're a very special TRAINER.",
    "MtPyre_3F_Text_GabriellePostBattle": "POKéMON no longer of this world.\\nPOKéMON that are with you now.\\pAnd the POKéMON that you will meet\\nin the future…\\pThey are all to be equally cherished.\\nPlease remember that.",
    "MtPyre_3F_Text_GabrielleRegister": "I would like to see your POKéMON\\nwhen they grow up some more…\\pPlease, I need to see your POKéNAV.",
    "MtPyre_3F_Text_GabrielleRematchIntro": "Oh, it's you…\\pHave you come to show me your grown\\nPOKéMON?",
    "MtPyre_3F_Text_GabrielleRematchDefeat": "How amazing!\\nYou are a special person.",
    "MtPyre_3F_Text_GabriellePostRematch": "POKéMON no longer of this world.\\nPOKéMON that are with you now.\\pAnd the POKéMON that you will meet\\nin the future…\\pThey are all to be equally cherished.\\nI see that you've remembered that.",
  },
};

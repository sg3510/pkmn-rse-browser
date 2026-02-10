// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "BattleFrontier_Lounge1_EventScript_Breeder": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "call_if_unset", args: ["FLAG_MET_BATTLE_FRONTIER_BREEDER", "BattleFrontier_Lounge1_EventScript_BreederIntro"] },
      { cmd: "call_if_set", args: ["FLAG_MET_BATTLE_FRONTIER_BREEDER", "BattleFrontier_Lounge1_EventScript_AlreadyMetBreeder"] },
      { cmd: "setflag", args: ["FLAG_MET_BATTLE_FRONTIER_BREEDER"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_ChooseMonToShowBreeder"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_ChooseMonToShowBreeder": [
      { cmd: "special", args: ["ChoosePartyMon"] },
      { cmd: "waitstate" },
      { cmd: "goto_if_ne", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "BattleFrontier_Lounge1_EventScript_ShowMonToBreeder"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "BattleFrontier_Lounge1_EventScript_CancelMonSelect"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_BreederIntro": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_PokemonBreederIntro", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "BattleFrontier_Lounge1_EventScript_AlreadyMetBreeder": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_LetsLookAtYourPokemon", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "BattleFrontier_Lounge1_EventScript_ShowMonToBreeder": [
      { cmd: "specialvar", args: ["VAR_RESULT", "ScriptGetPartyMonSpecies"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "SPECIES_EGG", "BattleFrontier_Lounge1_EventScript_ShowEggToBreeder"] },
      { cmd: "special", args: ["BufferVarsForIVRater"] },
      { cmd: "goto_if_le", args: ["VAR_0x8005", 90, "BattleFrontier_Lounge1_EventScript_AverageTotalIVs"] },
      { cmd: "goto_if_le", args: ["VAR_0x8005", 120, "BattleFrontier_Lounge1_EventScript_AboveAverageTotalIVs"] },
      { cmd: "goto_if_le", args: ["VAR_0x8005", 150, "BattleFrontier_Lounge1_EventScript_HighTotalIVs"] },
      { cmd: "goto_if_ge", args: ["VAR_0x8005", 151, "BattleFrontier_Lounge1_EventScript_VeryHighTotalIVs"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_ShowEggToBreeder": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_EvenICantTell", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_ChooseMonToShowBreeder"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVStat": [
      { cmd: "goto_if_eq", args: ["VAR_0x8006", "STAT_HP", "BattleFrontier_Lounge1_EventScript_HighestIVHP"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8006", "STAT_ATK", "BattleFrontier_Lounge1_EventScript_HighestIVAtk"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8006", "STAT_DEF", "BattleFrontier_Lounge1_EventScript_HighestIVDef"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8006", "STAT_SPEED", "BattleFrontier_Lounge1_EventScript_HighestIVSpeed"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8006", "STAT_SPATK", "BattleFrontier_Lounge1_EventScript_HighestIVSpAtk"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8006", "STAT_SPDEF", "BattleFrontier_Lounge1_EventScript_HighestIVSpDef"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVValue": [
      { cmd: "goto_if_le", args: ["VAR_0x8007", 15, "BattleFrontier_Lounge1_EventScript_HighestIVLow"] },
      { cmd: "goto_if_le", args: ["VAR_0x8007", 25, "BattleFrontier_Lounge1_EventScript_HighestIVMid"] },
      { cmd: "goto_if_le", args: ["VAR_0x8007", 30, "BattleFrontier_Lounge1_EventScript_HighestIVHigh"] },
      { cmd: "goto_if_ge", args: ["VAR_0x8007", 31, "BattleFrontier_Lounge1_EventScript_HighestIVMax"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_EndBreederComments": [
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_AverageTotalIVs": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_AverageAbility", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVStat"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_AboveAverageTotalIVs": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_BetterThanAverageAbility", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVStat"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighTotalIVs": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_ImpressiveAbility", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVStat"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_VeryHighTotalIVs": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_OutstandingAbility", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVStat"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVHP": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_BestAspectHP", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVValue"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVAtk": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_BestAspectAtk", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVValue"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVDef": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_BestAspectDef", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVValue"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVSpeed": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_BestAspectSpeed", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVValue"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVSpAtk": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_BestAspectSpAtk", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVValue"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVSpDef": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_BestAspectSpDef", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_HighestIVValue"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVLow": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_StatRelativelyGood", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_EndBreederComments"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVMid": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_StatImpressive", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_EndBreederComments"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVHigh": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_StatOutstanding", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_EndBreederComments"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_HighestIVMax": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_StatFlawless", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["BattleFrontier_Lounge1_EventScript_EndBreederComments"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_CancelMonSelect": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_NoTimeForMyAdvice", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_Boy1": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_SaidMyMonIsOutstanding", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge1_EventScript_Boy2": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge1_Text_DidntDoAnythingSpecialRaisingIt", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "BattleFrontier_Lounge1_Text_PokemonBreederIntro": "For 70 years I have raised POKéMON!\\nI am the man they revere as\\lthe legendary top POKéMON BREEDER!\\pIf you ever become as seasoned as me,\\nyou'll see the abilities of POKéMON\\lat a glance.\\pYou're a TRAINER. Doesn't it interest\\nyou to know your own POKéMON's\\labilities?\\pHere!\\nLet's have a look at your POKéMON!",
    "BattleFrontier_Lounge1_Text_AverageAbility": "…Hmm…\\pThis one, overall, I would describe\\nas being of average ability.",
    "BattleFrontier_Lounge1_Text_BetterThanAverageAbility": "…Hmm…\\pThis one, overall, I would describe as\\nhaving better-than-average ability.",
    "BattleFrontier_Lounge1_Text_ImpressiveAbility": "…Hmm…\\pThis one, overall, I would say is\\nquite impressive in ability!",
    "BattleFrontier_Lounge1_Text_OutstandingAbility": "…Hmm…\\pThis one, overall, I would say is\\nwonderfully outstanding in ability!",
    "BattleFrontier_Lounge1_Text_BestAspectHP": "Incidentally, the best aspect of it,\\nI would say, is its HP…",
    "BattleFrontier_Lounge1_Text_BestAspectAtk": "Incidentally, the best aspect of it,\\nI would say, is its ATTACK…",
    "BattleFrontier_Lounge1_Text_BestAspectDef": "Incidentally, the best aspect of it,\\nI would say, is its DEFENSE…",
    "BattleFrontier_Lounge1_Text_BestAspectSpAtk": "Incidentally, the best aspect of it,\\nI would say, is its SPECIAL ATTACK…",
    "BattleFrontier_Lounge1_Text_BestAspectSpDef": "Incidentally, the best aspect of it,\\nI would say, is its SPECIAL DEFENSE…",
    "BattleFrontier_Lounge1_Text_BestAspectSpeed": "Incidentally, the best aspect of it,\\nI would say, is its SPEED…",
    "BattleFrontier_Lounge1_Text_StatRelativelyGood": "That stat is relatively good.\\n…Hm… That's how I call it.",
    "BattleFrontier_Lounge1_Text_StatImpressive": "That stat is quite impressive.\\n…Hm… That's how I call it.",
    "BattleFrontier_Lounge1_Text_StatOutstanding": "That stat is outstanding!\\n…Hm… That's how I call it.",
    "BattleFrontier_Lounge1_Text_StatFlawless": "It's flawless! A thing of perfection!\\n…Hm… That's how I call it.",
    "BattleFrontier_Lounge1_Text_NoTimeForMyAdvice": "What?\\nYou have no time for my advice?\\pYou should always be eager to learn\\nfrom the experiences of your elders!",
    "BattleFrontier_Lounge1_Text_HaveBusinessNeedsTending": "Yes, what is it now?\\pI have business that needs tending!\\nSave it for next time!",
    "BattleFrontier_Lounge1_Text_LetsLookAtYourPokemon": "Ah, youngster! Do your POKéMON's\\nabilities intrigue you?\\pHere, here!\\nLet's have a look at your POKéMON!",
    "BattleFrontier_Lounge1_Text_EvenICantTell": "An expert I am, but even I can't tell\\nanything about an unhatched POKéMON!\\pShow me a POKéMON!\\nA POKéMON is what I need to see!",
    "BattleFrontier_Lounge1_Text_SaidMyMonIsOutstanding": "He said my POKéMON is outstanding!\\nI'm glad I raised it carefully!",
    "BattleFrontier_Lounge1_Text_DidntDoAnythingSpecialRaisingIt": "He said my POKéMON is outstanding!\\nBut I didn't do anything special\\lraising it…",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "RustboroCity_CuttersHouse_EventScript_Cutter": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_HM_CUT", "RustboroCity_CuttersHouse_EventScript_ExplainCut"] },
      { cmd: "msgbox", args: ["RustboroCity_CuttersHouse_Text_YouCanPutThisHMToGoodUse", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_HM_CUT"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_HM_CUT"] },
      { cmd: "msgbox", args: ["RustboroCity_CuttersHouse_Text_ExplainCut", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_CuttersHouse_EventScript_ExplainCut": [
      { cmd: "msgbox", args: ["RustboroCity_CuttersHouse_Text_ExplainCut", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_CuttersHouse_EventScript_Lass": [
      { cmd: "msgbox", args: ["RustboroCity_CuttersHouse_Text_DadHelpedClearLandOfTrees", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_CuttersHouse_Text_YouCanPutThisHMToGoodUse": "That determined expression…\\nThat limber way you move…\\lAnd your well-trained POKéMON…\\pYou're obviously a skilled TRAINER!\\pNo, wait, don't say a word.\\nI can tell just by looking at you.\\pI'm sure that you can put this\\nHIDDEN MACHINE to good use.\\pNo need to be modest or shy.\\nGo on, take it!",
    "RustboroCity_CuttersHouse_Text_ExplainCut": "That HIDDEN MACHINE, or HM for\\nshort, is CUT.\\pAn HM move is one that can be used\\nby POKéMON outside of battle.\\pAny POKéMON that's learned CUT can\\nchop down thin trees if the TRAINER\\lhas earned the STONE BADGE.\\pAnd, unlike a TM, an HM can be used\\nmore than once.",
    "RustboroCity_CuttersHouse_Text_DadHelpedClearLandOfTrees": "When they were expanding the city of\\nRUSTBORO, my dad helped out.\\pHe made his POKéMON use CUT to clear\\nthe land of trees.",
  },
};

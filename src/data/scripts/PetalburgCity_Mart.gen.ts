// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "PetalburgCity_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "goto_if_set", args: ["FLAG_PETALBURG_MART_EXPANDED_ITEMS", "PetalburgCity_Mart_EventScript_ExpandedItems"] },
      { cmd: "pokemart", args: ["PetalburgCity_Mart_Pokemart_Basic"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "PetalburgCity_Mart_Pokemart_Basic": [
      { cmd: ".2byte", args: ["ITEM_POKE_BALL"] },
      { cmd: ".2byte", args: ["ITEM_POTION"] },
      { cmd: ".2byte", args: ["ITEM_ANTIDOTE"] },
      { cmd: ".2byte", args: ["ITEM_PARALYZE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_AWAKENING"] },
      { cmd: ".2byte", args: ["ITEM_ESCAPE_ROPE"] },
      { cmd: ".2byte", args: ["ITEM_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_X_SPEED"] },
      { cmd: ".2byte", args: ["ITEM_X_ATTACK"] },
      { cmd: ".2byte", args: ["ITEM_X_DEFEND"] },
      { cmd: ".2byte", args: ["ITEM_ORANGE_MAIL"] },
      { cmd: "pokemartlistend" },
    ],
    "PetalburgCity_Mart_EventScript_ExpandedItems": [
      { cmd: "pokemart", args: ["PetalburgCity_Mart_Pokemart_Expanded"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "PetalburgCity_Mart_Pokemart_Expanded": [
      { cmd: ".2byte", args: ["ITEM_POKE_BALL"] },
      { cmd: ".2byte", args: ["ITEM_GREAT_BALL"] },
      { cmd: ".2byte", args: ["ITEM_POTION"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_ANTIDOTE"] },
      { cmd: ".2byte", args: ["ITEM_PARALYZE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_AWAKENING"] },
      { cmd: ".2byte", args: ["ITEM_ESCAPE_ROPE"] },
      { cmd: ".2byte", args: ["ITEM_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_X_SPEED"] },
      { cmd: ".2byte", args: ["ITEM_X_ATTACK"] },
      { cmd: ".2byte", args: ["ITEM_X_DEFEND"] },
      { cmd: ".2byte", args: ["ITEM_ORANGE_MAIL"] },
      { cmd: "pokemartlistend" },
    ],
    "PetalburgCity_Mart_EventScript_Woman": [
      { cmd: "msgbox", args: ["PetalburgCity_Mart_Text_WeakWillGrowStronger", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PetalburgCity_Mart_EventScript_Boy": [
      { cmd: "msgbox", args: ["PetalburgCity_Mart_Text_RepelIsUseful", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PetalburgCity_Mart_EventScript_Man": [
      { cmd: "msgbox", args: ["PetalburgCity_Mart_Text_TakeSomeAntidotesWithYou", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "PetalburgCity_Mart_Text_WeakWillGrowStronger": "Even if a POKéMON is weak now,\\nit will grow stronger.\\pThe most important thing is love!\\nLove for your POKéMON!",
    "PetalburgCity_Mart_Text_RepelIsUseful": "Do you use REPEL?\\nIt keeps POKéMON away, so it's\\luseful when you're in a hurry.",
    "PetalburgCity_Mart_Text_TakeSomeAntidotesWithYou": "Do you have any ANTIDOTES with\\nyou?\\pIf you walk around with a poisoned\\nPOKéMON, it will lose HP until it faints.\\lTake some ANTIDOTES with you.",
  },
};

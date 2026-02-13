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
    ],
    "PetalburgCity_Mart_Pokemart_Basic": [
      { cmd: "pokemartlistend" },
    ],
    "PetalburgCity_Mart_EventScript_ExpandedItems": [
      { cmd: "pokemart", args: ["PetalburgCity_Mart_Pokemart_Expanded"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_Mart_Pokemart_Expanded": [
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

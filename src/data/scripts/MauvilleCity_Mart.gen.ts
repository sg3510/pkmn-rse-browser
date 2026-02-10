// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MauvilleCity_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["MauvilleCity_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "MauvilleCity_Mart_Pokemart": [
      { cmd: ".2byte", args: ["ITEM_POKE_BALL"] },
      { cmd: ".2byte", args: ["ITEM_GREAT_BALL"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_ANTIDOTE"] },
      { cmd: ".2byte", args: ["ITEM_PARALYZE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_AWAKENING"] },
      { cmd: ".2byte", args: ["ITEM_X_SPEED"] },
      { cmd: ".2byte", args: ["ITEM_X_ATTACK"] },
      { cmd: ".2byte", args: ["ITEM_X_DEFEND"] },
      { cmd: ".2byte", args: ["ITEM_GUARD_SPEC"] },
      { cmd: ".2byte", args: ["ITEM_DIRE_HIT"] },
      { cmd: ".2byte", args: ["ITEM_X_ACCURACY"] },
      { cmd: "pokemartlistend" },
    ],
    "MauvilleCity_Mart_EventScript_ExpertM": [
      { cmd: "msgbox", args: ["MauvilleCity_Mart_Text_ItemsToTemporarilyElevateStats", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MauvilleCity_Mart_EventScript_Man": [
      { cmd: "msgbox", args: ["MauvilleCity_Mart_Text_DecisionsDetermineBattle", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MauvilleCity_Mart_Text_ItemsToTemporarilyElevateStats": "There are items that temporarily\\nelevate the stats of POKéMON.\\pThe ones I know you use in battle\\nare X ATTACK and X DEFEND…\\pI do believe that there are others\\nlike them.",
    "MauvilleCity_Mart_Text_DecisionsDetermineBattle": "Use a certain move, or use an item\\ninstead…\\pThe TRAINER's decisions determine how\\nbattles turn out, I think.",
  },
};

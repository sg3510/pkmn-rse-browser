// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FortreeCity_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["FortreeCity_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "FortreeCity_Mart_Pokemart": [
      { cmd: ".2byte", args: ["ITEM_GREAT_BALL"] },
      { cmd: ".2byte", args: ["ITEM_ULTRA_BALL"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_HYPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_ANTIDOTE"] },
      { cmd: ".2byte", args: ["ITEM_PARALYZE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_AWAKENING"] },
      { cmd: ".2byte", args: ["ITEM_REVIVE"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_WOOD_MAIL"] },
      { cmd: "pokemartlistend" },
    ],
    "FortreeCity_Mart_EventScript_Woman": [
      { cmd: "msgbox", args: ["FortreeCity_Mart_Text_SuperRepelBetter", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_Mart_EventScript_Girl": [
      { cmd: "msgbox", args: ["FortreeCity_Mart_Text_StockUpOnItems", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_Mart_EventScript_Boy": [
      { cmd: "msgbox", args: ["FortreeCity_Mart_Text_RareCandyMakesMonGrow", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FortreeCity_Mart_Text_SuperRepelBetter": "SUPER REPEL lasts a long time,\\nand it gets the job done.\\pIt's much better than an ordinary\\nREPEL.",
    "FortreeCity_Mart_Text_StockUpOnItems": "I always stock up on more items than\\nI'm sure I'll need.\\pYou never know what might happen.\\nBetter to be safe than sorry!",
    "FortreeCity_Mart_Text_RareCandyMakesMonGrow": "A RARE CANDY makes a POKéMON grow\\nimmediately by one level.",
  },
};

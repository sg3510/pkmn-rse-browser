// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SlateportCity_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["SlateportCity_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "SlateportCity_Mart_Pokemart": [
      { cmd: ".2byte", args: ["ITEM_POKE_BALL"] },
      { cmd: ".2byte", args: ["ITEM_GREAT_BALL"] },
      { cmd: ".2byte", args: ["ITEM_POTION"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_ANTIDOTE"] },
      { cmd: ".2byte", args: ["ITEM_PARALYZE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_ESCAPE_ROPE"] },
      { cmd: ".2byte", args: ["ITEM_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_HARBOR_MAIL"] },
      { cmd: "pokemartlistend" },
    ],
    "SlateportCity_Mart_EventScript_BlackBelt": [
      { cmd: "msgbox", args: ["SlateportCity_Mart_Text_SomeItemsOnlyAtMart", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SlateportCity_Mart_EventScript_Man": [
      { cmd: "msgbox", args: ["SlateportCity_Mart_Text_GreatBallIsBetter", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SlateportCity_Mart_Text_SomeItemsOnlyAtMart": "The MARKET does have some interesting\\nmerchandise.\\pBut there are some items you can only\\nget at a POKéMON MART.",
    "SlateportCity_Mart_Text_GreatBallIsBetter": "A GREAT BALL is better than a POKé BALL\\nat catching POKéMON.\\pWith this, I should be able to get that\\nelusive POKéMON…",
  },
};

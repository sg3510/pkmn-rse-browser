// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "OldaleTown_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "goto_if_set", args: ["FLAG_ADVENTURE_STARTED", "OldaleTown_Mart_ExpandedItems"] },
      { cmd: "pokemart", args: ["OldaleTown_Mart_Pokemart_Basic"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "OldaleTown_Mart_Pokemart_Basic": [
      { cmd: "pokemartlistend" },
    ],
    "OldaleTown_Mart_ExpandedItems": [
      { cmd: "pokemart", args: ["OldaleTown_Mart_Pokemart_Expanded"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "OldaleTown_Mart_Pokemart_Expanded": [
      { cmd: "pokemartlistend" },
    ],
    "OldaleTown_Mart_EventScript_Woman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_ADVENTURE_STARTED", "OldaleTown_Mart_EventScript_PokeBallsInStock"] },
      { cmd: "msgbox", args: ["OldaleTown_Mart_Text_PokeBallsAreSoldOut", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "OldaleTown_Mart_EventScript_PokeBallsInStock": [
      { cmd: "msgbox", args: ["OldaleTown_Mart_Text_ImGoingToBuyPokeBalls", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "OldaleTown_Mart_EventScript_Boy": [
      { cmd: "msgbox", args: ["OldaleTown_Mart_Text_RestoreHPWithPotion", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "OldaleTown_Mart_Text_PokeBallsAreSoldOut": "The clerk says they're all sold out.\\nI can't buy any POKé BALLS.",
    "OldaleTown_Mart_Text_ImGoingToBuyPokeBalls": "I'm going to buy a bunch of POKé BALLS\\nand catch a bunch of POKéMON!",
    "OldaleTown_Mart_Text_RestoreHPWithPotion": "If a POKéMON gets hurt and loses its HP\\nand faints, it won't be able to battle.\\pTo prevent your POKéMON from fainting,\\nrestore its HP with a POTION.",
  },
};

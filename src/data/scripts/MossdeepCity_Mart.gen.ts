// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MossdeepCity_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["MossdeepCity_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "MossdeepCity_Mart_Pokemart": [
      { cmd: ".2byte", args: ["ITEM_ULTRA_BALL"] },
      { cmd: ".2byte", args: ["ITEM_NET_BALL"] },
      { cmd: ".2byte", args: ["ITEM_DIVE_BALL"] },
      { cmd: ".2byte", args: ["ITEM_HYPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_FULL_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_REVIVE"] },
      { cmd: ".2byte", args: ["ITEM_MAX_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_X_ATTACK"] },
      { cmd: ".2byte", args: ["ITEM_X_DEFEND"] },
      { cmd: "pokemartlistend" },
    ],
    "MossdeepCity_Mart_EventScript_Woman": [
      { cmd: "msgbox", args: ["MossdeepCity_Mart_Text_ReviveIsFantastic", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MossdeepCity_Mart_EventScript_Boy": [
      { cmd: "msgbox", args: ["MossdeepCity_Mart_Text_MaxRepelLastsLongest", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MossdeepCity_Mart_EventScript_Sailor": [
      { cmd: "msgbox", args: ["MossdeepCity_Mart_Text_NetAndDiveBallsRare", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MossdeepCity_Mart_Text_ReviveIsFantastic": "REVIVE is fantastic!\\pGive it to a fainted POKéMON,\\nand the POKéMON will arise.\\pBut be careful, REVIVE doesn't restore\\nthe used-up PP of moves.",
    "MossdeepCity_Mart_Text_MaxRepelLastsLongest": "MAX REPEL keeps all weak POKéMON away.\\pOut of all the REPEL sprays, it lasts\\nthe longest.",
    "MossdeepCity_Mart_Text_NetAndDiveBallsRare": "The NET and DIVE BALLS are rare POKé\\nBALLS that are only made in MOSSDEEP.\\pA NET BALL is effective against\\nBUG-type and WATER-type POKéMON.\\pA DIVE BALL works best on POKéMON\\nat the bottom of the sea.",
  },
};

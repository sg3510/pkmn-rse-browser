// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "BattleFrontier_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["BattleFrontier_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Mart_Pokemart": [
      { cmd: "pokemartlistend" },
    ],
    "BattleFrontier_Mart_EventScript_OldMan": [
      { cmd: "msgbox", args: ["BattleFrontier_Mart_Text_ChaperonGrandson", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Mart_EventScript_OldWoman": [
      { cmd: "lock" },
      { cmd: "applymovement", args: ["LOCALID_FRONTIER_MART_OLD_WOMAN", "Common_Movement_FaceDown"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["BattleFrontier_Mart_Text_ProteinMakeNiceGift", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Mart_EventScript_Boy": [
      { cmd: "msgbox", args: ["BattleFrontier_Mart_Text_FacilitiesDontAllowItems", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "BattleFrontier_Mart_Text_ChaperonGrandson": "We came here to chaperon our\\ngrandson.\\pBut since we're here, we thought\\nwe should get some souvenirs.",
    "BattleFrontier_Mart_Text_ProteinMakeNiceGift": "Dear, what do you think of this?\\nWouldn't this make a nice gift?\\pIt's…PRO…TE…IN?\\nIt sounds delicious, doesn't it?",
    "BattleFrontier_Mart_Text_FacilitiesDontAllowItems": "A lot of the BATTLE FRONTIER's\\nfacilities don't allow the use of items\\lduring battles.\\pThat rule makes things tougher than\\nthey already are!",
  },
};

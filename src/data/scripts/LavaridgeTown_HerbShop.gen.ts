// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LavaridgeTown_HerbShop_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["LavaridgeTown_HerbShop_Text_WelcomeToHerbShop"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["LavaridgeTown_HerbShop_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "LavaridgeTown_HerbShop_Pokemart": [
      { cmd: ".2byte", args: ["ITEM_ENERGY_POWDER"] },
      { cmd: ".2byte", args: ["ITEM_ENERGY_ROOT"] },
      { cmd: ".2byte", args: ["ITEM_HEAL_POWDER"] },
      { cmd: ".2byte", args: ["ITEM_REVIVAL_HERB"] },
      { cmd: "pokemartlistend" },
    ],
    "LavaridgeTown_HerbShop_EventScript_ExpertM": [
      { cmd: "msgbox", args: ["LavaridgeTown_HerbShop_Text_HerbalMedicineWorksButMonWillDislike", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LavaridgeTown_HerbShop_EventScript_OldMan": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_CHARCOAL", "LavaridgeTown_HerbShop_EventScript_ExplainCharcoal"] },
      { cmd: "msgbox", args: ["LavaridgeTown_HerbShop_Text_YouveComeToLookAtHerbalMedicine", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_CHARCOAL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_CHARCOAL"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LavaridgeTown_HerbShop_EventScript_ExplainCharcoal": [
      { cmd: "msgbox", args: ["LavaridgeTown_HerbShop_Text_ExplainCharcoal", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LavaridgeTown_HerbShop_Text_WelcomeToHerbShop": "Welcome to the HERB SHOP, home of\\neffective and inexpensive medicine!",
    "LavaridgeTown_HerbShop_Text_YouveComeToLookAtHerbalMedicine": "You've come to look at herbal medicine\\nin LAVARIDGE?\\pThat's rather commendable.\\pI like you! Take this!",
    "LavaridgeTown_HerbShop_Text_ExplainCharcoal": "That CHARCOAL I gave you, it's used\\nfor making herbal medicine.\\pIt also does wonders when held by\\na POKéMON.\\pIt intensifies the power of FIRE-type\\nmoves.",
    "LavaridgeTown_HerbShop_Text_HerbalMedicineWorksButMonWillDislike": "Herbal medicine works impressively well.\\nBut your POKéMON will dislike you for it.\\lIt must be horribly bitter!",
  },
};

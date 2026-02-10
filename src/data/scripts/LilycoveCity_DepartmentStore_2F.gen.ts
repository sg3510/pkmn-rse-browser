// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LilycoveCity_DepartmentStore_2F_EventScript_Cook": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_2F_Text_LearnToUseItemsProperly", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_2F_EventScript_PokefanF": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_2F_Text_GoodGiftForHusband", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_2F_EventScript_Sailor": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_2F_Text_StockUpOnItems", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_2F_EventScript_ClerkLeft": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["LilycoveCity_DepartmentStore_2F_Pokemart1"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "LilycoveCity_DepartmentStore_2F_Pokemart1": [
      { cmd: ".2byte", args: ["ITEM_POKE_BALL"] },
      { cmd: ".2byte", args: ["ITEM_GREAT_BALL"] },
      { cmd: ".2byte", args: ["ITEM_ULTRA_BALL"] },
      { cmd: ".2byte", args: ["ITEM_ESCAPE_ROPE"] },
      { cmd: ".2byte", args: ["ITEM_FULL_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_ANTIDOTE"] },
      { cmd: ".2byte", args: ["ITEM_PARALYZE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_BURN_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_ICE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_AWAKENING"] },
      { cmd: ".2byte", args: ["ITEM_FLUFFY_TAIL"] },
      { cmd: "pokemartlistend" },
    ],
    "LilycoveCity_DepartmentStore_2F_EventScript_ClerkRight": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["LilycoveCity_DepartmentStore_2F_Pokemart2"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "LilycoveCity_DepartmentStore_2F_Pokemart2": [
      { cmd: ".2byte", args: ["ITEM_POTION"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_HYPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_MAX_POTION"] },
      { cmd: ".2byte", args: ["ITEM_REVIVE"] },
      { cmd: ".2byte", args: ["ITEM_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_MAX_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_WAVE_MAIL"] },
      { cmd: ".2byte", args: ["ITEM_MECH_MAIL"] },
      { cmd: "pokemartlistend" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_DepartmentStore_2F_Text_LearnToUseItemsProperly": "Learn to use items properly.\\nThat's basic, really.",
    "LilycoveCity_DepartmentStore_2F_Text_GoodGiftForHusband": "My husband is waiting at home.\\nWhat would make a good gift for him?",
    "LilycoveCity_DepartmentStore_2F_Text_StockUpOnItems": "I'm leaving on a long journey soon.\\nI need to stock up on items.",
  },
};

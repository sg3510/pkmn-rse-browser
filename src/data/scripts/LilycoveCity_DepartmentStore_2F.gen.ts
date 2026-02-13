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
    ],
    "LilycoveCity_DepartmentStore_2F_Pokemart1": [
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
    ],
    "LilycoveCity_DepartmentStore_2F_Pokemart2": [
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

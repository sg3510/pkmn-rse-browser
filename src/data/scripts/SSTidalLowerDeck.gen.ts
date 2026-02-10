// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SSTidalLowerDeck_EventScript_Phillip": [
      { cmd: "trainerbattle_single", args: ["TRAINER_PHILLIP", "SSTidalLowerDeck_Text_PhillipIntro", "SSTidalLowerDeck_Text_PhillipDefeat"] },
      { cmd: "msgbox", args: ["SSTidalLowerDeck_Text_PhillipPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "SSTidalLowerDeck_EventScript_Leonard": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LEONARD", "SSTidalLowerDeck_Text_LeonardIntro", "SSTidalLowerDeck_Text_LeonardDefeat"] },
      { cmd: "msgbox", args: ["SSTidalLowerDeck_Text_LeonardPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SSTidalLowerDeck_Text_PhillipIntro": "Arrrgh! I'm fed up and dog-tired of\\ncleaning this huge place!\\pLet's have a quick battle!",
    "SSTidalLowerDeck_Text_PhillipDefeat": "Little bro, I lost!",
    "SSTidalLowerDeck_Text_PhillipPostBattle": "We're the CLEANUP BROTHERS!\\pThe old one dumps the detergent,\\nand the young one does the scrubbing!",
    "SSTidalLowerDeck_Text_LeonardIntro": "This is the bottom of the ship's hull.\\nThere's plenty of room.\\lIt'll be alright for a POKéMON battle.",
    "SSTidalLowerDeck_Text_LeonardDefeat": "Big bro, I lost!",
    "SSTidalLowerDeck_Text_LeonardPostBattle": "We're the CLEANUP BROTHERS!\\pThe old one dumps the detergent,\\nand the young one does the scrubbing!",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MtPyre_4F_EventScript_Tasha": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TASHA", "MtPyre_4F_Text_TashaIntro", "MtPyre_4F_Text_TashaDefeat"] },
      { cmd: "msgbox", args: ["MtPyre_4F_Text_TashaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MtPyre_4F_Text_TashaIntro": "I love all things horrifying…\\nIt's like a disease…\\pWhen I'm here…\\nI shiver with fear…",
    "MtPyre_4F_Text_TashaDefeat": "Losing, I dislike…",
    "MtPyre_4F_Text_TashaPostBattle": "I want to see dreadful things…\\nI can't leave…\\pStay…\\nWon't you stay with me?",
  },
};

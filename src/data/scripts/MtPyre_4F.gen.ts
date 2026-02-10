// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MtPyre_5F_EventScript_Atsushi": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ATSUSHI", "MtPyre_5F_Text_AtsushiIntro", "MtPyre_5F_Text_AtsushiDefeat"] },
      { cmd: "msgbox", args: ["MtPyre_5F_Text_AtsushiPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MtPyre_5F_Text_AtsushiIntro": "Teacher…\\nPlease watch over my progress!",
    "MtPyre_5F_Text_AtsushiDefeat": "Teacher…\\nPlease forgive me!",
    "MtPyre_5F_Text_AtsushiPostBattle": "Until I improve, my teacher, who rests\\nhere, will never find true peace…",
  },
};

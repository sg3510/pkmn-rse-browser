// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "AbandonedShip_Corridors_1F_EventScript_Youngster": [
      { cmd: "msgbox", args: ["AbandonedShip_Corridors_1F_Text_IsntItFunHere", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "AbandonedShip_Corridors_1F_EventScript_Charlie": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CHARLIE", "AbandonedShip_Corridors_1F_Text_CharlieIntro", "AbandonedShip_Corridors_1F_Text_CharlieDefeat"] },
      { cmd: "msgbox", args: ["AbandonedShip_Corridors_1F_Text_CharliePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AbandonedShip_Corridors_1F_Text_CharlieIntro": "What's so funny about having my inner\\ntube aboard the ship?",
    "AbandonedShip_Corridors_1F_Text_CharlieDefeat": "Whoa, you overwhelmed me!",
    "AbandonedShip_Corridors_1F_Text_CharliePostBattle": "It's not easy throwing POKé BALLS\\nwhile hanging on to an inner tube!",
    "AbandonedShip_Corridors_1F_Text_IsntItFunHere": "Isn't it fun here?\\nI get excited just being here!",
  },
};

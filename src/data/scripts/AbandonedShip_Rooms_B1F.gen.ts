// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onResume: "AbandonedShip_Rooms_B1F_OnResume",
  },
  scripts: {
    "AbandonedShip_Rooms_B1F_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_ABANDONED_SHIP_UNDERWATER2", 17, 4] },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms_B1F_EventScript_FatMan": [
      { cmd: "msgbox", args: ["AbandonedShip_Rooms_B1F_Text_GettingQueasy", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AbandonedShip_Rooms_B1F_Text_GettingQueasy": "Urrrrppp…\\pI'm getting queasy just being aboard\\nthis ship…\\pIt's not even moving, but…",
  },
};

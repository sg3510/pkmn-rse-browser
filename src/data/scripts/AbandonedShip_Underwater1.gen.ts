// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onResume: "AbandonedShip_Underwater1_OnResume",
  },
  scripts: {
    "AbandonedShip_Underwater1_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS", 0, 10] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

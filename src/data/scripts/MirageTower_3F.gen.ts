// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "CaveHole_FixCrackedGround",
    onResume: "MirageTower_3F_SetHoleWarp",
  },
  scripts: {
    "MirageTower_3F_SetHoleWarp": [
      { cmd: "setstepcallback", args: ["STEP_CB_CRACKED_FLOOR"] },
      { cmd: "setholewarp", args: ["MAP_MIRAGE_TOWER_2F"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

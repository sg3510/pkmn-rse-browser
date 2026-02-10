// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "MirageTower_1F_OnTransition",
  },
  scripts: {
    "MirageTower_1F_OnTransition": [
      { cmd: "setflag", args: ["FLAG_ENTERED_MIRAGE_TOWER"] },
      { cmd: "setflag", args: ["FLAG_FORCE_MIRAGE_TOWER_VISIBLE"] },
      { cmd: "setflag", args: ["FLAG_LANDMARK_MIRAGE_TOWER"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

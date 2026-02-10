// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "AbandonedShip_Deck_OnTransition",
  },
  scripts: {
    "AbandonedShip_Deck_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_ABANDONED_SHIP"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

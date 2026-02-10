// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SkyPillar_Entrance_OnTransition",
  },
  scripts: {
    "SkyPillar_Entrance_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_SKY_PILLAR"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

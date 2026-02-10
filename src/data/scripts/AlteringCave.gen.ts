// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "AlteringCave_OnTransition",
  },
  scripts: {
    "AlteringCave_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_ALTERING_CAVE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

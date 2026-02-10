// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "ScorchedSlab_OnTransition",
  },
  scripts: {
    "ScorchedSlab_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_SCORCHED_SLAB"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "TerraCave_Entrance_OnTransition",
  },
  scripts: {
    "TerraCave_Entrance_OnTransition": [
      { cmd: "setflag", args: ["FLAG_ARRIVED_AT_TERRA_CAVE_ENTRANCE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

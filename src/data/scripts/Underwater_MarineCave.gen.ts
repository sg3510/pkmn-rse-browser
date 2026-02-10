// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Underwater_MarineCave_OnTransition",
    onResume: "Underwater_MarineCave_OnResume",
  },
  scripts: {
    "Underwater_MarineCave_OnTransition": [
      { cmd: "setflag", args: ["FLAG_ARRIVED_AT_MARINE_CAVE_EMERGE_SPOT"] },
      { cmd: "end" },
    ],
    "Underwater_MarineCave_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_MARINE_CAVE_ENTRANCE", 10, 17] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

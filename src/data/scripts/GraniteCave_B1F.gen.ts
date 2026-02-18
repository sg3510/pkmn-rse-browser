// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "CaveHole_FixCrackedGround",
    onResume: "GraniteCave_B1F_SetHoleWarp",
    onFrame: [
      { var: "VAR_ICE_STEP_COUNT", value: 0, script: "EventScript_FallDownHole" },
    ],
  },
  scripts: {
    "GraniteCave_B1F_SetHoleWarp": [
      { cmd: "setstepcallback", args: ["STEP_CB_CRACKED_FLOOR"] },
      { cmd: "setholewarp", args: ["MAP_GRANITE_CAVE_B2F"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

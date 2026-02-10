// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SkyPillar_4F_OnTransition",
    onResume: "SkyPillar_4F_SetHoleWarp",
  },
  scripts: {
    "SkyPillar_4F_OnTransition": [
      { cmd: "call_if_lt", args: ["VAR_SKY_PILLAR_STATE", 2, "SkyPillar_4F_EventScript_CleanFloor"] },
      { cmd: "setvar", args: ["VAR_ICE_STEP_COUNT", 1] },
      { cmd: "copyvar", args: ["VAR_ICE_STEP_COUNT", 1, "warn=FALSE"] },
      { cmd: "end" },
    ],
    "SkyPillar_4F_EventScript_CleanFloor": [
      { cmd: "setmaplayoutindex", args: ["LAYOUT_SKY_PILLAR_4F_CLEAN"] },
      { cmd: "return" },
    ],
    "SkyPillar_4F_SetHoleWarp": [
      { cmd: "setstepcallback", args: ["STEP_CB_CRACKED_FLOOR"] },
      { cmd: "setholewarp", args: ["MAP_SKY_PILLAR_3F"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

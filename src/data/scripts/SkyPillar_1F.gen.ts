// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SkyPillar_1F_OnTransition",
  },
  scripts: {
    "SkyPillar_1F_OnTransition": [
      { cmd: "call_if_lt", args: ["VAR_SKY_PILLAR_STATE", 2, "SkyPillar_1F_EventScript_CleanFloor"] },
      { cmd: "end" },
    ],
    "SkyPillar_1F_EventScript_CleanFloor": [
      { cmd: "setmaplayoutindex", args: ["LAYOUT_SKY_PILLAR_1F_CLEAN"] },
      { cmd: "return" },
    ],
  },
  movements: {
  },
  text: {
  },
};

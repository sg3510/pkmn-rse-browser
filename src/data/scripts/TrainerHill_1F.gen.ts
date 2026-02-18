// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onResume: "TrainerHill_OnResume",
    onFrame: [
      { var: "VAR_TEMP_2", value: 0, script: "TrainerHill_1F_EventScript_DummyWarpToEntranceCounter" },
      { var: "VAR_TEMP_1", value: 1, script: "TrainerHill_EventScript_WarpToEntranceCounter" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_3", value: 0, script: "TrainerHill_1F_EventScript_DummyOnWarp" },
    ],
  },
  scripts: {
  },
  movements: {
  },
  text: {
  },
};

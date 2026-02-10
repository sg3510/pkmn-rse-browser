// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onWarpInto: [
      { var: "VAR_TEMP_1", value: 0, script: "EverGrandeCity_Hall2_EventScript_TurnPlayerNorth" },
    ],
  },
  scripts: {
    "EverGrandeCity_Hall2_EventScript_TurnPlayerNorth": [
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

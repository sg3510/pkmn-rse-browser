// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "MtPyre_Exterior_OnTransition",
  },
  scripts: {
    "MtPyre_Exterior_OnTransition": [
      { cmd: "call", args: ["MtPyre_Exterior_EventScript_CheckEnterFromSummit"] },
      { cmd: "end" },
    ],
    "MtPyre_Exterior_EventScript_CheckEnterFromSummit": [
      { cmd: "getplayerxy", args: ["VAR_TEMP_0", "VAR_TEMP_1"] },
      { cmd: "goto_if_lt", args: ["VAR_TEMP_1", 12, "MtPyre_Exterior_EventScript_EnterFromSummit"] },
      { cmd: "return" },
    ],
    "MtPyre_Exterior_EventScript_EnterFromSummit": [
      { cmd: "setweather", args: ["WEATHER_FOG_HORIZONTAL"] },
      { cmd: "return" },
    ],
    "MtPyre_Exterior_EventScript_FogTrigger": [
      { cmd: "setweather", args: ["WEATHER_FOG_HORIZONTAL"] },
      { cmd: "doweather" },
      { cmd: "end" },
    ],
    "MtPyre_Exterior_EventScript_SunTrigger": [
      { cmd: "setweather", args: ["WEATHER_SUNNY"] },
      { cmd: "doweather" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

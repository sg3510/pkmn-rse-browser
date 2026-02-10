// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "FieryPath_OnTransition",
  },
  scripts: {
    "FieryPath_OnTransition": [
      { cmd: "call_if_unset", args: ["FLAG_LANDMARK_FIERY_PATH", "FieryPath_EventScript_MoveScottToFallarbor"] },
      { cmd: "setflag", args: ["FLAG_LANDMARK_FIERY_PATH"] },
      { cmd: "end" },
    ],
    "FieryPath_EventScript_MoveScottToFallarbor": [
      { cmd: "setflag", args: ["FLAG_HIDE_VERDANTURF_TOWN_SCOTT"] },
      { cmd: "clearflag", args: ["FLAG_HIDE_FALLARBOR_TOWN_BATTLE_TENT_SCOTT"] },
      { cmd: "return" },
    ],
  },
  movements: {
  },
  text: {
  },
};

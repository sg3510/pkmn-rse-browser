// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "CaveOfOrigin_1F_OnTransition",
  },
  scripts: {
    "CaveOfOrigin_1F_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_UNUSED_RS_LEGENDARY_BATTLE_DONE", "CaveOfOrigin_EventScript_DisableTriggers"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

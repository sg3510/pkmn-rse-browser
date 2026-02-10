// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "DesertUnderpass_OnTransition",
  },
  scripts: {
    "DesertUnderpass_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_DESERT_UNDERPASS"] },
      { cmd: "end" },
    ],
    "DesertUnderpass_EventScript_Fossil": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_CHOSE_ROOT_FOSSIL", "DesertUnderpass_EventScript_GiveClawFossil"] },
      { cmd: "goto_if_set", args: ["FLAG_CHOSE_CLAW_FOSSIL", "DesertUnderpass_EventScript_GiveRootFossil"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "DesertUnderpass_EventScript_GiveClawFossil": [
      { cmd: "giveitem", args: ["ITEM_CLAW_FOSSIL"] },
      { cmd: "removeobject", args: ["LOCALID_UNDERPASS_FOSSIL"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "DesertUnderpass_EventScript_GiveRootFossil": [
      { cmd: "giveitem", args: ["ITEM_ROOT_FOSSIL"] },
      { cmd: "removeobject", args: ["LOCALID_UNDERPASS_FOSSIL"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "DesertUnderpass_Text_FoundRootFossil": "{PLAYER} found the ROOT FOSSIL.",
    "DesertUnderpass_Text_FoundClawFossil": "{PLAYER} found the CLAW FOSSIL.",
  },
};

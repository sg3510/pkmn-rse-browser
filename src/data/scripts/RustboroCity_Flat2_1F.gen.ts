// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "RustboroCity_Flat2_1F_EventScript_OldWoman": [
      { cmd: "msgbox", args: ["RustboroCity_Flat2_1F_Text_DevonWorkersLiveHere", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_Flat2_1F_EventScript_Skitty": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_SKITTY", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["RustboroCity_Flat2_1F_Text_Skitty", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_Flat2_1F_Text_DevonWorkersLiveHere": "DEVON CORPORATION's workers live in\\nthis building.",
    "RustboroCity_Flat2_1F_Text_Skitty": "SKITTY: Gyaaaah!",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LavaridgeTown_House_EventScript_OldMan": [
      { cmd: "msgbox", args: ["LavaridgeTown_House_Text_WifeWarmingEggInHotSprings", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LavaridgeTown_House_EventScript_Zigzagoon": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_ZIGZAGOON", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["LavaridgeTown_House_Text_Zigzagoon", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LavaridgeTown_House_Text_WifeWarmingEggInHotSprings": "My wife's warming an EGG in the hot\\nsprings. This is what she told me.\\pShe left two POKéMON with the DAY CARE.\\nAnd they discovered that EGG!",
    "LavaridgeTown_House_Text_Zigzagoon": "ZIGZAGOON: Pshoo!",
  },
};

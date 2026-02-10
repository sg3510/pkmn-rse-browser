// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FortreeCity_House5_EventScript_PokefanF": [
      { cmd: "msgbox", args: ["FortreeCity_House5_Text_TreeHousesAreGreat", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_House5_EventScript_Man": [
      { cmd: "msgbox", args: ["FortreeCity_House5_Text_AdaptedToNature", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_House5_EventScript_Zigzagoon": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_ZIGZAGOON", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["FortreeCity_House5_Text_Zigzagoon", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FortreeCity_House5_Text_TreeHousesAreGreat": "The tree houses of FORTREE are great!\\pI think it's the number one town for\\nliving together with POKéMON.",
    "FortreeCity_House5_Text_AdaptedToNature": "POKéMON and people have adapted to\\nnature for survival.\\pThere's no need to make nature\\nconform to the way we want to live.",
    "FortreeCity_House5_Text_Zigzagoon": "ZIGZAGOON: Bufuu!",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LilycoveCity_House1_EventScript_ExpertM": [
      { cmd: "msgbox", args: ["LilycoveCity_House1_Text_PokemonPartnersNotTools", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_House1_EventScript_Kecleon": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_KECLEON", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["LilycoveCity_House1_Text_Kecleon", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_House1_Text_PokemonPartnersNotTools": "POKéMON are partners to people.\\nThey aren't our tools.\\pUnfortunately, there are some people\\nwho fail to understand that…",
    "LilycoveCity_House1_Text_Kecleon": "KECLEON: Ruroro?",
  },
};

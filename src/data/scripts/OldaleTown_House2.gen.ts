// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "OldaleTown_House2_EventScript_Woman": [
      { cmd: "msgbox", args: ["OldaleTown_House2_Text_PokemonLevelUp", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "OldaleTown_House2_EventScript_Man": [
      { cmd: "msgbox", args: ["OldaleTown_House2_Text_YoullGoFurtherWithStrongPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "OldaleTown_House2_Text_PokemonLevelUp": "When POKéMON battle, they eventually\\nlevel up and become stronger.",
    "OldaleTown_House2_Text_YoullGoFurtherWithStrongPokemon": "If the POKéMON with you become\\nstronger, you'll be able to go farther\\laway from here.",
  },
};

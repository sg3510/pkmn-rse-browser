// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SootopolisCity_House4_EventScript_Man": [
      { cmd: "msgbox", args: ["SootopolisCity_House4_Text_AncientTreasuresWaitingInSea", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SootopolisCity_House4_EventScript_Woman": [
      { cmd: "msgbox", args: ["SootopolisCity_House4_Text_StrollUnderwaterWithPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SootopolisCity_House4_EventScript_Azumarill": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_AZUMARILL", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["SootopolisCity_House4_Text_Azumarill", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SootopolisCity_House4_Text_AncientTreasuresWaitingInSea": "Listen up, and I'll tell you something\\ngood.\\pThere's supposed to be an ancient\\nruin in the sea around here.\\pThere could be treasures just waiting\\nto be discovered down there.",
    "SootopolisCity_House4_Text_StrollUnderwaterWithPokemon": "Ancient treasures…\\pIt would be nice if they existed, but\\neven if they didn't, it would be so\\lbeautiful to take an underwater\\lstroll with my POKéMON.",
    "SootopolisCity_House4_Text_Azumarill": "AZUMARILL: Marurii.",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route119_House_EventScript_Woman": [
      { cmd: "msgbox", args: ["Route119_House_Text_RumorAboutCaveOfOrigin", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route119_House_EventScript_Wingull": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_WINGULL", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["Route119_House_Text_Wingull", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route119_House_Text_RumorAboutCaveOfOrigin": "I heard about a cave called the CAVE\\nOF ORIGIN.\\pPeople rumor that the spirits of\\nPOKéMON are revived there. Could\\lsomething like that really happen?",
    "Route119_House_Text_Wingull": "WINGULL: Pihyoh!",
  },
};

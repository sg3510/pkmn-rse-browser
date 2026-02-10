// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "DewfordTown_House1_EventScript_Man": [
      { cmd: "msgbox", args: ["DewfordTown_House1_Text_LotToBeSaidForLivingOnIsland", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "DewfordTown_House1_EventScript_Woman": [
      { cmd: "msgbox", args: ["DewfordTown_House1_Text_LifeGoesSlowlyOnIsland", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "DewfordTown_House1_EventScript_Zigzagoon": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_ZIGZAGOON", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["DewfordTown_House1_Text_Zigzagoon", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "DewfordTown_House1_Text_LotToBeSaidForLivingOnIsland": "There's a lot to be said for living on\\na small island like this in harmony with\\lPOKéMON and the family.",
    "DewfordTown_House1_Text_LifeGoesSlowlyOnIsland": "I left the major port of SLATEPORT\\nCITY when I married my husband here.\\pLife goes by slowly on this little\\nisland. But being surrounded by the\\lbeautiful sea--that's happiness, too.",
    "DewfordTown_House1_Text_Zigzagoon": "ZIGZAGOON: Guguuh!",
  },
};

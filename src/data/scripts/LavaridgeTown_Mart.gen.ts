// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LavaridgeTown_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["LavaridgeTown_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LavaridgeTown_Mart_Pokemart": [
      { cmd: "pokemartlistend" },
    ],
    "LavaridgeTown_Mart_EventScript_ExpertM": [
      { cmd: "msgbox", args: ["LavaridgeTown_Mart_Text_XSpeedFirstStrike", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LavaridgeTown_Mart_EventScript_OldWoman": [
      { cmd: "msgbox", args: ["LavaridgeTown_Mart_Text_LocalSpecialtyOnMtChimney", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LavaridgeTown_Mart_Text_XSpeedFirstStrike": "Use X SPEED to add to a POKéMON's\\nSPEED in battle.\\pThat will help it get in the first\\nstrike--a decided advantage!",
    "LavaridgeTown_Mart_Text_LocalSpecialtyOnMtChimney": "On MT. CHIMNEY's peak, there's a local\\nspecialty that you can buy only there.\\pGive it to a POKéMON--it will be elated.",
  },
};

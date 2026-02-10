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
      { cmd: ".align", args: [2] },
    ],
    "LavaridgeTown_Mart_Pokemart": [
      { cmd: ".2byte", args: ["ITEM_GREAT_BALL"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_ANTIDOTE"] },
      { cmd: ".2byte", args: ["ITEM_PARALYZE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_AWAKENING"] },
      { cmd: ".2byte", args: ["ITEM_BURN_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_REVIVE"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_X_SPEED"] },
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

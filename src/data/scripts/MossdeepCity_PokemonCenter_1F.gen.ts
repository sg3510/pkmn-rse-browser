// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "MossdeepCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "MossdeepCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_MOSSDEEP_CITY"] },
      { cmd: "end" },
    ],
    "MossdeepCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_MOSSDEEP_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_PokemonCenter_1F_EventScript_Woman": [
      { cmd: "msgbox", args: ["MossdeepCity_PokemonCenter_1F_Text_GymLeaderDuoFormidable", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MossdeepCity_PokemonCenter_1F_EventScript_Girl": [
      { cmd: "msgbox", args: ["MossdeepCity_PokemonCenter_1F_Text_AbilitiesMightChangeMoves", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MossdeepCity_PokemonCenter_1F_Text_GymLeaderDuoFormidable": "The GYM LEADERS in this town are\\na formidable duo.\\pTheir combination attacks are, like,\\nexcellent and wow!",
    "MossdeepCity_PokemonCenter_1F_Text_AbilitiesMightChangeMoves": "Depending on the special abilities of\\nPOKéMON, some moves might change\\lor not work at all.",
  },
};

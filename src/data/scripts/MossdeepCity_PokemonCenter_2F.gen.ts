// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "CableClub_OnLoad",
    onTransition: "CableClub_OnTransition",
  },
  scripts: {
    "MossdeepCity_PokemonCenter_2F_EventScript_Colosseum": [
      { cmd: "call", args: ["CableClub_EventScript_Colosseum"] },
      { cmd: "end" },
    ],
    "MossdeepCity_PokemonCenter_2F_EventScript_TradeCenter": [
      { cmd: "call", args: ["CableClub_EventScript_TradeCenter"] },
      { cmd: "end" },
    ],
    "MossdeepCity_PokemonCenter_2F_EventScript_RecordCorner": [
      { cmd: "call", args: ["CableClub_EventScript_RecordCorner"] },
      { cmd: "end" },
    ],
    "MossdeepCity_PokemonCenter_2F_EventScript_Woman5": [
      { cmd: "msgbox", args: ["MossdeepCity_PokemonCenter_2F_Text_Woman5", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MossdeepCity_PokemonCenter_2F_Text_Woman5": "If I win a whole lot of link battles\\nand show everyone how good I am,\\lI might get a fan following!",
  },
};

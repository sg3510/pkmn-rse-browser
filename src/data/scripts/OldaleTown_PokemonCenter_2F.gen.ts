// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "CableClub_OnLoad",
    onTransition: "CableClub_OnTransition",
  },
  scripts: {
    "OldaleTown_PokemonCenter_2F_EventScript_Colosseum": [
      { cmd: "call", args: ["CableClub_EventScript_Colosseum"] },
      { cmd: "end" },
    ],
    "OldaleTown_PokemonCenter_2F_EventScript_TradeCenter": [
      { cmd: "call", args: ["CableClub_EventScript_TradeCenter"] },
      { cmd: "end" },
    ],
    "OldaleTown_PokemonCenter_2F_EventScript_RecordCorner": [
      { cmd: "call", args: ["CableClub_EventScript_RecordCorner"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

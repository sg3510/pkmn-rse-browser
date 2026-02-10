// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "CableClub_OnLoad",
    onTransition: "CableClub_OnTransition",
  },
  scripts: {
    "MauvilleCity_PokemonCenter_2F_EventScript_Colosseum": [
      { cmd: "call", args: ["CableClub_EventScript_Colosseum"] },
      { cmd: "end" },
    ],
    "MauvilleCity_PokemonCenter_2F_EventScript_TradeCenter": [
      { cmd: "call", args: ["CableClub_EventScript_TradeCenter"] },
      { cmd: "end" },
    ],
    "MauvilleCity_PokemonCenter_2F_EventScript_RecordCorner": [
      { cmd: "call", args: ["CableClub_EventScript_RecordCorner"] },
      { cmd: "end" },
    ],
    "MauvilleCity_PokemonCenter_2F_EventScript_Youngster": [
      { cmd: "msgbox", args: ["MauvilleCity_PokemonCenter_2F_Text_Youngster", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MauvilleCity_PokemonCenter_2F_Text_Youngster": "Did you know that you can link battle\\nat the COLOSSEUM here?\\pThey put up your record on the wall\\nfor everyone to see.\\pIt's embarrassing if you lose more\\noften than you win…",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "VerdanturfTown_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "VerdanturfTown_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_VERDANTURF_TOWN"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_VERDANTURF_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_PokemonCenter_1F_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["VerdanturfTown_PokemonCenter_1F_Text_FaithInYourPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_PokemonCenter_1F_EventScript_ExpertM": [
      { cmd: "msgbox", args: ["VerdanturfTown_PokemonCenter_1F_Text_VisitForBattleTent", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "VerdanturfTown_PokemonCenter_1F_Text_FaithInYourPokemon": "You can't consider yourself a real\\nTRAINER if you don't have faith\\lin your POKéMON.\\pOnly those people who can believe\\nin their battling POKéMON can win\\lthrough to the very end.",
    "VerdanturfTown_PokemonCenter_1F_Text_VisitForBattleTent": "The reason why anyone would visit\\nVERDANTURF…\\pIt's the BATTLE TENT. It goes without\\nsaying.\\pOr is there somebody here that you\\ncame to see?",
  },
};

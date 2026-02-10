// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "RustboroCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "RustboroCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_RUSTBORO_CITY"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "end" },
    ],
    "RustboroCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_RUSTBORO_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_PokemonCenter_1F_EventScript_Man": [
      { cmd: "msgbox", args: ["RustboroCity_PokemonCenter_1F_Text_PokemonHavePersonalities", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_PokemonCenter_1F_EventScript_Boy": [
      { cmd: "msgbox", args: ["RustboroCity_PokemonCenter_1F_Text_MaleAndFemalePokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_PokemonCenter_1F_EventScript_Girl": [
      { cmd: "msgbox", args: ["RustboroCity_PokemonCenter_1F_Text_HMCutNextDoor", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_PokemonCenter_1F_Text_PokemonHavePersonalities": "My POKéMON has a NAIVE nature, and my\\nfriend's has a JOLLY nature.\\pIt's fascinating how POKéMON have\\npersonalities!",
    "RustboroCity_PokemonCenter_1F_Text_MaleAndFemalePokemon": "Just like people, there are male and\\nfemale POKéMON.\\pBut no one seems to have any idea how\\nthey're different.",
    "RustboroCity_PokemonCenter_1F_Text_HMCutNextDoor": "The man next door gave me an HM!\\pI used it to teach my POKéMON how to\\nCUT down skinny trees.",
  },
};

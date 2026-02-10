// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "DewfordTown_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "DewfordTown_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_DEWFORD_TOWN"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "end" },
    ],
    "DewfordTown_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_DEWFORD_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "DewfordTown_PokemonCenter_1F_EventScript_PokefanF": [
      { cmd: "msgbox", args: ["DewfordTown_PokemonCenter_1F_Text_StoneCavern", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "DewfordTown_PokemonCenter_1F_EventScript_Man": [
      { cmd: "msgbox", args: ["DewfordTown_PokemonCenter_1F_Text_FaintedMonCanUseHM", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "DewfordTown_PokemonCenter_1F_Text_StoneCavern": "There's a stone cavern at the edge\\nof town.\\pI've heard you can find rare stones\\nthere.",
    "DewfordTown_PokemonCenter_1F_Text_FaintedMonCanUseHM": "Even if a POKéMON faints and can't\\nbattle, it can still use a move learned\\lfrom a HIDDEN MACHINE (HM).",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "PacifidlogTown_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "PacifidlogTown_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_PACIFIDLOG_TOWN"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_PACIFIDLOG_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PacifidlogTown_PokemonCenter_1F_EventScript_Girl": [
      { cmd: "msgbox", args: ["PacifidlogTown_PokemonCenter_1F_Text_WhatColorTrainerCard", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_PokemonCenter_1F_EventScript_Woman": [
      { cmd: "msgbox", args: ["PacifidlogTown_PokemonCenter_1F_Text_OnColonyOfCorsola", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_PokemonCenter_1F_EventScript_OldMan": [
      { cmd: "msgbox", args: ["PacifidlogTown_PokemonCenter_1F_Text_AncestorsLivedOnBoats", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "PacifidlogTown_PokemonCenter_1F_Text_WhatColorTrainerCard": "What color is your TRAINER CARD?\\nMine's copper!",
    "PacifidlogTown_PokemonCenter_1F_Text_OnColonyOfCorsola": "PACIFIDLOG TOWN floats on top of\\na colony of CORSOLA.\\pIf I told you that, would you believe\\nme?",
    "PacifidlogTown_PokemonCenter_1F_Text_AncestorsLivedOnBoats": "The ancestors of the people in\\nPACIFIDLOG were said to have been\\lborn on boats and then lived and died \\laboard them.\\pI understand that they lived that way\\nbecause they were searching for\\lsomething.",
  },
};

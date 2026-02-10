// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "BattleFrontier_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "BattleFrontier_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_BATTLE_FRONTIER_OUTSIDE_EAST"] },
      { cmd: "end" },
    ],
    "BattleFrontier_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_FRONTIER_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_PokemonCenter_1F_EventScript_SchoolKid": [
      { cmd: "msgbox", args: ["BattleFrontier_PokemonCenter_1F_Text_NeverSeenPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "BattleFrontier_PokemonCenter_1F_EventScript_Man": [
      { cmd: "msgbox", args: ["BattleFrontier_PokemonCenter_1F_Text_NextStopBattleArena", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "BattleFrontier_PokemonCenter_1F_EventScript_Picnicker": [
      { cmd: "msgbox", args: ["BattleFrontier_PokemonCenter_1F_Text_GoingThroughEveryChallenge", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "BattleFrontier_PokemonCenter_1F_EventScript_Skitty": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_SKITTY", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["BattleFrontier_PokemonCenter_1F_Text_Skitty", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "BattleFrontier_PokemonCenter_1F_Text_NeverSeenPokemon": "There was someone here using a \\nPOKéMON I've never seen before.\\pI never learned about it at\\nTRAINER'S SCHOOL at least.\\pI wonder where you can catch POKéMON\\nlike that.",
    "BattleFrontier_PokemonCenter_1F_Text_NextStopBattleArena": "Okay! Next stop, the BATTLE ARENA!\\nI'd better get the right POKéMON from\\lthe PC Storage System.",
    "BattleFrontier_PokemonCenter_1F_Text_GoingThroughEveryChallenge": "Giggle… I'm going to go through every\\nchallenge with just this baby!",
    "BattleFrontier_PokemonCenter_1F_Text_Skitty": "SKITTY: Mya myaaah!",
  },
};

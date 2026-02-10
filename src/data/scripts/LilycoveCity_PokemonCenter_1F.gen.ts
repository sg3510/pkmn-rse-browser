// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "LilycoveCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "LilycoveCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_LILYCOVE_CITY"] },
      { cmd: "goto", args: ["LilycoveCity_PokemonCenter_1F_EventScript_SetLilycoveLadyGfx"] },
      { cmd: "end" },
    ],
    "LilycoveCity_PokemonCenter_1F_EventScript_SetLilycoveLadyGfx": [
      { cmd: "special", args: ["SetLilycoveLadyGfx"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "LilycoveCity_PokemonCenter_1F_EventScript_HideContestLadyMon"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "LilycoveCity_PokemonCenter_1F_EventScript_ShowContestLadyMon"] },
      { cmd: "end" },
    ],
    "LilycoveCity_PokemonCenter_1F_EventScript_HideContestLadyMon": [
      { cmd: "setflag", args: ["FLAG_HIDE_LILYCOVE_POKEMON_CENTER_CONTEST_LADY_MON"] },
      { cmd: "end" },
    ],
    "LilycoveCity_PokemonCenter_1F_EventScript_ShowContestLadyMon": [
      { cmd: "clearflag", args: ["FLAG_HIDE_LILYCOVE_POKEMON_CENTER_CONTEST_LADY_MON"] },
      { cmd: "end" },
    ],
    "LilycoveCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_LILYCOVE_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_PokemonCenter_1F_EventScript_Boy": [
      { cmd: "msgbox", args: ["LilycoveCity_PokemonCenter_1F_Text_HowManyKindsOfPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_PokemonCenter_1F_EventScript_Maniac": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_BADGE07_GET", "LilycoveCity_PokemonCenter_1F_EventScript_ManiacBadTeamGone"] },
      { cmd: "msgbox", args: ["LilycoveCity_PokemonCenter_1F_Text_HeardAboutRottenScoundrels", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_PokemonCenter_1F_EventScript_ManiacBadTeamGone": [
      { cmd: "msgbox", args: ["LilycoveCity_PokemonCenter_1F_Text_HaventSeenRottenScoundrels", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_PokemonCenter_1F_Text_HowManyKindsOfPokemon": "I wonder how many kinds of POKéMON\\nthere are in the world.\\pIt'd be great to cross seas and\\ntrade POKéMON with people far away.",
    "LilycoveCity_PokemonCenter_1F_Text_HeardAboutRottenScoundrels": "I've been hearing about some rotten\\nscoundrels who steal POKéMON and rip\\loff METEORITES.",
    "LilycoveCity_PokemonCenter_1F_Text_HaventSeenRottenScoundrels": "Those rotten scoundrels who steal\\nPOKéMON and rip off METEORITES…\\pI haven't seen them around recently.",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "EverGrandeCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "EverGrandeCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_EVER_GRANDE_CITY"] },
      { cmd: "call_if_unset", args: ["FLAG_MET_SCOTT_IN_EVERGRANDE", "EverGrandeCity_PokemonCenter_1F_EventScript_TryShowScott"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_PokemonCenter_1F_EventScript_TryShowScott": [
      { cmd: "goto_if_unset", args: ["FLAG_BADGE06_GET", "Common_EventScript_NopReturn"] },
      { cmd: "clearflag", args: ["FLAG_HIDE_EVER_GRANDE_POKEMON_CENTER_1F_SCOTT"] },
      { cmd: "return" },
    ],
    "EverGrandeCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_EVER_GRANDE_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "EverGrandeCity_PokemonCenter_1F_EventScript_Woman": [
      { cmd: "msgbox", args: ["EverGrandeCity_PokemonCenter_1F_Text_LeagueAfterVictoryRoad", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_PokemonCenter_1F_EventScript_ExpertM": [
      { cmd: "msgbox", args: ["EverGrandeCity_PokemonCenter_1F_Text_BelieveInYourPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_PokemonCenter_1F_EventScript_Scott": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["EverGrandeCity_PokemonCenter_1F_Text_ScottHappyForYou", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_NORTH", "EverGrandeCity_PokemonCenter_1F_EventScript_ScottExitNorth"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_EAST", "EverGrandeCity_PokemonCenter_1F_EventScript_ScottExit"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_WEST", "EverGrandeCity_PokemonCenter_1F_EventScript_ScottExit"] },
      { cmd: "addvar", args: ["VAR_SCOTT_STATE", 1] },
      { cmd: "setflag", args: ["FLAG_MET_SCOTT_IN_EVERGRANDE"] },
      { cmd: "playse", args: ["SE_EXIT"] },
      { cmd: "waitse" },
      { cmd: "removeobject", args: ["LOCALID_EVER_GRANDE_SCOTT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "EverGrandeCity_PokemonCenter_1F_EventScript_ScottExitNorth": [
      { cmd: "applymovement", args: ["LOCALID_EVER_GRANDE_SCOTT", "EverGrandeCity_PokemonCenter_1F_Movement_ScottExitNorth"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "EverGrandeCity_PokemonCenter_1F_EventScript_ScottExit": [
      { cmd: "applymovement", args: ["LOCALID_EVER_GRANDE_SCOTT", "EverGrandeCity_PokemonCenter_1F_Movement_ScottExit"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
  },
  movements: {
    "EverGrandeCity_PokemonCenter_1F_Movement_ScottExitNorth": ["walk_left", "walk_down", "walk_down", "walk_left", "walk_down", "walk_down"],
    "EverGrandeCity_PokemonCenter_1F_Movement_ScottExit": ["walk_down", "walk_down", "walk_left", "walk_left", "walk_down", "walk_down"],
  },
  text: {
    "EverGrandeCity_PokemonCenter_1F_Text_LeagueAfterVictoryRoad": "The POKéMON LEAGUE is only a short\\ndistance after the VICTORY ROAD.\\pIf you've come this far, what choice\\ndo you have but to keep going?",
    "EverGrandeCity_PokemonCenter_1F_Text_BelieveInYourPokemon": "The long and harrowing VICTORY ROAD…\\pIt's like reliving the path one has\\ntraveled in life…\\pBelieve in your POKéMON and give it\\nyour very best!",
    "EverGrandeCity_PokemonCenter_1F_Text_ScottHappyForYou": "SCOTT: {PLAYER}{KUN}, you've clawed your\\nway up to face the POKéMON LEAGUE!\\pI'm happy for you!\\nYou made my cheering worthwhile!\\p{PLAYER}{KUN}, if you were to become\\nthe POKéMON LEAGUE CHAMPION…\\pI'll get in touch with you then.\\pOkay, {PLAYER}{KUN}.\\nGo for greatness!",
  },
};

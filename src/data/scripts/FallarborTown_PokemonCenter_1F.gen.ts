// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "FallarborTown_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "FallarborTown_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_FALLARBOR_TOWN"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "end" },
    ],
    "FallarborTown_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_FALLARBOR_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_PokemonCenter_1F_EventScript_Girl": [
      { cmd: "msgbox", args: ["FallarborTown_PokemonCenter_1F_Text_FossilManiacEdgeOfTown", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FallarborTown_PokemonCenter_1F_EventScript_ExpertM": [
      { cmd: "msgbox", args: ["FallarborTown_PokemonCenter_1F_Text_PlantHardyTrees", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FallarborTown_PokemonCenter_1F_EventScript_Lanette": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["FallarborTown_PokemonCenter_1F_Text_LanetteGreeting", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "switch", args: ["VAR_FACING"] },
      { cmd: "case", args: ["DIR_NORTH", "FallarborTown_PokemonCenter_1F_EventScript_LanetteExitNorth"] },
      { cmd: "case", args: ["DIR_WEST", "FallarborTown_PokemonCenter_1F_EventScript_LanetteExitWest"] },
      { cmd: "end" },
    ],
    "FallarborTown_PokemonCenter_1F_EventScript_LanetteExitNorth": [
      { cmd: "applymovement", args: ["LOCALID_FALLARBOR_LANETTE", "FallarborTown_PokemonCenter_1F_Movement_LanetteExitNorth"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "goto", args: ["FallarborTown_PokemonCenter_1F_EventScript_LanetteExited"] },
      { cmd: "end" },
    ],
    "FallarborTown_PokemonCenter_1F_EventScript_LanetteExitWest": [
      { cmd: "applymovement", args: ["LOCALID_FALLARBOR_LANETTE", "FallarborTown_PokemonCenter_1F_Movement_LanetteExitWest"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "goto", args: ["FallarborTown_PokemonCenter_1F_EventScript_LanetteExited"] },
      { cmd: "end" },
    ],
    "FallarborTown_PokemonCenter_1F_EventScript_LanetteExited": [
      { cmd: "playse", args: ["SE_SLIDING_DOOR"] },
      { cmd: "removeobject", args: ["LOCALID_FALLARBOR_LANETTE"] },
      { cmd: "clearflag", args: ["FLAG_HIDE_LANETTES_HOUSE_LANETTE"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
    "FallarborTown_PokemonCenter_1F_Movement_LanetteExitNorth": ["walk_right", "walk_down", "walk_down", "walk_left", "walk_left", "walk_left", "walk_left", "walk_down", "walk_down", "walk_down", "walk_down", "delay_8"],
    "FallarborTown_PokemonCenter_1F_Movement_LanetteExitWest": ["walk_down", "walk_down", "walk_left", "walk_left", "walk_left", "walk_down", "walk_down", "walk_down", "walk_down", "delay_8"],
  },
  text: {
    "FallarborTown_PokemonCenter_1F_Text_LanetteGreeting": "Oh, hello.\\nYou are?\\pOkay, your name's {PLAYER}{KUN}.\\nI can see that you're a TRAINER.\\pSo that means you use the POKéMON\\nStorage System I developed.\\pHow I arrived at that conclusion is\\na simple deductive process.\\pYou spoke to me because you wanted\\nto access something on this PC.\\pOh, I'm sorry. I'm LANETTE.\\pHonestly, I'm glad to meet you--it's\\ngreat you're using the Storage System.\\pIf you could, please visit me at home.\\nMy house is on ROUTE 114.",
    "FallarborTown_PokemonCenter_1F_Text_FossilManiacEdgeOfTown": "I wonder what POKéMON looked like\\nlong, long ago?\\pMaybe the FOSSIL MANIAC at the edge\\nof town will know.",
    "FallarborTown_PokemonCenter_1F_Text_PlantHardyTrees": "In the fields of FALLARBOR, we plant\\nseedlings of hardy trees that thrive\\leven in volcanic ash.",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "CableClub_OnLoad",
    onTransition: "CableClub_OnTransition",
    onFrame: [
      { var: "VAR_CABLE_CLUB_TUTORIAL_STATE", value: 1, script: "CableClub_EventScript_Tutorial" },
      { var: "VAR_CABLE_CLUB_STATE", value: 1, script: "CableClub_EventScript_ExitLinkRoom" },
      { var: "VAR_CABLE_CLUB_STATE", value: 2, script: "CableClub_EventScript_ExitLinkRoom" },
      { var: "VAR_CABLE_CLUB_STATE", value: 5, script: "CableClub_EventScript_ExitLinkRoom" },
      { var: "VAR_CABLE_CLUB_STATE", value: 3, script: "CableClub_EventScript_ExitTradeCenter" },
      { var: "VAR_CABLE_CLUB_STATE", value: 4, script: "CableClub_EventScript_ExitRecordCorner" },
      { var: "VAR_CABLE_CLUB_STATE", value: 6, script: "CableClub_EventScript_ExitUnionRoom" },
      { var: "VAR_CABLE_CLUB_STATE", value: 7, script: "CableClub_EventScript_ExitLinkRoom" },
      { var: "VAR_CABLE_CLUB_STATE", value: 8, script: "CableClub_EventScript_ExitMinigameRoom" },
    ],
    onWarpInto: [
      { var: "VAR_CABLE_CLUB_STATE", value: 1, script: "CableClub_EventScript_CheckTurnAttendant" },
      { var: "VAR_CABLE_CLUB_STATE", value: 2, script: "CableClub_EventScript_CheckTurnAttendant" },
      { var: "VAR_CABLE_CLUB_STATE", value: 5, script: "CableClub_EventScript_CheckTurnAttendant" },
      { var: "VAR_CABLE_CLUB_STATE", value: 3, script: "CableClub_EventScript_CheckTurnAttendant" },
      { var: "VAR_CABLE_CLUB_STATE", value: 4, script: "CableClub_EventScript_CheckTurnAttendant" },
      { var: "VAR_CABLE_CLUB_STATE", value: 6, script: "CableClub_EventScript_CheckTurnAttendant" },
      { var: "VAR_CABLE_CLUB_STATE", value: 7, script: "CableClub_EventScript_CheckTurnAttendant" },
      { var: "VAR_CABLE_CLUB_STATE", value: 8, script: "CableClub_EventScript_CheckTurnAttendant" },
    ],
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

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Underwater_SeafloorCavern_OnLoad",
    onTransition: "Underwater_SeafloorCavern_OnTransition",
    onResume: "Underwater_SeafloorCavern_OnResume",
  },
  scripts: {
    "Underwater_SeafloorCavern_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_SEAFLOOR_CAVERN"] },
      { cmd: "goto_if_set", args: ["FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN", "Underwater_SeafloorCavern_EventScript_HideSubmarine"] },
      { cmd: "end" },
    ],
    "Underwater_SeafloorCavern_EventScript_HideSubmarine": [
      { cmd: "setflag", args: ["FLAG_HIDE_UNDERWATER_SEA_FLOOR_CAVERN_STOLEN_SUBMARINE"] },
      { cmd: "end" },
    ],
    "Underwater_SeafloorCavern_OnLoad": [
      { cmd: "call_if_set", args: ["FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN", "Underwater_SeafloorCavern_EventScript_SetSubmarineGoneMetatiles"] },
      { cmd: "end" },
    ],
    "Underwater_SeafloorCavern_EventScript_SetSubmarineGoneMetatiles": [
      { cmd: "setmetatile", args: [5, 3, "METATILE_Underwater_RockWall", "TRUE"] },
      { cmd: "setmetatile", args: [6, 3, "METATILE_Underwater_RockWall", "TRUE"] },
      { cmd: "setmetatile", args: [7, 3, "METATILE_Underwater_RockWall", "TRUE"] },
      { cmd: "setmetatile", args: [8, 3, "METATILE_Underwater_RockWall", "TRUE"] },
      { cmd: "setmetatile", args: [5, 4, "METATILE_Underwater_FloorShadow", "FALSE"] },
      { cmd: "setmetatile", args: [6, 4, "METATILE_Underwater_FloorShadow", "FALSE"] },
      { cmd: "setmetatile", args: [7, 4, "METATILE_Underwater_FloorShadow", "FALSE"] },
      { cmd: "setmetatile", args: [8, 4, "METATILE_Underwater_FloorShadow", "FALSE"] },
      { cmd: "setmetatile", args: [5, 5, "METATILE_Underwater_FloorShadow", "FALSE"] },
      { cmd: "setmetatile", args: [6, 5, "METATILE_Underwater_FloorShadow", "FALSE"] },
      { cmd: "setmetatile", args: [7, 5, "METATILE_Underwater_FloorShadow", "FALSE"] },
      { cmd: "setmetatile", args: [8, 5, "METATILE_Underwater_FloorShadow", "FALSE"] },
      { cmd: "return" },
    ],
    "Underwater_SeafloorCavern_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_SEAFLOOR_CAVERN_ENTRANCE", 10, 17] },
      { cmd: "end" },
    ],
    "Underwater_SeafloorCavern_EventScript_CheckStolenSub": [
      { cmd: "msgbox", args: ["Underwater_SeafloorCavern_Text_SubExplorer1", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Underwater_SeafloorCavern_Text_SubExplorer1": "“SUBMARINE EXPLORER 1” is painted\\non the hull.\\pThis is the submarine TEAM AQUA\\nstole in SLATEPORT!\\pTEAM AQUA must have gone\\nashore here.",
  },
};

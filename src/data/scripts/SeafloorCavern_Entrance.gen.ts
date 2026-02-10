// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onResume: "SeafloorCavern_Entrance_OnResume",
  },
  scripts: {
    "SeafloorCavern_Entrance_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_UNDERWATER_SEAFLOOR_CAVERN", 6, 5] },
      { cmd: "setescapewarp", args: ["MAP_UNDERWATER_SEAFLOOR_CAVERN", 6, 5] },
      { cmd: "end" },
    ],
    "SeafloorCavern_Entrance_EventScript_Grunt": [
      { cmd: "lockall" },
      { cmd: "goto_if_eq", args: ["VAR_HAS_TALKED_TO_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", 1, "SeafloorCavern_Entrance_EventScript_GruntSpeechShort"] },
      { cmd: "waitse" },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "applymovement", args: ["LOCALID_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", "Common_Movement_ExclamationMark"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", "Common_Movement_Delay48"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [20] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_WEST", "SeafloorCavern_Entrance_EventScript_GruntFacePlayerWest"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_EAST", "SeafloorCavern_Entrance_EventScript_GruntFacePlayerEast"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_NORTH", "SeafloorCavern_Entrance_EventScript_GruntFacePlayerNorth"] },
      { cmd: "delay", args: [30] },
      { cmd: "setvar", args: ["VAR_HAS_TALKED_TO_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", 1] },
      { cmd: "copyobjectxytoperm", args: ["LOCALID_SEAFLOOR_CAVERN_ENTRANCE_GRUNT"] },
      { cmd: "msgbox", args: ["SeafloorCavern_Entrance_Text_HearMagmaNearMossdeep", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SeafloorCavern_Entrance_EventScript_GruntSpeechShort": [
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_WEST", "SeafloorCavern_Entrance_EventScript_GruntFacePlayerWest"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_EAST", "SeafloorCavern_Entrance_EventScript_GruntFacePlayerEast"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_NORTH", "SeafloorCavern_Entrance_EventScript_GruntFacePlayerNorth"] },
      { cmd: "msgbox", args: ["SeafloorCavern_Entrance_Text_HearMagmaNearMossdeepShort", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SeafloorCavern_Entrance_EventScript_GruntFacePlayerEast": [
      { cmd: "applymovement", args: ["LOCALID_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", "Common_Movement_WalkInPlaceFasterLeft"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "SeafloorCavern_Entrance_EventScript_GruntFacePlayerWest": [
      { cmd: "applymovement", args: ["LOCALID_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", "Common_Movement_WalkInPlaceFasterRight"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "SeafloorCavern_Entrance_EventScript_GruntFacePlayerNorth": [
      { cmd: "applymovement", args: ["LOCALID_SEAFLOOR_CAVERN_ENTRANCE_GRUNT", "Common_Movement_WalkInPlaceFasterDown"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
  },
  movements: {
  },
  text: {
    "SeafloorCavern_Entrance_Text_HearMagmaNearMossdeep": "Hey!\\nI remember your face!\\pIf you're here, it must mean that\\nyou're about to mess with us again!\\pA punk like you, do you really think\\nyou can take on TEAM AQUA?\\pI'd say you're too early by about\\na trillion years!\\pYou're a perfect fit for the likes of\\nTEAM MAGMA!\\pSpeaking of TEAM MAGMA, I hear they\\nwere spotted near MOSSDEEP.\\pThat bunch of goons, they sure don't\\nlook good near the sea!",
    "SeafloorCavern_Entrance_Text_HearMagmaNearMossdeepShort": "A punk like you, do you really think\\nyou can take on TEAM AQUA?\\pI'd say you're too early by about\\na trillion years!\\pYou're a perfect fit for the likes of\\nTEAM MAGMA!\\pSpeaking of TEAM MAGMA, I hear they\\nwere spotted near MOSSDEEP.\\pThat bunch of goons, they sure don't\\nlook good near the sea!",
  },
};

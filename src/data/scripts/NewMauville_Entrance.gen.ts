// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "NewMauville_Entrance_OnLoad",
    onTransition: "NewMauville_Entrance_OnTransition",
  },
  scripts: {
    "NewMauville_Entrance_OnLoad": [
      { cmd: "call_if_eq", args: ["VAR_NEW_MAUVILLE_STATE", 0, "NewMauville_Entrance_EventScript_CloseDoor"] },
      { cmd: "end" },
    ],
    "NewMauville_Entrance_EventScript_CloseDoor": [
      { cmd: "setmetatile", args: [3, 0, "METATILE_Facility_NewMauvilleDoor_Closed_Tile0", "TRUE"] },
      { cmd: "setmetatile", args: [4, 0, "METATILE_Facility_NewMauvilleDoor_Closed_Tile1", "TRUE"] },
      { cmd: "setmetatile", args: [5, 0, "METATILE_Facility_NewMauvilleDoor_Closed_Tile2", "TRUE"] },
      { cmd: "setmetatile", args: [3, 1, "METATILE_Facility_NewMauvilleDoor_Closed_Tile3", "TRUE"] },
      { cmd: "setmetatile", args: [4, 1, "METATILE_Facility_NewMauvilleDoor_Closed_Tile4", "TRUE"] },
      { cmd: "setmetatile", args: [5, 1, "METATILE_Facility_NewMauvilleDoor_Closed_Tile5", "TRUE"] },
      { cmd: "return" },
    ],
    "NewMauville_Entrance_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_NEW_MAUVILLE"] },
      { cmd: "end" },
    ],
    "NewMauville_Entrance_EventScript_Door": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["NewMauville_Entrance_Text_DoorIsLocked", "MSGBOX_DEFAULT"] },
      { cmd: "checkitem", args: ["ITEM_BASEMENT_KEY"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "NewMauville_Entrance_EventScript_DontOpenDoor"] },
      { cmd: "msgbox", args: ["NewMauville_Entrance_Text_UseBasementKey", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "NewMauville_Entrance_EventScript_DontOpenDoor"] },
      { cmd: "msgbox", args: ["NewMauville_Entrance_Text_UsedBasementKey", "MSGBOX_DEFAULT"] },
      { cmd: "setmetatile", args: [3, 0, "METATILE_Facility_NewMauvilleDoor_Open_Tile0", "FALSE"] },
      { cmd: "setmetatile", args: [4, 0, "METATILE_Facility_NewMauvilleDoor_Open_Tile1", "FALSE"] },
      { cmd: "setmetatile", args: [5, 0, "METATILE_Facility_NewMauvilleDoor_Open_Tile2", "FALSE"] },
      { cmd: "setmetatile", args: [3, 1, "METATILE_Facility_NewMauvilleDoor_Open_Tile3", "TRUE"] },
      { cmd: "setmetatile", args: [4, 1, "METATILE_Facility_NewMauvilleDoor_Open_Tile4", "FALSE"] },
      { cmd: "setmetatile", args: [5, 1, "METATILE_Facility_NewMauvilleDoor_Open_Tile5", "TRUE"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "playse", args: ["SE_BANG"] },
      { cmd: "setvar", args: ["VAR_NEW_MAUVILLE_STATE", 1] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "NewMauville_Entrance_EventScript_DontOpenDoor": [
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "NewMauville_Entrance_Text_DoorIsLocked": "The door is locked.",
    "NewMauville_Entrance_Text_UseBasementKey": "Use the BASEMENT KEY?",
    "NewMauville_Entrance_Text_UsedBasementKey": "{PLAYER} used the BASEMENT KEY.\\pThe door opened!",
  },
};

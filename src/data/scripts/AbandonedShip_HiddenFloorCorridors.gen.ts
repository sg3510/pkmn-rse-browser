// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "AbandonedShip_HiddenFloorCorridors_OnLoad",
    onResume: "AbandonedShip_HiddenFloorCorridors_OnResume",
  },
  scripts: {
    "AbandonedShip_HiddenFloorCorridors_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_ABANDONED_SHIP_UNDERWATER1", 5, 4] },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_OnLoad": [
      { cmd: "call_if_unset", args: ["FLAG_USED_ROOM_1_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_LockRoom1"] },
      { cmd: "call_if_unset", args: ["FLAG_USED_ROOM_2_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_LockRoom2"] },
      { cmd: "call_if_unset", args: ["FLAG_USED_ROOM_4_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_LockRoom4"] },
      { cmd: "call_if_unset", args: ["FLAG_USED_ROOM_6_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_LockRoom6"] },
      { cmd: "call_if_set", args: ["FLAG_USED_ROOM_1_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom1"] },
      { cmd: "call_if_set", args: ["FLAG_USED_ROOM_2_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom2"] },
      { cmd: "call_if_set", args: ["FLAG_USED_ROOM_4_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom4"] },
      { cmd: "call_if_set", args: ["FLAG_USED_ROOM_6_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom6"] },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom1": [
      { cmd: "setmetatile", args: [3, 8, "METATILE_InsideShip_IntactDoor_Bottom_Unlocked", "TRUE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom2": [
      { cmd: "setmetatile", args: [6, 8, "METATILE_InsideShip_IntactDoor_Bottom_Unlocked", "TRUE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom4": [
      { cmd: "setmetatile", args: [3, 3, "METATILE_InsideShip_DoorIndent_Unlocked", "FALSE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom6": [
      { cmd: "setmetatile", args: [9, 3, "METATILE_InsideShip_DoorIndent_Unlocked", "FALSE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_LockRoom1": [
      { cmd: "setmetatile", args: [3, 8, "METATILE_InsideShip_IntactDoor_Bottom_Locked", "TRUE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_LockRoom2": [
      { cmd: "setmetatile", args: [6, 8, "METATILE_InsideShip_IntactDoor_Bottom_Locked", "TRUE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_LockRoom4": [
      { cmd: "setmetatile", args: [3, 3, "METATILE_InsideShip_DoorIndent_Locked", "FALSE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_LockRoom6": [
      { cmd: "setmetatile", args: [9, 3, "METATILE_InsideShip_DoorIndent_Locked", "FALSE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_Room1Door": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_USED_ROOM_1_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_TheDoorIsOpen"] },
      { cmd: "checkitem", args: ["ITEM_ROOM_1_KEY"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_HiddenFloorCorridors_EventScript_Rm1IsLocked"] },
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorCorridors_Text_InsertedKey", "MSGBOX_DEFAULT"] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "removeitem", args: ["ITEM_ROOM_1_KEY"] },
      { cmd: "setflag", args: ["FLAG_USED_ROOM_1_KEY"] },
      { cmd: "call", args: ["AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom1"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_Room2Door": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_USED_ROOM_2_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_TheDoorIsOpen"] },
      { cmd: "checkitem", args: ["ITEM_ROOM_2_KEY"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_HiddenFloorCorridors_EventScript_Rm2IsLocked"] },
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorCorridors_Text_InsertedKey", "MSGBOX_DEFAULT"] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "removeitem", args: ["ITEM_ROOM_2_KEY"] },
      { cmd: "setflag", args: ["FLAG_USED_ROOM_2_KEY"] },
      { cmd: "call", args: ["AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom2"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_Room4Door": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_USED_ROOM_4_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_TheDoorIsOpen"] },
      { cmd: "checkitem", args: ["ITEM_ROOM_4_KEY"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_HiddenFloorCorridors_EventScript_Rm4IsLocked"] },
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorCorridors_Text_InsertedKey", "MSGBOX_DEFAULT"] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "removeitem", args: ["ITEM_ROOM_4_KEY"] },
      { cmd: "setflag", args: ["FLAG_USED_ROOM_4_KEY"] },
      { cmd: "call", args: ["AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom4"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_Room6Door": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_USED_ROOM_6_KEY", "AbandonedShip_HiddenFloorCorridors_EventScript_TheDoorIsOpen"] },
      { cmd: "checkitem", args: ["ITEM_ROOM_6_KEY"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_HiddenFloorCorridors_EventScript_Rm6IsLocked"] },
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorCorridors_Text_InsertedKey", "MSGBOX_DEFAULT"] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "removeitem", args: ["ITEM_ROOM_6_KEY"] },
      { cmd: "setflag", args: ["FLAG_USED_ROOM_6_KEY"] },
      { cmd: "call", args: ["AbandonedShip_HiddenFloorCorridors_EventScript_UnlockRoom6"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_Rm1IsLocked": [
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorCorridors_Text_Rm1DoorIsLocked", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_Rm2IsLocked": [
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorCorridors_Text_Rm2DoorIsLocked", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_Rm4IsLocked": [
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorCorridors_Text_Rm4DoorIsLocked", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_Rm6IsLocked": [
      { cmd: "msgbox", args: ["AbandonedShip_HiddenFloorCorridors_Text_Rm6DoorIsLocked", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_HiddenFloorCorridors_EventScript_TheDoorIsOpen": [
      { cmd: "msgbox", args: ["AbandonedShip_Text_TheDoorIsOpen", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AbandonedShip_HiddenFloorCorridors_Text_Rm1DoorIsLocked": "The door is locked.\\p“RM. 1” is painted on the door.",
    "AbandonedShip_HiddenFloorCorridors_Text_Rm2DoorIsLocked": "The door is locked.\\p“RM. 2” is painted on the door.",
    "AbandonedShip_HiddenFloorCorridors_Text_Rm4DoorIsLocked": "The door is locked.\\p“RM. 4” is painted on the door.",
    "AbandonedShip_HiddenFloorCorridors_Text_Rm6DoorIsLocked": "The door is locked.\\p“RM. 6” is painted on the door.",
    "AbandonedShip_HiddenFloorCorridors_Text_InsertedKey": "{PLAYER} inserted and turned the\\nKEY.\\pThe inserted KEY stuck fast,\\nbut the door opened.",
  },
};

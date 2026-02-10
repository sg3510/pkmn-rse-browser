// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "AbandonedShip_Corridors_B1F_OnLoad",
    onResume: "AbandonedShip_Corridors_B1F_OnResume",
  },
  scripts: {
    "AbandonedShip_Corridors_B1F_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_ABANDONED_SHIP_UNDERWATER1", 5, 4] },
      { cmd: "end" },
    ],
    "AbandonedShip_Corridors_B1F_OnLoad": [
      { cmd: "call_if_unset", args: ["FLAG_USED_STORAGE_KEY", "AbandonedShip_Corridors_B1F_EventScript_LockStorageRoom"] },
      { cmd: "call_if_set", args: ["FLAG_USED_STORAGE_KEY", "AbandonedShip_Corridors_B1F_EventScript_UnlockStorageRoom"] },
      { cmd: "end" },
    ],
    "AbandonedShip_Corridors_B1F_EventScript_LockStorageRoom": [
      { cmd: "setmetatile", args: [11, 4, "METATILE_InsideShip_IntactDoor_Bottom_Locked", "TRUE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_Corridors_B1F_EventScript_UnlockStorageRoom": [
      { cmd: "setmetatile", args: [11, 4, "METATILE_InsideShip_IntactDoor_Bottom_Unlocked", "TRUE"] },
      { cmd: "return" },
    ],
    "AbandonedShip_Corridors_B1F_EventScript_TuberM": [
      { cmd: "msgbox", args: ["AbandonedShip_Corridors_B1F_Text_YayItsAShip", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "AbandonedShip_Corridors_B1F_EventScript_StorageRoomDoor": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_USED_STORAGE_KEY", "AbandonedShip_Corridors_B1F_EventScript_DoorIsUnlocked"] },
      { cmd: "checkitem", args: ["ITEM_STORAGE_KEY"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "AbandonedShip_Corridors_B1F_EventScript_DoorIsLocked"] },
      { cmd: "msgbox", args: ["AbandonedShip_Corridors_B1F_Text_InsertedStorageKey", "MSGBOX_DEFAULT"] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "removeitem", args: ["ITEM_STORAGE_KEY"] },
      { cmd: "setflag", args: ["FLAG_USED_STORAGE_KEY"] },
      { cmd: "call", args: ["AbandonedShip_Corridors_B1F_EventScript_UnlockStorageRoom"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_Corridors_B1F_EventScript_DoorIsLocked": [
      { cmd: "msgbox", args: ["AbandonedShip_Corridors_B1F_Text_DoorIsLocked", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_Corridors_B1F_EventScript_DoorIsUnlocked": [
      { cmd: "msgbox", args: ["AbandonedShip_Text_TheDoorIsOpen", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AbandonedShip_Corridors_B1F_EventScript_Duncan": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DUNCAN", "AbandonedShip_Corridors_B1F_Text_DuncanIntro", "AbandonedShip_Corridors_B1F_Text_DuncanDefeat"] },
      { cmd: "msgbox", args: ["AbandonedShip_Corridors_B1F_Text_DuncanPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AbandonedShip_Corridors_B1F_Text_DuncanIntro": "When we go out to sea, we SAILORS\\nalways bring our POKéMON.\\lHow about a quick battle?",
    "AbandonedShip_Corridors_B1F_Text_DuncanDefeat": "Whoops, I'm sunk!",
    "AbandonedShip_Corridors_B1F_Text_DuncanPostBattle": "The ship's bottom has sunk into the\\ndepths.\\pIf a POKéMON knew how to go underwater,\\nwe might make some progress…",
    "AbandonedShip_Corridors_B1F_Text_YayItsAShip": "Yay!\\nIt's a ship!",
    "AbandonedShip_Corridors_B1F_Text_DoorIsLocked": "The door is locked.\\p“STORAGE” is painted on the door.",
    "AbandonedShip_Corridors_B1F_Text_InsertedStorageKey": "{PLAYER} inserted and turned the\\nSTORAGE KEY.\\pThe inserted KEY stuck fast,\\nbut the door opened.",
    "AbandonedShip_Text_TheDoorIsOpen": "The door is open.",
  },
};

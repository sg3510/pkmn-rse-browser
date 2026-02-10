// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "MtChimney_CableCarStation_OnTransition",
    onFrame: [
      { var: "VAR_CABLE_CAR_STATION_STATE", value: 1, script: "MtChimney_CableCarStation_EventScript_ExitCableCar" },
    ],
  },
  scripts: {
    "MtChimney_CableCarStation_OnTransition": [
      { cmd: "call_if_eq", args: ["VAR_CABLE_CAR_STATION_STATE", 1, "MtChimney_CableCarStation_EventScript_MoveAttendantAside"] },
      { cmd: "end" },
    ],
    "MtChimney_CableCarStation_EventScript_MoveAttendantAside": [
      { cmd: "setobjectxyperm", args: ["LOCALID_MT_CHIMNEY_CABLE_CAR_ATTENDANT", 5, 4] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_MT_CHIMNEY_CABLE_CAR_ATTENDANT", "MOVEMENT_TYPE_FACE_RIGHT"] },
      { cmd: "return" },
    ],
    "MtChimney_CableCarStation_EventScript_ExitCableCar": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "MtChimney_CableCarStation_Movement_ExitCableCar"] },
      { cmd: "applymovement", args: ["LOCALID_MT_CHIMNEY_CABLE_CAR_ATTENDANT", "MtChimney_CableCarStation_Movement_FollowPlayerOutFromCableCar"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setvar", args: ["VAR_CABLE_CAR_STATION_STATE", 0] },
      { cmd: "setobjectxyperm", args: ["LOCALID_MT_CHIMNEY_CABLE_CAR_ATTENDANT", 6, 7] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_MT_CHIMNEY_CABLE_CAR_ATTENDANT", "MOVEMENT_TYPE_FACE_DOWN"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "MtChimney_CableCarStation_EventScript_Attendant": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["MtChimney_CableCarStation_Text_CableCarReadyGetOn", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "MtChimney_CableCarStation_EventScript_RideCableCar"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "MtChimney_CableCarStation_EventScript_DeclineRide"] },
      { cmd: "end" },
    ],
    "MtChimney_CableCarStation_EventScript_RideCableCar": [
      { cmd: "msgbox", args: ["MtChimney_CableCarStation_Text_StepThisWay", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_MT_CHIMNEY_CABLE_CAR_ATTENDANT", "MtChimney_CableCarStation_Movement_LeadPlayerToCableCar"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "MtChimney_CableCarStation_Movement_BoardCableCar"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setvar", args: ["VAR_0x8004", "TRUE"] },
      { cmd: "setvar", args: ["VAR_CABLE_CAR_STATION_STATE", 2] },
      { cmd: "incrementgamestat", args: ["GAME_STAT_RODE_CABLE_CAR"] },
      { cmd: "special", args: ["CableCarWarp"] },
      { cmd: "special", args: ["CableCar"] },
      { cmd: "waitstate" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MtChimney_CableCarStation_EventScript_DeclineRide": [
      { cmd: "msgbox", args: ["MtChimney_CableCarStation_Text_RideAnotherTime", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
    "MtChimney_CableCarStation_Movement_LeadPlayerToCableCar": ["walk_up", "walk_up", "walk_left", "walk_in_place_faster_right"],
    "MtChimney_CableCarStation_Movement_FollowPlayerOutFromCableCar": ["delay_16", "walk_right", "walk_down", "walk_down"],
    "MtChimney_CableCarStation_Movement_BoardCableCar": ["walk_up", "walk_up", "walk_up", "delay_16"],
    "MtChimney_CableCarStation_Movement_ExitCableCar": ["walk_down", "walk_down", "walk_down", "delay_16"],
  },
  text: {
    "MtChimney_CableCarStation_Text_CableCarReadyGetOn": "The CABLE CAR is ready to go down.\\nWould you like to be on it?",
    "MtChimney_CableCarStation_Text_StepThisWay": "Please step this way.",
    "MtChimney_CableCarStation_Text_RideAnotherTime": "Please ride with us another time.",
  },
};

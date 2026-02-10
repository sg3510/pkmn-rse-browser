// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route112_CableCarStation_OnTransition",
    onFrame: [
      { var: "VAR_CABLE_CAR_STATION_STATE", value: 2, script: "Route112_CableCarStation_EventScript_ExitCableCar" },
    ],
  },
  scripts: {
    "Route112_CableCarStation_OnTransition": [
      { cmd: "setescapewarp", args: ["MAP_ROUTE112", 28, 28] },
      { cmd: "call_if_eq", args: ["VAR_CABLE_CAR_STATION_STATE", 2, "Route112_CableCarStation_EventScript_MoveAttendantAside"] },
      { cmd: "end" },
    ],
    "Route112_CableCarStation_EventScript_MoveAttendantAside": [
      { cmd: "setobjectxyperm", args: ["LOCALID_ROUTE112_CABLE_CAR_ATTENDANT", 7, 4] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_ROUTE112_CABLE_CAR_ATTENDANT", "MOVEMENT_TYPE_FACE_LEFT"] },
      { cmd: "return" },
    ],
    "Route112_CableCarStation_EventScript_ExitCableCar": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Route112_CableCarStation_Movement_ExitCableCar"] },
      { cmd: "applymovement", args: ["LOCALID_ROUTE112_CABLE_CAR_ATTENDANT", "Route112_CableCarStation_Movement_FollowPlayerOutFromCableCar"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setvar", args: ["VAR_CABLE_CAR_STATION_STATE", 0] },
      { cmd: "setobjectxyperm", args: ["LOCALID_ROUTE112_CABLE_CAR_ATTENDANT", 6, 7] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_ROUTE112_CABLE_CAR_ATTENDANT", "MOVEMENT_TYPE_FACE_DOWN"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route112_CableCarStation_EventScript_Attendant": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["Route112_CableCarStation_Text_CableCarReadyGetOn", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "Route112_CableCarStation_EventScript_RideCableCar"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "Route112_CableCarStation_EventScript_DeclineRide"] },
      { cmd: "end" },
    ],
    "Route112_CableCarStation_EventScript_RideCableCar": [
      { cmd: "msgbox", args: ["Route112_CableCarStation_Text_StepThisWay", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_ROUTE112_CABLE_CAR_ATTENDANT", "Route112_CableCarStation_Movement_LeadPlayerToCableCar"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Route112_CableCarStation_Movement_BoardCableCar"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setvar", args: ["VAR_0x8004", "FALSE"] },
      { cmd: "setvar", args: ["VAR_CABLE_CAR_STATION_STATE", 1] },
      { cmd: "incrementgamestat", args: ["GAME_STAT_RODE_CABLE_CAR"] },
      { cmd: "special", args: ["CableCarWarp"] },
      { cmd: "special", args: ["CableCar"] },
      { cmd: "waitstate" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route112_CableCarStation_EventScript_DeclineRide": [
      { cmd: "msgbox", args: ["Route112_CableCarStation_Text_RideAnotherTime", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
    "Route112_CableCarStation_Movement_LeadPlayerToCableCar": ["walk_up", "walk_up", "walk_right", "walk_in_place_faster_left"],
    "Route112_CableCarStation_Movement_FollowPlayerOutFromCableCar": ["delay_16", "walk_left", "walk_down", "walk_down"],
    "Route112_CableCarStation_Movement_BoardCableCar": ["walk_up", "walk_up", "walk_up", "delay_16"],
    "Route112_CableCarStation_Movement_ExitCableCar": ["walk_down", "walk_down", "walk_down", "delay_16"],
  },
  text: {
    "Route112_CableCarStation_Text_CableCarReadyGetOn": "The CABLE CAR is ready to go up.\\nWould you like to be on it?",
    "Route112_CableCarStation_Text_StepThisWay": "Please step this way.",
    "Route112_CableCarStation_Text_RideAnotherTime": "Please ride with us another time.",
  },
};

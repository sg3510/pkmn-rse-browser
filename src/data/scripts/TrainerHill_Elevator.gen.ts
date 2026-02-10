// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_4", value: 0, script: "TrainerHill_Elevator_EventScript_EnterElevator" },
    ],
  },
  scripts: {
    "TrainerHill_Elevator_EventScript_Attendant": [
      { cmd: "end" },
    ],
    "TrainerHill_Elevator_EventScript_ExitToRoof": [
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "TrainerHill_Elevator_Movement_PlayerExitElevatorToRoof"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "releaseall" },
      { cmd: "warp", args: ["MAP_TRAINER_HILL_ROOF", 15, 5] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "TrainerHill_Elevator_EventScript_EnterElevator": [
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "TrainerHill_Elevator_Movement_PlayerApproachAttendant"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_TRAINER_HILL_ELEVATOR_ATTENDANT", "TrainerHill_Elevator_Movement_AttendantFacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "lockall" },
      { cmd: "msgbox", args: ["TrainerHill_Elevator_Text_ReturnToReception", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "TrainerHill_Elevator_EventScript_ExitToRoof"] },
      { cmd: "releaseall" },
      { cmd: "applymovement", args: ["LOCALID_TRAINER_HILL_ELEVATOR_ATTENDANT", "TrainerHill_Elevator_Movement_AttendantFaceDown"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "TrainerHill_Elevator_Movement_PlayerMoveToCenterOfElevator"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "call", args: ["TrainerHill_Elevator_EventScript_MoveElevator"] },
      { cmd: "delay", args: [25] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "TrainerHill_Elevator_Movement_PlayerExitElevator"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "warp", args: ["MAP_TRAINER_HILL_ENTRANCE", 17, 8] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "TrainerHill_Elevator_EventScript_ExitFloorSelect": [
      { cmd: "goto", args: ["TrainerHill_Elevator_EventScript_CloseFloorSelect"] },
      { cmd: "end" },
    ],
    "TrainerHill_Elevator_EventScript_CloseFloorSelect": [
      { cmd: "special", args: ["CloseDeptStoreElevatorWindow"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "TrainerHill_Elevator_EventScript_MoveElevator": [
      { cmd: "waitse" },
      { cmd: "special", args: ["MoveElevator"] },
      { cmd: "waitstate" },
      { cmd: "return" },
    ],
  },
  movements: {
    "TrainerHill_Elevator_Movement_PlayerMoveToCenterOfElevator": ["walk_up", "walk_up", "walk_right", "face_down"],
    "TrainerHill_Elevator_Movement_PlayerApproachAttendant": ["delay_16", "walk_left"],
    "TrainerHill_Elevator_Movement_PlayerExitElevator": ["delay_16", "walk_down", "walk_down"],
    "TrainerHill_Elevator_Movement_PlayerExitElevatorToRoof": ["face_down", "delay_16"],
    "TrainerHill_Elevator_Movement_AttendantFacePlayer": ["face_right"],
    "TrainerHill_Elevator_Movement_AttendantFaceDown": ["face_down"],
  },
  text: {
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SafariZone_South_OnTransition",
    onFrame: [
      { var: "VAR_SAFARI_ZONE_STATE", value: 2, script: "SafariZone_South_EventScript_EnterSafariZone" },
    ],
  },
  scripts: {
    "SafariZone_South_EventScript_EnterSafariZone": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "SafariZone_South_Movement_PlayerEnter"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_SAFARI_EXIT_ATTENDANT", "SafariZone_South_Movement_ExitAttendantBlockDoor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setobjectxyperm", args: ["LOCALID_SAFARI_EXIT_ATTENDANT", 32, 34] },
      { cmd: "setvar", args: ["VAR_SAFARI_ZONE_STATE", 0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SafariZone_South_OnTransition": [
      { cmd: "call_if_eq", args: ["VAR_SAFARI_ZONE_STATE", 2, "SafariZone_South_EventScript_SetExitAttendantAside"] },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_SetExitAttendantAside": [
      { cmd: "setobjectxyperm", args: ["LOCALID_SAFARI_EXIT_ATTENDANT", 31, 34] },
      { cmd: "return" },
    ],
    "SafariZone_South_EventScript_Boy": [
      { cmd: "msgbox", args: ["SafariZone_South_Text_Boy", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_Man": [
      { cmd: "msgbox", args: ["SafariZone_South_Text_Man", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_Youngster": [
      { cmd: "msgbox", args: ["SafariZone_South_Text_Youngster", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_ExitAttendant": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_unset", args: ["FLAG_GOOD_LUCK_SAFARI_ZONE", "SafariZone_South_EventScript_GoodLuck"] },
      { cmd: "msgbox", args: ["SafariZone_South_Text_StillHaveTimeExit", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "SafariZone_South_EventScript_ExitEarly"] },
      { cmd: "msgbox", args: ["SafariZone_South_Text_EnjoyTheRestOfYourAdventure", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_GoodLuck": [
      { cmd: "setflag", args: ["FLAG_GOOD_LUCK_SAFARI_ZONE"] },
      { cmd: "msgbox", args: ["SafariZone_South_Text_GoodLuck", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_ExitEarly": [
      { cmd: "msgbox", args: ["SafariZone_South_Text_ExitEarlyThankYouForPlaying", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "switch", args: ["VAR_FACING"] },
      { cmd: "case", args: ["DIR_NORTH", "SafariZone_South_EventScript_ExitEarlyNorth"] },
      { cmd: "case", args: ["DIR_EAST", "SafariZone_South_EventScript_ExitEarlyEast"] },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_ExitEarlyNorth": [
      { cmd: "applymovement", args: ["LOCALID_SAFARI_EXIT_ATTENDANT", "SafariZone_South_Movement_MoveExitAttendantNorth"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "SafariZone_South_Movement_PlayerExitNorth"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "goto", args: ["SafariZone_South_EventScript_Exit"] },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_ExitEarlyEast": [
      { cmd: "applymovement", args: ["LOCALID_SAFARI_EXIT_ATTENDANT", "SafariZone_South_Movement_MoveExitAttendantEast"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "SafariZone_South_Movement_PlayerExitEast"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "goto", args: ["SafariZone_South_EventScript_Exit"] },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_Exit": [
      { cmd: "setvar", args: ["VAR_SAFARI_ZONE_STATE", 1] },
      { cmd: "special", args: ["ExitSafariMode"] },
      { cmd: "warpdoor", args: ["MAP_ROUTE121_SAFARI_ZONE_ENTRANCE", 2, 5] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_ConstructionWorker1": [
      { cmd: "msgbox", args: ["SafariZone_South_Text_AreaOffLimits1", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_Southeast_EventScript_ExpansionZoneAttendant": [
      { cmd: "msgbox", args: ["SafariZone_Southeast_Text_ExpansionIsFinished", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_South_EventScript_ConstructionWorker2": [
      { cmd: "msgbox", args: ["SafariZone_South_Text_AreaOffLimits2", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_Southeast_EventScript_LittleGirl": [
      { cmd: "msgbox", args: ["SafariZone_Southeast_Text_LittleGirl", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_Southeast_EventScript_FatMan": [
      { cmd: "msgbox", args: ["SafariZone_Southeast_Text_FatMan", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_Southeast_EventScript_RichBoy": [
      { cmd: "msgbox", args: ["SafariZone_Southeast_Text_RichBoy", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_Northeast_EventScript_Boy": [
      { cmd: "msgbox", args: ["SafariZone_Northeast_Text_Boy", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_Northeast_EventScript_Woman": [
      { cmd: "msgbox", args: ["SafariZone_Northeast_Text_Woman", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SafariZone_Northeast_EventScript_Girl": [
      { cmd: "msgbox", args: ["SafariZone_Northeast_Text_Girl", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "SafariZone_South_Movement_PlayerEnter": ["walk_down"],
    "SafariZone_South_Movement_ExitAttendantBlockDoor": ["walk_right", "walk_in_place_faster_down"],
    "SafariZone_South_Movement_PlayerExitNorth": ["walk_up"],
    "SafariZone_South_Movement_PlayerExitEast": ["walk_right", "walk_in_place_faster_up"],
    "SafariZone_South_Movement_MoveExitAttendantNorth": ["walk_left", "walk_in_place_faster_right"],
    "SafariZone_South_Movement_MoveExitAttendantEast": ["walk_down", "walk_in_place_faster_up"],
  },
  text: {
  },
};

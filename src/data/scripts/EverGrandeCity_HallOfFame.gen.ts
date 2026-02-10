// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_1", value: 0, script: "EverGrandeCity_HallOfFame_EventScript_EnterHallOfFame" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_1", value: 0, script: "EverGrandeCity_HallOfFame_EventScript_TurnPlayerNorth" },
    ],
  },
  scripts: {
    "EverGrandeCity_HallOfFame_EventScript_TurnPlayerNorth": [
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_NORTH"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_HallOfFame_EventScript_EnterHallOfFame": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_HALL_OF_FAME_WALLACE", "EverGrandeCity_HallOfFame_Movement_WalkIntoHallOfFame1"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "EverGrandeCity_HallOfFame_Movement_WalkIntoHallOfFame1"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_HALL_OF_FAME_WALLACE", "Common_Movement_WalkInPlaceFasterRight"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Common_Movement_WalkInPlaceFasterLeft"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["EverGrandeCity_HallOfFame_Text_HereWeHonorLeagueChampions", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_HALL_OF_FAME_WALLACE", "EverGrandeCity_HallOfFame_Movement_WalkIntoHallOfFame2"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "EverGrandeCity_HallOfFame_Movement_WalkIntoHallOfFame2"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [20] },
      { cmd: "applymovement", args: ["LOCALID_HALL_OF_FAME_WALLACE", "Common_Movement_WalkInPlaceFasterRight"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Common_Movement_WalkInPlaceFasterLeft"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["EverGrandeCity_HallOfFame_Text_LetsRecordYouAndYourPartnersNames", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_HALL_OF_FAME_WALLACE", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [20] },
      { cmd: "dofieldeffect", args: ["FLDEFF_HALL_OF_FAME_RECORD"] },
      { cmd: "waitfieldeffect", args: ["FLDEFF_HALL_OF_FAME_RECORD"] },
      { cmd: "delay", args: [40] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "call", args: ["EverGrandeCity_HallOfFame_EventScript_SetGameClearFlags"] },
      { cmd: "checkplayergender" },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "MALE", "EverGrandeCity_HallOfFame_EventScript_GameClearMale"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FEMALE", "EverGrandeCity_HallOfFame_EventScript_GameClearFemale"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_HallOfFame_EventScript_GameClearMale": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F"] },
      { cmd: "fadescreenspeed", args: ["FADE_TO_BLACK", 24] },
      { cmd: "special", args: ["GameClear"] },
      { cmd: "waitstate" },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "EverGrandeCity_HallOfFame_EventScript_GameClearFemale": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_LITTLEROOT_TOWN_MAYS_HOUSE_2F"] },
      { cmd: "fadescreenspeed", args: ["FADE_TO_BLACK", 24] },
      { cmd: "special", args: ["GameClear"] },
      { cmd: "waitstate" },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
    "EverGrandeCity_HallOfFame_Movement_WalkIntoHallOfFame1": ["walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "walk_up"],
    "EverGrandeCity_HallOfFame_Movement_WalkIntoHallOfFame2": ["walk_up", "walk_up", "walk_up", "walk_up", "walk_up"],
  },
  text: {
    "EverGrandeCity_HallOfFame_Text_HereWeHonorLeagueChampions": "WALLACE: This room…\\pThis is where we keep records of\\nPOKéMON that prevailed through\\lharsh battles.\\pIt is here that the LEAGUE CHAMPIONS\\nare honored.",
    "EverGrandeCity_HallOfFame_Text_LetsRecordYouAndYourPartnersNames": "WALLACE: Come on, let's record your\\nname as a TRAINER who triumphed over\\lthe POKéMON LEAGUE, and the names of\\lthe partners who battled with you.",
  },
};

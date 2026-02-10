// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SootopolisCity_MysteryEventsHouse_B1F_OnTransition",
    onFrame: [
      { var: "VAR_TEMP_1", value: 0, script: "SootopolisCity_MysteryEventsHouse_B1F_EventScript_BattleVisitingTrainer" },
    ],
  },
  scripts: {
    "SootopolisCity_MysteryEventsHouse_B1F_OnTransition": [
      { cmd: "special", args: ["SetEReaderTrainerGfxId"] },
      { cmd: "end" },
    ],
    "SootopolisCity_MysteryEventsHouse_B1F_EventScript_BattleVisitingTrainer": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "SootopolisCity_MysteryEventsHouse_B1F_Movement_PlayerEnterBasement"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "special", args: ["CopyEReaderTrainerGreeting"] },
      { cmd: "msgbox", args: ["gStringVar4", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIAL_BATTLE_EREADER"] },
      { cmd: "setvar", args: ["VAR_0x8005", 0] },
      { cmd: "special", args: ["DoSpecialTrainerBattle"] },
      { cmd: "waitstate" },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "B_OUTCOME_DREW", "SootopolisCity_MysteryEventsHouse_B1F_EventScript_BattleTie"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "B_OUTCOME_WON", "SootopolisCity_MysteryEventsHouse_B1F_EventScript_BattleWon"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "B_OUTCOME_LOST", "SootopolisCity_MysteryEventsHouse_B1F_EventScript_BattleLost"] },
      { cmd: "closemessage" },
      { cmd: "special", args: ["HealPlayerParty"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "SootopolisCity_MysteryEventsHouse_B1F_Movement_PlayerExitBasement"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "special", args: ["LoadPlayerParty"] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "warp", args: ["MAP_SOOTOPOLIS_CITY_MYSTERY_EVENTS_HOUSE_1F", 3, 1] },
      { cmd: "waitstate" },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SootopolisCity_MysteryEventsHouse_B1F_EventScript_BattleTie": [
      { cmd: "setvar", args: ["VAR_SOOTOPOLIS_MYSTERY_EVENTS_STATE", 3] },
      { cmd: "msgbox", args: ["SootopolisCity_MysteryEventsHouse_B1F_Text_MatchEndedUpDraw", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "SootopolisCity_MysteryEventsHouse_B1F_EventScript_BattleWon": [
      { cmd: "setvar", args: ["VAR_SOOTOPOLIS_MYSTERY_EVENTS_STATE", 1] },
      { cmd: "special", args: ["ShowFieldMessageStringVar4"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "return" },
    ],
    "SootopolisCity_MysteryEventsHouse_B1F_EventScript_BattleLost": [
      { cmd: "setvar", args: ["VAR_SOOTOPOLIS_MYSTERY_EVENTS_STATE", 2] },
      { cmd: "special", args: ["ShowFieldMessageStringVar4"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "return" },
    ],
  },
  movements: {
    "SootopolisCity_MysteryEventsHouse_B1F_Movement_PlayerEnterBasement": ["walk_down", "walk_down", "walk_down", "walk_right", "walk_right"],
    "SootopolisCity_MysteryEventsHouse_B1F_Movement_PlayerExitBasement": ["walk_left", "walk_left", "walk_up", "walk_up", "walk_up", "walk_up", "delay_8"],
  },
  text: {
  },
};

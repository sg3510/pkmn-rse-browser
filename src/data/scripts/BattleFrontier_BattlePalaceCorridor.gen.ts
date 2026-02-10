// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "BattleFrontier_BattlePalaceCorridor_EventScript_WalkThroughCorridor" },
    ],
  },
  scripts: {
    "BattleFrontier_BattlePalaceCorridor_EventScript_WalkThroughCorridor": [
      { cmd: "delay", args: [16] },
      { cmd: "applymovement", args: ["LOCALID_PALACE_CORRIDOR_ATTENDANT", "BattleFrontier_BattlePalaceCorridor_Movement_EnterCorridor"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattlePalaceCorridor_Movement_EnterCorridor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "lockall" },
      { cmd: "palace_getcomment" },
      { cmd: "call_if_eq", args: ["VAR_RESULT", 0, "BattleFrontier_BattlePalaceCorridor_EventScript_RandomComment1"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", 1, "BattleFrontier_BattlePalaceCorridor_EventScript_RandomComment2"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", 2, "BattleFrontier_BattlePalaceCorridor_EventScript_RandomComment3"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", 3, "BattleFrontier_BattlePalaceCorridor_EventScript_StreakComment"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", 4, "BattleFrontier_BattlePalaceCorridor_EventScript_LongStreakComment"] },
      { cmd: "closemessage" },
      { cmd: "frontier_get", args: ["FRONTIER_DATA_LVL_MODE"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FRONTIER_LVL_OPEN", "BattleFrontier_BattlePalaceCorridor_EventScript_WalkToOpenBattleRoom"] },
      { cmd: "applymovement", args: ["LOCALID_PALACE_CORRIDOR_ATTENDANT", "BattleFrontier_BattlePalaceCorridor_Movement_AttendantWalkTo50BattleRoom"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattlePalaceCorridor_Movement_PlayerWalkTo50BattleRoom"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "opendoor", args: [6, 3] },
      { cmd: "waitdooranim" },
      { cmd: "applymovement", args: ["LOCALID_PALACE_CORRIDOR_ATTENDANT", "BattleFrontier_BattlePalaceCorridor_Movement_AttendantEnterBattleRoom"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattlePalaceCorridor_Movement_PlayerEnterBattleRoom"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "closedoor", args: [6, 3] },
      { cmd: "waitdooranim" },
      { cmd: "goto", args: ["BattleFrontier_BattlePalaceCorridor_EventScript_WarpToBattleRoom"] },
    ],
    "BattleFrontier_BattlePalaceCorridor_EventScript_WalkToOpenBattleRoom": [
      { cmd: "applymovement", args: ["LOCALID_PALACE_CORRIDOR_ATTENDANT", "BattleFrontier_BattlePalaceCorridor_Movement_AttendantWalkToOpenBattleRoom"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattlePalaceCorridor_Movement_PlayerWalkToOpenBattleRoom"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "opendoor", args: [10, 3] },
      { cmd: "waitdooranim" },
      { cmd: "applymovement", args: ["LOCALID_PALACE_CORRIDOR_ATTENDANT", "BattleFrontier_BattlePalaceCorridor_Movement_AttendantEnterBattleRoom"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "BattleFrontier_BattlePalaceCorridor_Movement_PlayerEnterBattleRoom"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "closedoor", args: [10, 3] },
      { cmd: "waitdooranim" },
    ],
    "BattleFrontier_BattlePalaceCorridor_EventScript_WarpToBattleRoom": [
      { cmd: "warp", args: ["MAP_BATTLE_FRONTIER_BATTLE_PALACE_BATTLE_ROOM", 7, 4] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "BattleFrontier_BattlePalaceCorridor_EventScript_RandomComment1": [
      { cmd: "msgbox", args: ["BattleFrontier_BattlePalaceCorridor_Text_PeopleAndMonAreSame", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "BattleFrontier_BattlePalaceCorridor_EventScript_RandomComment2": [
      { cmd: "msgbox", args: ["BattleFrontier_BattlePalaceCorridor_Text_LetMonDoWhatItLikes", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "BattleFrontier_BattlePalaceCorridor_EventScript_RandomComment3": [
      { cmd: "msgbox", args: ["BattleFrontier_BattlePalaceCorridor_Text_MonDifferentWhenCornered", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "BattleFrontier_BattlePalaceCorridor_EventScript_StreakComment": [
      { cmd: "msgbox", args: ["BattleFrontier_BattlePalaceCorridor_Text_BeginningToUnderstandNature", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "BattleFrontier_BattlePalaceCorridor_EventScript_LongStreakComment": [
      { cmd: "msgbox", args: ["BattleFrontier_BattlePalaceCorridor_Text_HeartfeltBondBetweenYouAndMons", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
  },
  movements: {
    "BattleFrontier_BattlePalaceCorridor_Movement_EnterCorridor": ["walk_up", "walk_up", "walk_up", "walk_up"],
    "BattleFrontier_BattlePalaceCorridor_Movement_AttendantWalkTo50BattleRoom": ["walk_up", "walk_up", "walk_left", "walk_left", "walk_up", "walk_up"],
    "BattleFrontier_BattlePalaceCorridor_Movement_PlayerWalkTo50BattleRoom": ["walk_up", "walk_up", "walk_up", "walk_left", "walk_left", "walk_up"],
    "BattleFrontier_BattlePalaceCorridor_Movement_AttendantWalkToOpenBattleRoom": ["walk_up", "walk_right", "walk_right", "walk_up", "walk_up", "walk_up"],
    "BattleFrontier_BattlePalaceCorridor_Movement_PlayerWalkToOpenBattleRoom": ["walk_up", "walk_up", "walk_right", "walk_right", "walk_up", "walk_up"],
    "BattleFrontier_BattlePalaceCorridor_Movement_PlayerEnterBattleRoom": ["walk_up"],
    "BattleFrontier_BattlePalaceCorridor_Movement_AttendantEnterBattleRoom": ["walk_up", "set_invisible"],
  },
  text: {
    "BattleFrontier_BattlePalaceCorridor_Text_PeopleAndMonAreSame": "People and POKéMON, they are but\\nthe same…\\pTheir individual nature makes them\\ngood at certain things, and not good\\lat others.",
    "BattleFrontier_BattlePalaceCorridor_Text_LetMonDoWhatItLikes": "Rather than trying to make a POKéMON\\ndo what it dislikes, try to let it do\\lwhat it likes and is good at doing.\\pPut yourself in the POKéMON's position\\nand consider what moves it would like.",
    "BattleFrontier_BattlePalaceCorridor_Text_MonDifferentWhenCornered": "A POKéMON's nature is a remarkable\\nthing…\\pSome POKéMON behave in a completely\\ndifferent way when they are cornered.",
    "BattleFrontier_BattlePalaceCorridor_Text_BeginningToUnderstandNature": "Are you beginning to understand how\\na POKéMON's nature makes it behave?",
    "BattleFrontier_BattlePalaceCorridor_Text_HeartfeltBondBetweenYouAndMons": "Ah… I see a strong, heartfelt bond\\nbetween you and your POKéMON…",
  },
};

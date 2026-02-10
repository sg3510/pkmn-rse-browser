// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "VerdanturfTown_BattleTentCorridor_EventScript_EnterCorridor" },
    ],
  },
  scripts: {
    "VerdanturfTown_BattleTentCorridor_EventScript_EnterCorridor": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_TEMP_0", 1] },
      { cmd: "applymovement", args: ["LOCALID_VERDANTURF_TENT_CORRIDOR_ATTENDANT", "VerdanturfTown_BattleTentCorridor_Movement_WalkToDoor"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "VerdanturfTown_BattleTentCorridor_Movement_WalkToDoor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "opendoor", args: [2, 1] },
      { cmd: "waitdooranim" },
      { cmd: "applymovement", args: ["LOCALID_VERDANTURF_TENT_CORRIDOR_ATTENDANT", "VerdanturfTown_BattleTentCorridor_Movement_AttendantEnterDoor"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "VerdanturfTown_BattleTentCorridor_Movement_PlayerEnterDoor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "closedoor", args: [2, 1] },
      { cmd: "waitdooranim" },
      { cmd: "setvar", args: ["VAR_0x8006", 0] },
      { cmd: "warp", args: ["MAP_VERDANTURF_TOWN_BATTLE_TENT_BATTLE_ROOM", 6, 5] },
      { cmd: "waitstate" },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
    "VerdanturfTown_BattleTentCorridor_Movement_WalkToDoor": ["walk_up", "walk_up", "walk_up", "walk_up"],
    "VerdanturfTown_BattleTentCorridor_Movement_PlayerEnterDoor": ["walk_up"],
    "VerdanturfTown_BattleTentCorridor_Movement_AttendantEnterDoor": ["walk_up", "set_invisible"],
  },
  text: {
    "VerdanturfTown_ContestHall_Text_WhichContestYouEntering": "Which CONTEST are you entering?\\nWant a piece of advice?\\pIn any CONTEST, for example, a CUTE\\nCONTEST, I don't think they judge you\\lonly on cuteness in the first round.\\pYou need to work out ways for raising\\nPOKéMON better.",
    "VerdanturfTown_ContestHall_Text_RaisedMonToBeCute": "I raised my POKéMON to be cute.\\pI found out you can put POKéMON in\\na CONTEST for cuteness!\\pI'm so glad I raised my POKéMON with\\nloving care…",
    "VerdanturfTown_ContestHall_Text_MyMonRules": "My POKéMON rules!\\pIt's cool, tough yet beautiful, cute,\\nand smart. It's complete!\\pI may as well go for wins in every\\nsingle CONTEST.",
    "VerdanturfTown_ContestHall_Text_NormalRankStage": "POKéMON CONTESTS\\nNORMAL RANK STAGE!",
  },
};

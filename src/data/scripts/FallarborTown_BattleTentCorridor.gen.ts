// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "FallarborTown_BattleTentCorridor_EventScript_EnterCorridor" },
    ],
  },
  scripts: {
    "FallarborTown_BattleTentCorridor_EventScript_EnterCorridor": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_TEMP_0", 1] },
      { cmd: "applymovement", args: ["LOCALID_FALLARBOR_TENT_CORRIDOR_ATTENDANT", "FallarborTown_BattleTentCorridor_Movement_WalkToDoor"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "FallarborTown_BattleTentCorridor_Movement_WalkToDoor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "opendoor", args: [2, 1] },
      { cmd: "waitdooranim" },
      { cmd: "applymovement", args: ["LOCALID_FALLARBOR_TENT_CORRIDOR_ATTENDANT", "FallarborTown_BattleTentCorridor_Movement_AttendantEnterDoor"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "FallarborTown_BattleTentCorridor_Movement_PlayerEnterDoor"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "closedoor", args: [2, 1] },
      { cmd: "waitdooranim" },
      { cmd: "setvar", args: ["VAR_0x8006", 0] },
      { cmd: "warp", args: ["MAP_FALLARBOR_TOWN_BATTLE_TENT_BATTLE_ROOM", 4, 4] },
      { cmd: "waitstate" },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
    "FallarborTown_BattleTentCorridor_Movement_WalkToDoor": ["walk_up", "walk_up", "walk_up", "walk_up"],
    "FallarborTown_BattleTentCorridor_Movement_PlayerEnterDoor": ["walk_up"],
    "FallarborTown_BattleTentCorridor_Movement_AttendantEnterDoor": ["walk_up", "set_invisible"],
  },
  text: {
    "FallarborTown_ContestHall_Text_DoAllRightInPreliminary": "We do all right in the preliminary round,\\nbut we can never win the appeals…\\pMaybe it means I have to watch what\\nother contestants are doing…",
    "FallarborTown_ContestHall_Text_MonAllTheseRibbons": "See!\\nMy POKéMON won all these RIBBONS!\\pHave your POKéMON earned any RIBBONS?\\nYou can check them on your POKéNAV.",
    "FallarborTown_ContestHall_Text_CantWinEverywhere": "I can't beat GYM LEADERS…\\pI can't win any CONTESTS…\\pI've been here, there, and everywhere,\\nand it's all for naught…",
    "FallarborTown_ContestHall_Text_SuperRankStage": "POKéMON CONTESTS\\nSUPER RANK STAGE!",
  },
};

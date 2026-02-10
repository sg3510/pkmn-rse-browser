// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "LavaridgeTown_Gym_B1F_OnTransition",
  },
  scripts: {
    "LavaridgeTown_Gym_B1F_OnTransition": [
      { cmd: "call", args: ["LavaridgeTown_Gym_B1F_EventScript_SetTrainerTempVars"] },
      { cmd: "call", args: ["LavaridgeTown_Gym_B1F_EventScript_CheckBuryTrainers"] },
      { cmd: "end" },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_SetTrainerTempVars": [
      { cmd: "setvar", args: ["VAR_TEMP_7", 0] },
      { cmd: "setvar", args: ["VAR_TEMP_8", 0] },
      { cmd: "setvar", args: ["VAR_TEMP_9", 0] },
      { cmd: "setvar", args: ["VAR_TEMP_A", 0] },
      { cmd: "goto_if_defeated", args: ["TRAINER_KEEGAN", "LavaridgeTown_Gym_B1F_EventScript_SetJaceTempVar"] },
      { cmd: "setvar", args: ["VAR_TEMP_7", 1] },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_SetJaceTempVar": [
      { cmd: "goto_if_defeated", args: ["TRAINER_JACE", "LavaridgeTown_Gym_B1F_EventScript_SetJeffTempVar"] },
      { cmd: "setvar", args: ["VAR_TEMP_8", 1] },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_SetJeffTempVar": [
      { cmd: "goto_if_defeated", args: ["TRAINER_JEFF", "LavaridgeTown_Gym_B1F_EventScript_SetEliTempVar"] },
      { cmd: "setvar", args: ["VAR_TEMP_9", 1] },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_SetEliTempVar": [
      { cmd: "goto_if_defeated", args: ["TRAINER_ELI", "LavaridgeTown_Gym_B1F_EventScript_EndSetTrainerTempVars"] },
      { cmd: "setvar", args: ["VAR_TEMP_A", 1] },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_EndSetTrainerTempVars": [
      { cmd: "return" },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_CheckBuryTrainers": [
      { cmd: "goto_if_defeated", args: ["TRAINER_KEEGAN", "LavaridgeTown_Gym_B1F_EventScript_CheckBuryJace"] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_KEEGAN", "MOVEMENT_TYPE_BURIED"] },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_CheckBuryJace": [
      { cmd: "goto_if_defeated", args: ["TRAINER_JACE", "LavaridgeTown_Gym_B1F_EventScript_CheckBuryJeff"] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_JACE", "MOVEMENT_TYPE_BURIED"] },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_CheckBuryJeff": [
      { cmd: "goto_if_defeated", args: ["TRAINER_JEFF", "LavaridgeTown_Gym_B1F_EventScript_CheckBuryEli"] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_JEFF", "MOVEMENT_TYPE_BURIED"] },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_CheckBuryEli": [
      { cmd: "goto_if_defeated", args: ["TRAINER_ELI", "LavaridgeTown_Gym_B1F_EventScript_EndCheckBuryTrainers"] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_ELI", "MOVEMENT_TYPE_BURIED"] },
    ],
    "LavaridgeTown_Gym_B1F_EventScript_EndCheckBuryTrainers": [
      { cmd: "return" },
    ],
  },
  movements: {
  },
  text: {
  },
};

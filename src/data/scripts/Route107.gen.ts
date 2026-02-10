// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route107_EventScript_Darrin": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DARRIN", "Route107_Text_DarrinIntro", "Route107_Text_DarrinDefeated"] },
      { cmd: "msgbox", args: ["Route107_Text_DarrinPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route107_EventScript_Tony": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TONY_1", "Route107_Text_TonyIntro", "Route107_Text_TonyDefeated", "Route107_EventScript_TonyRegisterMatchCallAfterBattle"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route107_EventScript_TonyRematch"] },
      { cmd: "msgbox", args: ["Route107_Text_TonyPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route107_EventScript_TonyRegisterMatchCallAfterBattle": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route107_Text_TonyRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_TONY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route107_EventScript_TonyRematch": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_TONY_1", "Route107_Text_TonyRematchIntro", "Route107_Text_TonyRematchDefeated"] },
      { cmd: "msgbox", args: ["Route107_Text_TonyRematchPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route107_EventScript_Denise": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DENISE", "Route107_Text_DeniseIntro", "Route107_Text_DeniseDefeated"] },
      { cmd: "msgbox", args: ["Route107_Text_DenisePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route107_EventScript_Beth": [
      { cmd: "trainerbattle_single", args: ["TRAINER_BETH", "Route107_Text_BethIntro", "Route107_Text_BethDefeated"] },
      { cmd: "msgbox", args: ["Route107_Text_BethPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route107_EventScript_Lisa": [
      { cmd: "trainerbattle_double", args: ["TRAINER_LISA_AND_RAY", "Route107_Text_LisaIntro", "Route107_Text_LisaDefeated", "Route107_Text_LisaNotEnoughPokemon"] },
      { cmd: "msgbox", args: ["Route107_Text_LisaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route107_EventScript_Ray": [
      { cmd: "trainerbattle_double", args: ["TRAINER_LISA_AND_RAY", "Route107_Text_RayIntro", "Route107_Text_RayDefeated", "Route107_Text_RayNotEnoughPokemon"] },
      { cmd: "msgbox", args: ["Route107_Text_RayPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route107_EventScript_Camron": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CAMRON", "Route107_Text_CamronIntro", "Route107_Text_CamronDefeated"] },
      { cmd: "msgbox", args: ["Route107_Text_CamronPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

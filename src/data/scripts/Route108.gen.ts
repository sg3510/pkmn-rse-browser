// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route108_EventScript_Jerome": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JEROME", "Route108_Text_JeromeIntro", "Route108_Text_JeromeDefeated"] },
      { cmd: "msgbox", args: ["Route108_Text_JeromePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route108_EventScript_Matthew": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MATTHEW", "Route108_Text_MatthewIntro", "Route108_Text_MatthewDefeated"] },
      { cmd: "msgbox", args: ["Route108_Text_MatthewPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route108_EventScript_Tara": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TARA", "Route108_Text_TaraIntro", "Route108_Text_TaraDefeated"] },
      { cmd: "msgbox", args: ["Route108_Text_TaraPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route108_EventScript_Missy": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MISSY", "Route108_Text_MissyIntro", "Route108_Text_MissyDefeated"] },
      { cmd: "msgbox", args: ["Route108_Text_MissyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route108_EventScript_Carolina": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CAROLINA", "Route108_Text_CarolinaIntro", "Route108_Text_CarolinaDefeated"] },
      { cmd: "msgbox", args: ["Route108_Text_CarolinaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route108_EventScript_Cory": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CORY_1", "Route108_Text_CoryIntro", "Route108_Text_CoryDefeated", "Route108_EventScript_CoryRegisterMatchCallAfterBattle"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route108_EventScript_CoryRematch"] },
      { cmd: "msgbox", args: ["Route108_Text_CoryPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route108_EventScript_CoryRegisterMatchCallAfterBattle": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route108_Text_CoryRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_CORY_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route108_EventScript_CoryRematch": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_CORY_1", "Route108_Text_CoryRematchIntro", "Route108_Text_CoryRematchDefeated"] },
      { cmd: "msgbox", args: ["Route108_Text_CoryRematchPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

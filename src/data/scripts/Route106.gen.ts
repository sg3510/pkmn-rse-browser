// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route106_EventScript_TrainerTipsSign": [
      { cmd: "msgbox", args: ["Route106_Text_TrainerTips", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route106_EventScript_Douglas": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DOUGLAS", "Route106_Text_DouglasIntro", "Route106_Text_DouglasDefeated"] },
      { cmd: "msgbox", args: ["Route106_Text_DouglasPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route106_EventScript_Kyla": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KYLA", "Route106_Text_KylaIntro", "Route106_Text_KylaDefeated"] },
      { cmd: "msgbox", args: ["Route106_Text_KylaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route106_EventScript_Elliot": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ELLIOT_1", "Route106_Text_ElliotIntro", "Route106_Text_ElliotDefeated", "Route106_EventScript_ElliotRegisterMatchCallAfterBattle"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route106_EventScript_ElliotRematch"] },
      { cmd: "msgbox", args: ["Route106_Text_ElliotPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route106_EventScript_ElliotRegisterMatchCallAfterBattle": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route106_Text_ElliotRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_ELLIOT_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route106_EventScript_ElliotRematch": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_ELLIOT_1", "Route106_Text_ElliotRematchIntro", "Route106_Text_ElliotRematchDefeated"] },
      { cmd: "msgbox", args: ["Route106_Text_ElliotRematchPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route106_EventScript_Ned": [
      { cmd: "trainerbattle_single", args: ["TRAINER_NED", "Route106_Text_NedIntro", "Route106_Text_NedDefeated"] },
      { cmd: "msgbox", args: ["Route106_Text_NedPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route106_Text_TrainerTips": "TRAINER TIPS\\pAdvice on catching POKéMON with a ROD:\\nPress the A Button if you get a bite.",
  },
};

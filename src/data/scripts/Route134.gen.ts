// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onResume: "Route134_OnResume",
  },
  scripts: {
    "Route134_OnResume": [
      { cmd: "setdivewarp", args: ["MAP_UNDERWATER_ROUTE134", 8, 6] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Jack": [
      { cmd: "trainerbattle_single", args: ["TRAINER_JACK", "Route134_Text_JackIntro", "Route134_Text_JackDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_JackPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Laurel": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LAUREL", "Route134_Text_LaurelIntro", "Route134_Text_LaurelDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_LaurelPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Alex": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ALEX", "Route134_Text_AlexIntro", "Route134_Text_AlexDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_AlexPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Aaron": [
      { cmd: "trainerbattle_single", args: ["TRAINER_AARON", "Route134_Text_AaronIntro", "Route134_Text_AaronDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_AaronPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Hitoshi": [
      { cmd: "trainerbattle_single", args: ["TRAINER_HITOSHI", "Route134_Text_HitoshiIntro", "Route134_Text_HitoshiDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_HitoshiPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Hudson": [
      { cmd: "trainerbattle_single", args: ["TRAINER_HUDSON", "Route134_Text_HudsonIntro", "Route134_Text_HudsonDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_HudsonPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Reyna": [
      { cmd: "trainerbattle_single", args: ["TRAINER_REYNA", "Route134_Text_ReynaIntro", "Route134_Text_ReynaDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_ReynaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Marley": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MARLEY", "Route134_Text_MarleyIntro", "Route134_Text_MarleyDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_MarleyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route134_EventScript_Kelvin": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KELVIN", "Route134_Text_KelvinIntro", "Route134_Text_KelvinDefeat"] },
      { cmd: "msgbox", args: ["Route134_Text_KelvinPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "MagmaHideout_1F_OnTransition",
  },
  scripts: {
    "MagmaHideout_1F_OnTransition": [
      { cmd: "setvar", args: ["VAR_JAGGED_PASS_ASH_WEATHER", 0] },
      { cmd: "end" },
    ],
    "MagmaHideout_1F_EventScript_Grunt1": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_MAGMA_HIDEOUT_1", "MagmaHideout_1F_Text_Grunt1Intro", "MagmaHideout_1F_Text_Grunt1Defeat"] },
      { cmd: "msgbox", args: ["MagmaHideout_1F_Text_Grunt1PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "MagmaHideout_1F_EventScript_Grunt2": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_MAGMA_HIDEOUT_2", "MagmaHideout_1F_Text_Grunt2Intro", "MagmaHideout_1F_Text_Grunt2Defeat"] },
      { cmd: "msgbox", args: ["MagmaHideout_1F_Text_Grunt2PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MagmaHideout_1F_Text_Grunt1Intro": "When TEAM MAGMA has roll call, we get\\nimportant guarding assignments in\\lthe order that we line up.\\pThat's why I'm stuck off in this corner.\\nI'm always late to roll call!",
    "MagmaHideout_1F_Text_Grunt1Defeat": "I'm always late for training sessions,\\ntoo!\\pI hate to say it, but I'm wimpy…",
    "MagmaHideout_1F_Text_Grunt1PostBattle": "Okay, I'll try to put a little more\\neffort into things from now on…",
    "MagmaHideout_1F_Text_Grunt2Intro": "Our leader told us to dig into\\nMT. CHIMNEY, so we dug and dug.\\pAnd in the course of digging, we came\\nacross something that blew our minds!\\pWhat did we find?\\pFuhahaha!\\nI'll tell you if you beat me!",
    "MagmaHideout_1F_Text_Grunt2Defeat": "Arrgh!\\nTaken down!",
    "MagmaHideout_1F_Text_Grunt2PostBattle": "I won't tell you after all.\\nYou'll find out when you get there!\\pIt'd be better if you saved surprises\\nto the end, don't you think?",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route110_TrickHousePuzzle4_EventScript_Scroll": [
      { cmd: "lockall" },
      { cmd: "goto_if_eq", args: ["VAR_TRICK_HOUSE_PUZZLE_4_STATE", 0, "Route110_TrickHousePuzzle4_EventScript_FoundScroll"] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_ReadScrollAgain"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle4_EventScript_FoundScroll": [
      { cmd: "setvar", args: ["VAR_TRICK_HOUSE_PUZZLE_4_STATE", 1] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_FoundScroll"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle4_EventScript_Cora": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CORA", "Route110_TrickHousePuzzle4_Text_CoraIntro", "Route110_TrickHousePuzzle4_Text_CoraDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle4_Text_CoraPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle4_EventScript_Yuji": [
      { cmd: "trainerbattle_single", args: ["TRAINER_YUJI", "Route110_TrickHousePuzzle4_Text_YujiIntro", "Route110_TrickHousePuzzle4_Text_YujiDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle4_Text_YujiPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle4_EventScript_Paula": [
      { cmd: "trainerbattle_single", args: ["TRAINER_PAULA", "Route110_TrickHousePuzzle4_Text_PaulaIntro", "Route110_TrickHousePuzzle4_Text_PaulaDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle4_Text_PaulaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route110_TrickHousePuzzle4_Text_WroteSecretCodeLockOpened": "{PLAYER} wrote down the secret code\\non the door.\\p“TRICK MASTER is cool.”\\n… … … … … … … …\\pThe lock clicked open!",
    "Route110_TrickHousePuzzle4_Text_CoraIntro": "It's too much bother to think this out.\\nI only wanted to battle!",
    "Route110_TrickHousePuzzle4_Text_CoraDefeat": "Even though I lost, I still like battling\\nthe best!",
    "Route110_TrickHousePuzzle4_Text_CoraPostBattle": "Wouldn't you agree? You would go\\nanywhere if TRAINERS were there.",
    "Route110_TrickHousePuzzle4_Text_YujiIntro": "Heh! Boulders like this, I can brush\\naside with one finger!",
    "Route110_TrickHousePuzzle4_Text_YujiDefeat": "I can push boulders, but I can't solve\\nthe puzzle…",
    "Route110_TrickHousePuzzle4_Text_YujiPostBattle": "It's not good enough to be brawny…\\nYou have to use your head. Be brainy!",
    "Route110_TrickHousePuzzle4_Text_PaulaIntro": "The TRICK HOUSE is getting trickier,\\nisn't it?",
    "Route110_TrickHousePuzzle4_Text_PaulaDefeat": "Aaak!",
    "Route110_TrickHousePuzzle4_Text_PaulaPostBattle": "Has anyone made it to the end?",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Route110_TrickHousePuzzle1_OnLoad",
  },
  scripts: {
    "Route110_TrickHousePuzzle1_OnLoad": [
      { cmd: "goto_if_eq", args: ["VAR_TRICK_HOUSE_PUZZLE_1_STATE", 2, "Route110_TrickHousePuzzle1_EventScript_OpenDoor"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle1_EventScript_OpenDoor": [
      { cmd: "setmetatile", args: [13, 1, "METATILE_TrickHousePuzzle_Stairs_Down", "FALSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle1_EventScript_Scroll": [
      { cmd: "lockall" },
      { cmd: "goto_if_eq", args: ["VAR_TRICK_HOUSE_PUZZLE_1_STATE", 0, "Route110_TrickHousePuzzle1_EventScript_FoundScroll"] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_ReadScrollAgain"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle1_EventScript_FoundScroll": [
      { cmd: "setvar", args: ["VAR_TRICK_HOUSE_PUZZLE_1_STATE", 1] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_FoundScroll"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle1_EventScript_Sally": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SALLY", "Route110_TrickHousePuzzle1_Text_SallyIntro", "Route110_TrickHousePuzzle1_Text_SallyDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle1_Text_SallyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle1_EventScript_Eddie": [
      { cmd: "trainerbattle_single", args: ["TRAINER_EDDIE", "Route110_TrickHousePuzzle1_Text_EddieIntro", "Route110_TrickHousePuzzle1_Text_EddieDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle1_Text_EddiePostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle1_EventScript_Robin": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ROBIN", "Route110_TrickHousePuzzle1_Text_RobinIntro", "Route110_TrickHousePuzzle1_Text_RobinDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle1_Text_RobinPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route110_TrickHousePuzzle1_Text_WroteSecretCodeLockOpened": "{PLAYER} wrote down the secret code\\non the door.\\p“TRICK MASTER is fabulous.”\\n… … … … … … … …\\pThe lock clicked open!",
    "Route110_TrickHousePuzzle1_Text_SallyIntro": "I'll hack and slash my way to victory\\nwith the CUT we just learned!",
    "Route110_TrickHousePuzzle1_Text_SallyDefeat": "Why are you so serious?",
    "Route110_TrickHousePuzzle1_Text_SallyPostBattle": "I never get tired of hacking\\nand slashing!",
    "Route110_TrickHousePuzzle1_Text_EddieIntro": "I wandered into this weird house\\nby accident…",
    "Route110_TrickHousePuzzle1_Text_EddieDefeat": "And now I've lost…",
    "Route110_TrickHousePuzzle1_Text_EddiePostBattle": "I lost my way, I lost a battle, and I'm\\nnow even more lost… I can't get out…",
    "Route110_TrickHousePuzzle1_Text_RobinIntro": "Just who is the TRICK MASTER?",
    "Route110_TrickHousePuzzle1_Text_RobinDefeat": "I lost while I was lost in thought!",
    "Route110_TrickHousePuzzle1_Text_RobinPostBattle": "You're strong!\\nJust who are you?",
  },
};

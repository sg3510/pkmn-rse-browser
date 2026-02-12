// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route110_TrickHousePuzzle6_OnTransition",
    onWarpInto: [
      { var: "VAR_TEMP_0", value: "VAR_TEMP_0", script: "Route110_TrickHousePuzzle6_EventScript_InitPuzzle" },
    ],
  },
  scripts: {
    "Route110_TrickHousePuzzle6_OnTransition": [
      { cmd: "special", args: ["RotatingGate_InitPuzzle"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle6_EventScript_InitPuzzle": [
      { cmd: "special", args: ["RotatingGate_InitPuzzleAndGraphics"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle6_EventScript_Scroll": [
      { cmd: "lockall" },
      { cmd: "goto_if_eq", args: ["VAR_TRICK_HOUSE_PUZZLE_6_STATE", 0, "Route110_TrickHousePuzzle6_EventScript_FoundScroll"] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_ReadScrollAgain"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle6_EventScript_FoundScroll": [
      { cmd: "setvar", args: ["VAR_TRICK_HOUSE_PUZZLE_6_STATE", 1] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_FoundScroll"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle6_EventScript_Sophia": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SOPHIA", "Route110_TrickHousePuzzle6_Text_SophiaIntro", "Route110_TrickHousePuzzle6_Text_SophiaDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle6_Text_SophiaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle6_EventScript_Benny": [
      { cmd: "trainerbattle_single", args: ["TRAINER_BENNY", "Route110_TrickHousePuzzle6_Text_BennyIntro", "Route110_TrickHousePuzzle6_Text_BennyDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle6_Text_BennyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle6_EventScript_Sebastian": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SEBASTIAN", "Route110_TrickHousePuzzle6_Text_SebastianIntro", "Route110_TrickHousePuzzle6_Text_SebastianDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle6_Text_SebastianPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route110_TrickHousePuzzle6_Text_WroteSecretCodeLockOpened": "{PLAYER} wrote down the secret code\\non the door.\\p“TRICK MASTER is my life.”\\n… … … … … … … …\\pThe lock clicked open!",
    "Route110_TrickHousePuzzle6_Text_SophiaIntro": "When I heard there was a strange\\nhouse, I had to check it out.",
    "Route110_TrickHousePuzzle6_Text_SophiaDefeat": "I've discovered a tough TRAINER!",
    "Route110_TrickHousePuzzle6_Text_SophiaPostBattle": "I'm sure having a good time checking\\nthis place out.\\pIt's a challenge I've found worth\\nrepeating!",
    "Route110_TrickHousePuzzle6_Text_BennyIntro": "Maybe I could get my BIRD POKéMON\\nto fly over the wall…",
    "Route110_TrickHousePuzzle6_Text_BennyDefeat": "Gwaaah! I blew it!",
    "Route110_TrickHousePuzzle6_Text_BennyPostBattle": "Ehehehe… I guess I lost because\\nI was trying to cheat.",
    "Route110_TrickHousePuzzle6_Text_SebastianIntro": "I'm getting dizzy from these rotating\\ndoors…",
    "Route110_TrickHousePuzzle6_Text_SebastianDefeat": "Everything's spinning around and\\naround. I can't take this anymore…",
    "Route110_TrickHousePuzzle6_Text_SebastianPostBattle": "You don't seem to be affected at all.\\nOr do you have your poker face on?",
  },
};

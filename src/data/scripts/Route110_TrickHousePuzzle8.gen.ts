// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route110_TrickHousePuzzle8_EventScript_Scroll": [
      { cmd: "lockall" },
      { cmd: "goto_if_eq", args: ["VAR_TRICK_HOUSE_PUZZLE_8_STATE", 0, "Route110_TrickHousePuzzle8_EventScript_FoundScroll"] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_ReadScrollAgain"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle8_EventScript_FoundScroll": [
      { cmd: "setvar", args: ["VAR_TRICK_HOUSE_PUZZLE_8_STATE", 1] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_FoundScroll"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle8_EventScript_Vincent": [
      { cmd: "trainerbattle_single", args: ["TRAINER_VINCENT", "Route110_TrickHousePuzzle8_Text_VincentIntro", "Route110_TrickHousePuzzle8_Text_VincentDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle8_Text_VincentPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle8_EventScript_Keira": [
      { cmd: "trainerbattle_single", args: ["TRAINER_KEIRA", "Route110_TrickHousePuzzle8_Text_KeiraIntro", "Route110_TrickHousePuzzle8_Text_KeiraDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle8_Text_KeiraPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle8_EventScript_Leroy": [
      { cmd: "trainerbattle_single", args: ["TRAINER_LEROY", "Route110_TrickHousePuzzle8_Text_LeroyIntro", "Route110_TrickHousePuzzle8_Text_LeroyDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle8_Text_LeroyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route110_TrickHousePuzzle8_Text_WroteSecretCodeLockOpened": "{PLAYER} wrote down the secret code\\non the door.\\p“TRICK MASTER I love.”\\n… … … … … … … …\\pThe lock clicked open!",
    "Route110_TrickHousePuzzle8_Text_VincentIntro": "Not many TRAINERS have made it\\nthis far.",
    "Route110_TrickHousePuzzle8_Text_VincentDefeat": "That must mean you're tough, too…",
    "Route110_TrickHousePuzzle8_Text_VincentPostBattle": "You've beaten the POKéMON LEAGUE\\nCHAMPION? That's too much!",
    "Route110_TrickHousePuzzle8_Text_KeiraIntro": "Consider yourself lucky to be\\nbattling me!",
    "Route110_TrickHousePuzzle8_Text_KeiraDefeat": "This isn't right!\\nI can't lose!",
    "Route110_TrickHousePuzzle8_Text_KeiraPostBattle": "It's a miracle that you beat me.\\nYou can brag about it.",
    "Route110_TrickHousePuzzle8_Text_LeroyIntro": "You've been slugging through the TRICK\\nHOUSE challenge, too.",
    "Route110_TrickHousePuzzle8_Text_LeroyDefeat": "I see…\\nYou possess an extraordinary style.",
    "Route110_TrickHousePuzzle8_Text_LeroyPostBattle": "Seeing someone like you should please\\nthe TRICK MASTER.",
  },
};

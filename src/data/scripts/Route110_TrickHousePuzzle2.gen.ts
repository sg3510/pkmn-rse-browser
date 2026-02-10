// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route110_TrickHousePuzzle2_OnTransition",
    onResume: "Route110_TrickHousePuzzle2_OnResume",
  },
  scripts: {
    "Route110_TrickHousePuzzle2_OnResume": [
      { cmd: "call_if_eq", args: ["VAR_TEMP_1", 1, "Route110_TrickHousePuzzle2_EventScript_PressButton1"] },
      { cmd: "call_if_eq", args: ["VAR_TEMP_2", 1, "Route110_TrickHousePuzzle2_EventScript_PressButton2"] },
      { cmd: "call_if_eq", args: ["VAR_TEMP_3", 1, "Route110_TrickHousePuzzle2_EventScript_PressButton3"] },
      { cmd: "call_if_eq", args: ["VAR_TEMP_4", 1, "Route110_TrickHousePuzzle2_EventScript_PressButton4"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_OnTransition": [
      { cmd: "setvar", args: ["VAR_TEMP_1", 0] },
      { cmd: "setvar", args: ["VAR_TEMP_2", 0] },
      { cmd: "setvar", args: ["VAR_TEMP_3", 0] },
      { cmd: "setvar", args: ["VAR_TEMP_4", 0] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_Scroll": [
      { cmd: "lockall" },
      { cmd: "goto_if_eq", args: ["VAR_TRICK_HOUSE_PUZZLE_2_STATE", 0, "Route110_TrickHousePuzzle2_EventScript_FoundScroll"] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_ReadScrollAgain"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_FoundScroll": [
      { cmd: "setvar", args: ["VAR_TRICK_HOUSE_PUZZLE_2_STATE", 1] },
      { cmd: "goto", args: ["Route110_TrickHousePuzzle_EventScript_FoundScroll"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_Button1": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "call", args: ["Route110_TrickHousePuzzle2_EventScript_PressButton1"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_Button2": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_TEMP_2", 1] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "call", args: ["Route110_TrickHousePuzzle2_EventScript_PressButton2"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_Button3": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_TEMP_3", 1] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "call", args: ["Route110_TrickHousePuzzle2_EventScript_PressButton3"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_Button4": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_TEMP_4", 1] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "call", args: ["Route110_TrickHousePuzzle2_EventScript_PressButton4"] },
      { cmd: "special", args: ["DrawWholeMapView"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_PressButton1": [
      { cmd: "setmetatile", args: [11, 12, "METATILE_TrickHousePuzzle_Button_Pressed", "FALSE"] },
      { cmd: "setmetatile", args: [1, 13, "METATILE_TrickHousePuzzle_Door_Shuttered", "FALSE"] },
      { cmd: "return" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_PressButton2": [
      { cmd: "setmetatile", args: [0, 4, "METATILE_TrickHousePuzzle_Button_Pressed", "FALSE"] },
      { cmd: "setmetatile", args: [5, 6, "METATILE_TrickHousePuzzle_Door_Shuttered", "FALSE"] },
      { cmd: "return" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_PressButton3": [
      { cmd: "setmetatile", args: [14, 5, "METATILE_TrickHousePuzzle_Button_Pressed", "FALSE"] },
      { cmd: "setmetatile", args: [7, 15, "METATILE_TrickHousePuzzle_Door_Shuttered", "FALSE"] },
      { cmd: "return" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_PressButton4": [
      { cmd: "setmetatile", args: [7, 11, "METATILE_TrickHousePuzzle_Button_Pressed", "FALSE"] },
      { cmd: "setmetatile", args: [14, 12, "METATILE_TrickHousePuzzle_Door_Shuttered", "FALSE"] },
      { cmd: "return" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_Ted": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TED", "Route110_TrickHousePuzzle2_Text_TedIntro", "Route110_TrickHousePuzzle2_Text_TedDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle2_Text_TedPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_Paul": [
      { cmd: "trainerbattle_single", args: ["TRAINER_PAUL", "Route110_TrickHousePuzzle2_Text_PaulIntro", "Route110_TrickHousePuzzle2_Text_PaulDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle2_Text_PaulPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route110_TrickHousePuzzle2_EventScript_Georgia": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GEORGIA", "Route110_TrickHousePuzzle2_Text_GeorgiaIntro", "Route110_TrickHousePuzzle2_Text_GeorgiaDefeat"] },
      { cmd: "msgbox", args: ["Route110_TrickHousePuzzle2_Text_GeorgiaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route110_TrickHousePuzzle2_Text_WroteSecretCodeLockOpened": "{PLAYER} wrote down the secret code\\non the door.\\p“TRICK MASTER is smart.”\\n… … … … … … … …\\pThe lock clicked open!",
    "Route110_TrickHousePuzzle2_Text_TedIntro": "Which switch closes which hole?",
    "Route110_TrickHousePuzzle2_Text_TedDefeat": "After that battle, I'm even more\\nconfused!",
    "Route110_TrickHousePuzzle2_Text_TedPostBattle": "Can I get you to push all the buttons\\nfor me?",
    "Route110_TrickHousePuzzle2_Text_PaulIntro": "Oh! You're on your second TRICK HOUSE\\nchallenge!",
    "Route110_TrickHousePuzzle2_Text_PaulDefeat": "You're good at battling too?",
    "Route110_TrickHousePuzzle2_Text_PaulPostBattle": "The TRICK MASTER rigged all the tricks\\nin this house all by himself.",
    "Route110_TrickHousePuzzle2_Text_GeorgiaIntro": "I want to make my own GYM one day.\\nSo, I'm studying how to set traps.",
    "Route110_TrickHousePuzzle2_Text_GeorgiaDefeat": "I didn't study battling enough!",
    "Route110_TrickHousePuzzle2_Text_GeorgiaPostBattle": "You're strong, aren't you?\\nMaybe even enough to be a GYM LEADER!",
  },
};

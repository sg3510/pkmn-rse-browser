// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route102_EventScript_LittleBoy": [
      { cmd: "msgbox", args: ["Route102_Text_ImNotVeryTall", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route102_EventScript_RouteSignOldale": [
      { cmd: "msgbox", args: ["Route102_Text_RouteSignOldale", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route102_EventScript_RouteSignPetalburg": [
      { cmd: "msgbox", args: ["Route102_Text_RouteSignPetalburg", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route102_EventScript_Boy": [
      { cmd: "msgbox", args: ["Route102_Text_CatchWholeBunchOfPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route102_EventScript_Calvin": [
      { cmd: "trainerbattle_single", args: ["TRAINER_CALVIN_1", "Route102_Text_CalvinIntro", "Route102_Text_CalvinDefeated", "Route102_EventScript_CalvinRegisterMatchCallAfterBattle"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route102_EventScript_CalvinRematch"] },
      { cmd: "setvar", args: ["VAR_0x8004", "TRAINER_CALVIN_1"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "IsTrainerRegistered"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Route102_EventScript_CalvinTryRegister"] },
      { cmd: "msgbox", args: ["Route102_Text_CalvinPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route102_EventScript_CalvinRegisterMatchCallAfterBattle": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "goto_if_set", args: ["FLAG_HAS_MATCH_CALL", "Route102_EventScript_CalvinRegisterMatchCall"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route102_EventScript_CalvinRegisterMatchCall": [
      { cmd: "msgbox", args: ["Route102_Text_CalvinRegisterShort", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_CALVIN_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route102_EventScript_CalvinTryRegister": [
      { cmd: "goto_if_set", args: ["FLAG_HAS_MATCH_CALL", "Route102_EventScript_CalvinRegister"] },
      { cmd: "msgbox", args: ["Route102_Text_CalvinPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route102_EventScript_CalvinRegister": [
      { cmd: "msgbox", args: ["Route102_Text_CalvinRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_CALVIN_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route102_EventScript_CalvinRematch": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_CALVIN_1", "Route102_Text_CalvinRematchIntro", "Route102_Text_CalvinRematchDefeated"] },
      { cmd: "msgbox", args: ["Route102_Text_CalvinRematchPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route102_EventScript_Rick": [
      { cmd: "trainerbattle_single", args: ["TRAINER_RICK", "Route102_Text_RickIntro", "Route102_Text_RickDefeated"] },
      { cmd: "msgbox", args: ["Route102_Text_RickPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route102_EventScript_Tiana": [
      { cmd: "trainerbattle_single", args: ["TRAINER_TIANA", "Route102_Text_TianaIntro", "Route102_Text_TianaDefeated"] },
      { cmd: "msgbox", args: ["Route102_Text_TianaPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "Route102_EventScript_Allen": [
      { cmd: "trainerbattle_single", args: ["TRAINER_ALLEN", "Route102_Text_AllenIntro", "Route102_Text_AllenDefeated"] },
      { cmd: "msgbox", args: ["Route102_Text_AllenPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route102_Text_WatchMeCatchPokemon": "WALLY: {PLAYER}…\\nPOKéMON hide in tall grass like this,\\ldon't they?\\pPlease watch me and see if I can\\ncatch one properly.\\p…Whoa!",
    "Route102_Text_WallyIDidIt": "WALLY: I did it… It's my…\\nMy POKéMON!",
    "Route102_Text_LetsGoBack": "{PLAYER}, thank you!\\nLet's go back to the GYM!",
    "Route102_Text_ImNotVeryTall": "I'm…not very tall, so I sink right\\ninto tall grass.\\pThe grass goes up my nose and…\\nFwafwafwafwafwa…\\pFwatchoo!",
    "Route102_Text_CatchWholeBunchOfPokemon": "I'm going to catch a whole bunch of\\nPOKéMON!",
    "Route102_Text_RouteSignOldale": "ROUTE 102\\n{RIGHT_ARROW} OLDALE TOWN",
    "Route102_Text_RouteSignPetalburg": "ROUTE 102\\n{LEFT_ARROW} PETALBURG CITY",
  },
};

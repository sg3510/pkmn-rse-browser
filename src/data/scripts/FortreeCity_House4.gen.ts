// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FortreeCity_House4_EventScript_Woman": [
      { cmd: "msgbox", args: ["FortreeCity_House4_Text_BringsWorldCloserTogether", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_House4_EventScript_Boy": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_MENTAL_HERB", "FortreeCity_House4_EventScript_ReceivedMentalHerb"] },
      { cmd: "goto_if_set", args: ["FLAG_WINGULL_DELIVERED_MAIL", "FortreeCity_House4_EventScript_WingullReturned"] },
      { cmd: "goto_if_set", args: ["FLAG_WINGULL_SENT_ON_ERRAND", "FortreeCity_House4_EventScript_WingullOnErrand"] },
      { cmd: "msgbox", args: ["FortreeCity_House4_Text_GoBirdPokemon", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "setflag", args: ["FLAG_WINGULL_SENT_ON_ERRAND"] },
      { cmd: "clearflag", args: ["FLAG_HIDE_MOSSDEEP_CITY_HOUSE_2_WINGULL"] },
      { cmd: "applymovement", args: ["LOCALID_FORTREE_HOUSE_WINGULL", "FortreeCity_House4_Movement_WingullExit"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "removeobject", args: ["LOCALID_FORTREE_HOUSE_WINGULL"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "FortreeCity_House4_EventScript_WingullOnErrand": [
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["FortreeCity_House4_Text_AskedWingullToRunErrand", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "FortreeCity_House4_EventScript_WingullReturned": [
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["FortreeCity_House4_Text_WelcomeWingullTakeMentalHerb", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_MENTAL_HERB"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_MENTAL_HERB"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "FortreeCity_House4_EventScript_ReceivedMentalHerb": [
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["FortreeCity_House4_Text_FriendsFarAwayThanksToWingull", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "FortreeCity_House4_EventScript_Wingull": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_WINGULL", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["FortreeCity_House4_Text_Wingull", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
    "FortreeCity_House4_Movement_WingullExit": ["walk_fast_down", "walk_fast_down", "walk_fast_right", "walk_in_place_faster_down", "delay_8"],
  },
  text: {
    "FortreeCity_House4_Text_BringsWorldCloserTogether": "By being together with POKéMON,\\npeople make more and more friends.\\pAnd that brings the world closer\\ntogether. I think it's wonderful!",
    "FortreeCity_House4_Text_GoBirdPokemon": "There!\\nGo, BIRD POKéMON!",
    "FortreeCity_House4_Text_AskedWingullToRunErrand": "Heheh, I asked my WINGULL to run\\nan errand for me.",
    "FortreeCity_House4_Text_WelcomeWingullTakeMentalHerb": "Good!\\nWelcome back, WINGULL!\\pHuh? What is this?\\nWhat is it holding?\\pA MENTAL HERB?\\nIt must have picked it up somewhere.\\pBut I'm not a TRAINER, so you can\\nhave it.",
    "FortreeCity_House4_Text_FriendsFarAwayThanksToWingull": "Thanks to my WINGULL, I have friends\\nwho live far away.",
    "FortreeCity_House4_Text_Wingull": "WINGULL: Pihyoh!",
  },
};

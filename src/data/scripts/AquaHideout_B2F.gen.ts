// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "AquaHideout_B2F_OnTransition",
  },
  scripts: {
    "AquaHideout_B2F_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_TEAM_AQUA_ESCAPED_IN_SUBMARINE", "AquaHideout_B2F_EventScript_PreventMattNoticing"] },
      { cmd: "end" },
    ],
    "AquaHideout_B2F_EventScript_PreventMattNoticing": [
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "return" },
    ],
    "AquaHideout_B2F_EventScript_MattNoticePlayer": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8008", "LOCALID_AQUA_HIDEOUT_MATT"] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "applymovement", args: ["VAR_0x8008", "Common_Movement_ExclamationMark"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["VAR_0x8008", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AquaHideout_B2F_EventScript_Matt": [
      { cmd: "trainerbattle_single", args: ["TRAINER_MATT", "AquaHideout_B2F_Text_MattIntro", "AquaHideout_B2F_Text_MattDefeat", "AquaHideout_B2F_EventScript_SubmarineEscape"] },
      { cmd: "msgbox", args: ["AquaHideout_B2F_Text_MattPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_B2F_EventScript_SubmarineEscape": [
      { cmd: "setvar", args: ["VAR_0x8008", "LOCALID_AQUA_HIDEOUT_MATT"] },
      { cmd: "setvar", args: ["VAR_0x8009", "LOCALID_AQUA_HIDEOUT_SUBMARINE"] },
      { cmd: "applymovement", args: ["VAR_0x8008", "Common_Movement_WalkInPlaceFasterLeft"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [20] },
      { cmd: "applymovement", args: ["VAR_0x8008", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["AquaHideout_B2F_Text_OurBossGotThroughHisPreparations", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["VAR_0x8008", "Common_Movement_WalkInPlaceFasterLeft"] },
      { cmd: "applymovement", args: ["VAR_0x8009", "AquaHideout_B2F_Movement_SumbarineDepartLeft"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "removeobject", args: ["VAR_0x8009"] },
      { cmd: "delay", args: [20] },
      { cmd: "applymovement", args: ["VAR_0x8008", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["AquaHideout_B2F_Text_MattPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_TEAM_AQUA_ESCAPED_IN_SUBMARINE"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LILYCOVE_CITY_AQUA_GRUNTS"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_B2F_EventScript_Grunt4": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_AQUA_HIDEOUT_4", "AquaHideout_B2F_Text_Grunt4Intro", "AquaHideout_B2F_Text_Grunt4Defeat", "AquaHideout_B2F_EventScript_Grunt4Defeated"] },
      { cmd: "msgbox", args: ["AquaHideout_B2F_Text_Grunt4PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "AquaHideout_B2F_EventScript_Grunt4Defeated": [
      { cmd: "msgbox", args: ["AquaHideout_B2F_Text_Grunt4PostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AquaHideout_B2F_EventScript_Grunt6": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_AQUA_HIDEOUT_6", "AquaHideout_B2F_Text_Grunt6Intro", "AquaHideout_B2F_Text_Grunt6Defeat"] },
      { cmd: "msgbox", args: ["AquaHideout_B2F_Text_Grunt6PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "AquaHideout_B2F_EventScript_Grunt8": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_AQUA_HIDEOUT_8", "AquaHideout_B2F_Text_Grunt8Intro", "AquaHideout_B2F_Text_Grunt8Defeat"] },
      { cmd: "msgbox", args: ["AquaHideout_B2F_Text_Grunt8PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "AquaHideout_B2F_Movement_SumbarineDepartLeft": ["walk_left", "walk_left", "walk_left", "walk_left"],
    "AquaHideout_B2F_Movement_SumbarineDepartRight": ["walk_right", "walk_right", "walk_right", "walk_right"],
  },
  text: {
    "AquaHideout_B2F_Text_MattIntro": "Hehehe…\\pGot here already, did you?\\nWe underestimated you!\\pBut this is it!\\pI'm a cut above the GRUNTS you've seen\\nso far.\\pI'm not stalling for time.\\nI'm going to pulverize you!",
    "AquaHideout_B2F_Text_MattDefeat": "Hehehe…\\nSo, I lost, too…",
    "AquaHideout_B2F_Text_OurBossGotThroughHisPreparations": "Hehehe!\\pWhile I was toying with you, our BOSS\\ngot through his preparations!",
    "AquaHideout_B2F_Text_MattPostBattle": "Hehehe!\\pOur BOSS has already gone on his way to\\nsome cave under the sea!\\pIf you're going to give chase, you'd\\nbetter search the big, wide sea beyond\\lLILYCOVE.\\pBut will you find it then?\\nHehehe!",
    "AquaHideout_B2F_Text_Grunt4Intro": "Wahahah, I grew weary of waiting!\\nYou owe me a battle, too!",
    "AquaHideout_B2F_Text_Grunt4Defeat": "Tired of waiting…\\nLost and dazed…",
    "AquaHideout_B2F_Text_Grunt4PostBattle": "BOSS…\\nIs this good enough?",
    "AquaHideout_B2F_Text_Grunt6Intro": "Warp panels, the HIDEOUT's pride\\nand joy!\\pYou're clueless about where you are,\\naren't you?\\pFluster and tire out the enemy, then\\nlower the boom! That's our plan!",
    "AquaHideout_B2F_Text_Grunt6Defeat": "What's wrong with you?\\nYou're not tired at all!",
    "AquaHideout_B2F_Text_Grunt6PostBattle": "That reminds me… I can't remember\\nwhere I put the MASTER BALL.\\pIf I fail to guard it, our BOSS will\\nchew me out…",
    "AquaHideout_B2F_Text_Grunt8Intro": "When I joined TEAM AQUA, the first\\nthing I had to learn was how these\\lwarp panels connected.",
    "AquaHideout_B2F_Text_Grunt8Defeat": "I was too occupied thinking about\\nthe warp panels…",
    "AquaHideout_B2F_Text_Grunt8PostBattle": "I'll have to learn about how I can\\nbattle more effectively…",
  },
};

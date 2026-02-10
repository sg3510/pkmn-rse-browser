// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "VerdanturfTown_WandasHouse_EventScript_Wally": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_WALLY_SPEECH", "VerdanturfTown_WandasHouse_EventScript_WallyShortSpeech"] },
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_StrongerSpeech", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_WALLY_SPEECH"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WallyShortSpeech": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_StrongerSpeechShort", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WallysUncle": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_WALLY_VICTORY_ROAD", "VerdanturfTown_WandasHouse_EventScript_WallysUncleEverGrande"] },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_LAVARIDGE_GYM", "VerdanturfTown_WandasHouse_EventScript_WallysUncleSlippedOff"] },
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_WallysNextDoor", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WallysUncleSlippedOff": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_WallySlippedOff", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WallysUncleEverGrande": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_WallyGoneThatFar", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WandasBoyfriend": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_CanSeeGirlfriendEveryDay", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_Wanda": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_LAVARIDGE_GYM", "VerdanturfTown_WandasHouse_EventScript_WandaDontWorry"] },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_WALLY_MAUVILLE", "VerdanturfTown_WandasHouse_EventScript_MeetWanda"] },
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_DontWorryAboutWally", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_MeetWanda": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_MeetWanda", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WandaDontWorry": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_DontWorryAboutWally", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WallysAunt": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_WALLY_VICTORY_ROAD", "VerdanturfTown_WandasHouse_EventScript_WallysAuntEverGrande"] },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_LAVARIDGE_GYM", "VerdanturfTown_WandasHouse_EventScript_WallysAuntAnythingHappened"] },
      { cmd: "goto_if_set", args: ["FLAG_RUSTURF_TUNNEL_OPENED", "VerdanturfTown_WandasHouse_EventScript_WallysAuntTunnelOpen"] },
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_DaughtersBoyfriendDriven", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WallysAuntTunnelOpen": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_DaughtersBoyfriendWasDigging", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WallysAuntAnythingHappened": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_IfAnythingHappenedToWally", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_WandasHouse_EventScript_WallysAuntEverGrande": [
      { cmd: "msgbox", args: ["VerdanturfTown_WandasHouse_Text_WallyWasInEverGrande", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "VerdanturfTown_WandasHouse_Text_StrongerSpeech": "WALLY: I lost to you, {PLAYER}, but I'm\\nnot feeling down anymore.\\pBecause I have a new purpose in life.\\nTogether with my RALTS, I'm going\\lto challenge POKéMON GYMS and become\\la great TRAINER.\\pPlease watch me, {PLAYER}.\\nI'm going to be stronger than you.\\pWhen I do, I'm going to challenge you\\nto another battle.",
    "VerdanturfTown_WandasHouse_Text_StrongerSpeechShort": "WALLY: Please watch me, {PLAYER}.\\nI'm going to get stronger than you.\\pWhen I do, I'm going to challenge you\\nto another battle.",
    "VerdanturfTown_WandasHouse_Text_WallysNextDoor": "UNCLE: Oh! {PLAYER}{KUN}!\\nWALLY's next door.\\pBut, boy, there's something I have to\\ntell you.\\pThis natural environment is doing\\nwonders for WALLY's health.\\pMaybe it's not just the environment.\\nIt could be POKéMON that are giving\\lthe boy hope.",
    "VerdanturfTown_WandasHouse_Text_WallySlippedOff": "WALLY's gone away…\\nHe slipped off on his own…",
    "VerdanturfTown_WandasHouse_Text_WallyGoneThatFar": "UNCLE: Is that right?\\nWALLY's gone away that far all by\\lhimself…\\pWell, I have to give him credit--he is\\nmy little brother's son.",
    "VerdanturfTown_WandasHouse_Text_MeetWanda": "WANDA: You are?\\nOh, right, I get it!\\pYou're the {PLAYER} who WALLY was\\ntelling me about.\\pI'm WALLY's cousin.\\nGlad to meet you!\\pI think WALLY's become a lot more lively\\nand healthy since he came here.",
    "VerdanturfTown_WandasHouse_Text_DontWorryAboutWally": "WANDA: Don't worry about WALLY.\\nHe'll be just fine.\\pI know my little cousin, and he has\\nPOKéMON with him, too.",
    "VerdanturfTown_WandasHouse_Text_CanSeeGirlfriendEveryDay": "Thanks to you, I can see my girlfriend\\nevery day.\\lHappy? You bet I am!",
    "VerdanturfTown_WandasHouse_Text_DaughtersBoyfriendDriven": "My daughter's boyfriend is a very\\ndriven and passionate sort of person.\\pHe's been digging a tunnel nonstop\\njust so he can see my daughter.\\pMy daughter's a little concerned,\\nso she goes out to the tunnel a lot.",
    "VerdanturfTown_WandasHouse_Text_DaughtersBoyfriendWasDigging": "It's amazing. My daughter's boyfriend\\nwas digging the tunnel by hand!\\pIt's so incredible!",
    "VerdanturfTown_WandasHouse_Text_IfAnythingHappenedToWally": "If anything were to happen to WALLY,\\nI would never be able to look his\\lparents in PETALBURG in the eye…",
    "VerdanturfTown_WandasHouse_Text_WallyWasInEverGrande": "WALLY was in EVER GRANDE?\\pHis parents in PETALBURG would be\\nastonished to hear that!",
  },
};

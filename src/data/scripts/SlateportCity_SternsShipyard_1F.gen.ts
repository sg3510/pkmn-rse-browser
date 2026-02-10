// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SlateportCity_SternsShipyard_1F_EventScript_Dock": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_SYS_GAME_CLEAR", "SlateportCity_SternsShipyard_1F_EventScript_FerryReady"] },
      { cmd: "goto_if_set", args: ["FLAG_BADGE07_GET", "SlateportCity_SternsShipyard_1F_EventScript_BrineyJoined"] },
      { cmd: "goto_if_set", args: ["FLAG_DELIVERED_DEVON_GOODS", "SlateportCity_SternsShipyard_1F_EventScript_NeedVeteran"] },
      { cmd: "goto_if_set", args: ["FLAG_DOCK_REJECTED_DEVON_GOODS", "SlateportCity_SternsShipyard_1F_EventScript_GoFindStern"] },
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_CantMakeHeadsOrTails", "MSGBOX_DEFAULT"] },
      { cmd: "applymovement", args: ["LOCALID_DOCK", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_MeetDockDeliverToStern", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_DOCK", "Common_Movement_FaceOriginalDirection"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setflag", args: ["FLAG_DOCK_REJECTED_DEVON_GOODS"] },
      { cmd: "setflag", args: ["FLAG_HIDE_SLATEPORT_CITY_TEAM_AQUA"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SlateportCity_SternsShipyard_1F_EventScript_FerryReady": [
      { cmd: "applymovement", args: ["LOCALID_DOCK", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_FerryIsReady", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SlateportCity_SternsShipyard_1F_EventScript_BrineyJoined": [
      { cmd: "applymovement", args: ["LOCALID_DOCK", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_BrineyJoinedUs", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SlateportCity_SternsShipyard_1F_EventScript_GoFindStern": [
      { cmd: "applymovement", args: ["LOCALID_DOCK", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_CouldYouFindStern", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_DOCK", "Common_Movement_FaceOriginalDirection"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SlateportCity_SternsShipyard_1F_EventScript_NeedVeteran": [
      { cmd: "applymovement", args: ["LOCALID_DOCK", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_CouldUseAdviceFromVeteran", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "SlateportCity_SternsShipyard_1F_EventScript_Scientist1": [
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_SeaIsLikeLivingThing", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SlateportCity_SternsShipyard_1F_EventScript_Scientist2": [
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_GetSeasickEasily", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SlateportCity_SternsShipyard_1F_EventScript_Briney": [
      { cmd: "msgbox", args: ["SlateportCity_SternsShipyard_1F_Text_DecidedToHelpDock", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SlateportCity_SternsShipyard_1F_Text_CantMakeHeadsOrTails": "Umm… If this goes here, and that\\ngoes over there…\\pThen where does this thing go?\\nAnd what about that doohickey?\\pAaargh! I can't make heads or tails\\nof this!",
    "SlateportCity_SternsShipyard_1F_Text_MeetDockDeliverToStern": "Hm?\\nHi, I'm DOCK.\\pCAPT. STERN commissioned me to\\ndesign a ferry.\\pOh! That there…\\nAre they DEVON GOODS?\\pBut, hmm…\\nThis won't do…\\pCAPT. STERN went off somewhere.\\nHe said he had some work to do.\\pCould I get you to go find CAPT.\\nSTERN and deliver that to him?",
    "SlateportCity_SternsShipyard_1F_Text_CouldYouFindStern": "DOCK: Where could CAPT. STERN have\\ngone off to?\\pCould you go find CAPT. STERN and\\ndeliver that parcel to him?",
    "SlateportCity_SternsShipyard_1F_Text_CouldUseAdviceFromVeteran": "DOCK: Shipbuilding is an art.\\pA lot of things can't be figured out\\njust by calculating.\\pI really could use advice from a veteran\\nwho knows the seas…",
    "SlateportCity_SternsShipyard_1F_Text_BrineyJoinedUs": "DOCK: Hi! MR. BRINEY's joined us to\\nlend us his help.\\pThanks to the veteran sailor, the\\nferry is steadily coming together.",
    "SlateportCity_SternsShipyard_1F_Text_FerryIsReady": "DOCK: The ferry is finally ready!\\pThe new S.S. TIDAL is truly a marvel\\nof technology!\\pBut, I get the feeling that we can\\nmake something even better.\\pYou know, there's never an end to\\ntechnology's march.",
    "SlateportCity_SternsShipyard_1F_Text_DecidedToHelpDock": "MR. BRINEY: Ah, {PLAYER}{KUN}!\\nIt's been too long!\\pAye, since I met you, this old sea dog's\\nbeen feeling frisky!\\pSo I've decided to help DOCK make\\na ferry.\\pAye, after all, a ferry would be able\\nto carry a lot of people.\\pBut, you know, that DOCK is really\\nsomething special.\\pWith his knack for technology and\\nmy experience, I'm sure that we can\\lbuild one great ship, aye!",
    "SlateportCity_SternsShipyard_1F_Text_SeaIsLikeLivingThing": "The seasons, the weather, where\\nthe moon sits in the sky…\\pThese and other conditions make\\nthe sea change its expression.\\pThat's right!\\nThe sea is like a living thing!",
    "SlateportCity_SternsShipyard_1F_Text_GetSeasickEasily": "I get seasick real easily.\\nSo I get to help out here instead.",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_PETALBURG_CITY_STATE", value: 4, script: "PetalburgCity_WallysHouse_EventScript_GiveHMSurf" },
    ],
    onWarpInto: [
      { var: "VAR_PETALBURG_CITY_STATE", value: 4, script: "PetalburgCity_WallysHouse_EventScript_PlayerWallysDadFaceEachOther" },
    ],
  },
  scripts: {
    "PetalburgCity_WallysHouse_EventScript_PlayerWallysDadFaceEachOther": [
      { cmd: "turnobject", args: ["LOCALID_PLAYER", "DIR_EAST"] },
      { cmd: "turnobject", args: ["LOCALID_WALLYS_HOUSE_WALLYS_DAD", "DIR_WEST"] },
      { cmd: "end" },
    ],
    "PetalburgCity_WallysHouse_EventScript_GiveHMSurf": [
      { cmd: "lockall" },
      { cmd: "msgbox", args: ["PetalburgCity_WallysHouse_Text_PleaseExcuseUs", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_HM_SURF"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_HM_SURF"] },
      { cmd: "msgbox", args: ["PetalburgCity_WallysHouse_Text_SurfGoAllSortsOfPlaces", "MSGBOX_DEFAULT"] },
      { cmd: "setvar", args: ["VAR_PETALBURG_CITY_STATE", 5] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "PetalburgCity_WallysHouse_EventScript_WallysDad": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_WALLY_VICTORY_ROAD", "PetalburgCity_WallysHouse_EventScript_DefeatedWallyInVictoryRoad"] },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_HM_SURF", "PetalburgCity_WallysHouse_EventScript_ReceievedHMSurf"] },
      { cmd: "goto_if_set", args: ["FLAG_THANKED_FOR_PLAYING_WITH_WALLY", "PetalburgCity_WallysHouse_EventScript_PlayedWithWally"] },
      { cmd: "msgbox", args: ["PetalburgCity_WallysHouse_Text_ThanksForPlayingWithWally", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_THANKED_FOR_PLAYING_WITH_WALLY"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_WallysHouse_EventScript_ReceievedHMSurf": [
      { cmd: "msgbox", args: ["PetalburgCity_WallysHouse_Text_WallyIsComingHomeSoon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_WallysHouse_EventScript_DefeatedWallyInVictoryRoad": [
      { cmd: "msgbox", args: ["PetalburgCity_WallysHouse_Text_YouMetWallyInEverGrandeCity", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_WallysHouse_EventScript_PlayedWithWally": [
      { cmd: "msgbox", args: ["PetalburgCity_WallysHouse_Text_WonderHowWallyIsDoing", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_WallysHouse_EventScript_WallysMom": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_HM_SURF", "PetalburgCity_WallysHouse_EventScript_ReceivedHMSurf"] },
      { cmd: "msgbox", args: ["PetalburgCity_WallysHouse_Text_WallyWasReallyHappy", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_WallysHouse_EventScript_ReceivedHMSurf": [
      { cmd: "msgbox", args: ["PetalburgCity_WallysHouse_Text_WallyLeftWithoutTelling", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "PetalburgCity_WallysHouse_Text_ThanksForPlayingWithWally": "You're…\\nAh, you must be {PLAYER}{KUN}, right?\\pThank you for playing with WALLY a\\nlittle while ago.\\pHe's been frail and sickly ever\\nsince he was a baby.\\pWe've sent him to stay with my relatives\\nin VERDANTURF TOWN for a while.\\pThe air is a lot cleaner there\\nthan it is here.\\pWhat's that? Where's WALLY?\\nHe's already left, our WALLY.\\pI wonder where he could have\\ngotten by now?",
    "PetalburgCity_WallysHouse_Text_WonderHowWallyIsDoing": "I wonder how our WALLY is doing?",
    "PetalburgCity_WallysHouse_Text_PleaseExcuseUs": "{PLAYER}{KUN}! Please excuse us for\\ndragging you here this way.\\pBut our WALLY's become very healthy\\nsince he went to VERDANTURF TOWN.\\pWe owe it all to you!\\pWhen WALLY left town, you helped\\nhim catch a POKéMON, right?\\pI think that made WALLY really\\nhappy.\\pActually, not just WALLY.\\nIt made me, his father, happy too.\\pHappy that he's gained such a great\\nfriend as you.\\pThis isn't a bribe or anything, but\\nI'd really like you to have this.",
    "PetalburgCity_WallysHouse_Text_SurfGoAllSortsOfPlaces": "If your POKéMON can SURF, you'll be\\nable to go to all sorts of places.",
    "PetalburgCity_WallysHouse_Text_WallyIsComingHomeSoon": "WALLY's coming home soon.\\nI'm looking forward to that.",
    "PetalburgCity_WallysHouse_Text_YouMetWallyInEverGrandeCity": "Oh? You met WALLY in\\nEVER GRANDE CITY?\\pOh, {PLAYER}{KUN}, don't be silly.\\pHe may have gotten healthy, but he\\ncan't go somewhere far away like\\lthat all by himself.",
    "PetalburgCity_WallysHouse_Text_WallyWasReallyHappy": "WALLY was really happy when he told\\nus that he caught a POKéMON.\\pIt's been ages since I've seen him\\nsmile like that.",
    "PetalburgCity_WallysHouse_Text_WallyLeftWithoutTelling": "I want you to keep this a secret\\nfrom my husband…\\pBut our WALLY left VERDANTURF TOWN\\nwithout telling anyone.\\pYou know, WALLY is frail, but\\nhe's surprisingly strong-willed.\\pI'm sure that he'll come back safe\\nand sound one day!",
  },
};

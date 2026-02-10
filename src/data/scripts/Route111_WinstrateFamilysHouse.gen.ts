// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route111_WinstrateFamilysHouse_EventScript_Victor": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "setvar", args: ["VAR_0x8008", "LOCALID_WINSTRATE_HOUSE_VICTOR"] },
      { cmd: "msgbox", args: ["Route111_WinstrateFamilysHouse_Text_MySonIsStrongerThanYou", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["Route111_WinstrateFamilysHouse_EventScript_FaceOriginalDirection"] },
      { cmd: "end" },
    ],
    "Route111_WinstrateFamilysHouse_EventScript_Victoria": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "setvar", args: ["VAR_0x8008", "LOCALID_WINSTRATE_HOUSE_VICTORIA"] },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_MACHO_BRACE", "Route111_WinstrateFamilysHouse_EventScript_ReceivedMachoBrace"] },
      { cmd: "msgbox", args: ["Route111_WinstrateFamilysHouse_Text_LikeYouToHaveMachoBrace", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_MACHO_BRACE"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_MACHO_BRACE"] },
      { cmd: "goto", args: ["Route111_WinstrateFamilysHouse_EventScript_FaceOriginalDirection"] },
      { cmd: "end" },
    ],
    "Route111_WinstrateFamilysHouse_EventScript_ReceivedMachoBrace": [
      { cmd: "msgbox", args: ["Route111_WinstrateFamilysHouse_Text_PassionateAboutBattles", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["Route111_WinstrateFamilysHouse_EventScript_FaceOriginalDirection"] },
      { cmd: "end" },
    ],
    "Route111_WinstrateFamilysHouse_EventScript_Vivi": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "setvar", args: ["VAR_0x8008", "LOCALID_WINSTRATE_HOUSE_VIVI"] },
      { cmd: "msgbox", args: ["Route111_WinstrateFamilysHouse_Text_StrongerFamilyMembers", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["Route111_WinstrateFamilysHouse_EventScript_FaceOriginalDirection"] },
      { cmd: "end" },
    ],
    "Route111_WinstrateFamilysHouse_EventScript_Vicky": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "setvar", args: ["VAR_0x8008", "LOCALID_WINSTRATE_HOUSE_VICKY"] },
      { cmd: "goto_if_set", args: ["FLAG_TEMP_4", "Route111_WinstrateFamilysHouse_EventScript_AlreadySpokenTo"] },
      { cmd: "msgbox", args: ["Route111_WinstrateFamilysHouse_Text_GrandsonStrong", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_TEMP_4"] },
      { cmd: "goto", args: ["Route111_WinstrateFamilysHouse_EventScript_FaceOriginalDirection"] },
      { cmd: "end" },
    ],
    "Route111_WinstrateFamilysHouse_EventScript_AlreadySpokenTo": [
      { cmd: "msgbox", args: ["Route111_WinstrateFamilysHouse_Text_GrandsonStrongShort", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["Route111_WinstrateFamilysHouse_EventScript_FaceOriginalDirection"] },
      { cmd: "end" },
    ],
    "Route111_WinstrateFamilysHouse_EventScript_FaceOriginalDirection": [
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["VAR_0x8008", "Common_Movement_FaceOriginalDirection"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route111_WinstrateFamilysHouse_Text_MySonIsStrongerThanYou": "You're the first TRAINER I've seen who\\ndeploys POKéMON so masterfully.\\pBut, I should tell you--my son is\\nstronger than you.\\pHe even took the POKéMON LEAGUE\\nchallenge, I'll have you know.",
    "Route111_WinstrateFamilysHouse_Text_LikeYouToHaveMachoBrace": "We use this MACHO BRACE to more\\neffectively strengthen our POKéMON\\lin training.\\pSince you've beaten all of us here,\\nI don't know if you need it, but we\\lwould like you to have our MACHO BRACE.",
    "Route111_WinstrateFamilysHouse_Text_PassionateAboutBattles": "When it comes to POKéMON battles,\\nwe tend to be pretty passionate.",
    "Route111_WinstrateFamilysHouse_Text_StrongerFamilyMembers": "Mommy is stronger than Daddy.\\pI'm stronger than Mommy.\\pAnd Grandma's stronger than me!\\pBut my big brother is even stronger\\nthan Grandma.",
    "Route111_WinstrateFamilysHouse_Text_GrandsonStrong": "There's no question that you're strong.\\pBut if you were to battle my grandson,\\nyou'd end up crying in frustration.\\pHe's much stronger than any TRAINER\\nour family knows.\\pHe must be challenging the POKéMON\\nLEAGUE CHAMPION by now.\\pKnowing my grandson, he could be the\\nCHAMPION already!",
    "Route111_WinstrateFamilysHouse_Text_GrandsonStrongShort": "My grandson must be challenging the\\nPOKéMON LEAGUE CHAMPION by now.\\pKnowing my grandson, he could be the\\nCHAMPION already!",
  },
};

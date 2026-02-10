// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "RustboroCity_DevonCorp_1F_OnTransition",
  },
  scripts: {
    "RustboroCity_DevonCorp_1F_OnTransition": [
      { cmd: "call_if_unset", args: ["FLAG_RETURNED_DEVON_GOODS", "RustboroCity_DevonCorp_1F_EventScript_BlockStairs"] },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_BlockStairs": [
      { cmd: "setobjectxyperm", args: ["LOCALID_DEVON_CORP_STAIR_GUARD", 14, 2] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_DEVON_CORP_STAIR_GUARD", "MOVEMENT_TYPE_FACE_DOWN"] },
      { cmd: "return" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_Employee": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RETURNED_DEVON_GOODS", "RustboroCity_DevonCorp_1F_EventScript_GoodsRecovered"] },
      { cmd: "goto_if_set", args: ["FLAG_DEVON_GOODS_STOLEN", "RustboroCity_DevonCorp_1F_EventScript_RobberWasntBright"] },
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_ThoseShoesAreOurProduct", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_RobberWasntBright": [
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_RobberWasntVeryBright", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_GoodsRecovered": [
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_SoundsLikeStolenGoodsRecovered", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_StairGuard": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RETURNED_DEVON_GOODS", "RustboroCity_DevonCorp_1F_EventScript_AlwaysWelcome"] },
      { cmd: "goto_if_set", args: ["FLAG_RECOVERED_DEVON_GOODS", "RustboroCity_DevonCorp_1F_EventScript_GotRobbed"] },
      { cmd: "goto_if_set", args: ["FLAG_DEVON_GOODS_STOLEN", "RustboroCity_DevonCorp_1F_EventScript_GotRobbed"] },
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_OnlyAuthorizedPeopleEnter", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_AlwaysWelcome": [
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_YoureAlwaysWelcomeHere", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_GotRobbed": [
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_HowCouldWeGetRobbed", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_Greeter": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RETURNED_DEVON_GOODS", "RustboroCity_DevonCorp_1F_EventScript_WelcomeToDevonCorp"] },
      { cmd: "goto_if_set", args: ["FLAG_RECOVERED_DEVON_GOODS", "RustboroCity_DevonCorp_1F_EventScript_StaffGotRobbed"] },
      { cmd: "goto_if_set", args: ["FLAG_DEVON_GOODS_STOLEN", "RustboroCity_DevonCorp_1F_EventScript_StaffGotRobbed"] },
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_WelcomeToDevonCorp", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_WelcomeToDevonCorp": [
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_WelcomeToDevonCorp", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_StaffGotRobbed": [
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_StaffGotRobbed", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_RocksMetalDisplay": [
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_RocksMetalDisplay", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "RustboroCity_DevonCorp_1F_EventScript_ProductsDisplay": [
      { cmd: "msgbox", args: ["RustboroCity_DevonCorp_1F_Text_ProductDisplay", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_DevonCorp_1F_Text_WelcomeToDevonCorp": "Hello and welcome to the DEVON\\nCORPORATION.\\pWe're proud producers of items and\\nmedicine that enhance your life.",
    "RustboroCity_DevonCorp_1F_Text_StaffGotRobbed": "One of our research staff stupidly\\ngot robbed of an important parcel.",
    "RustboroCity_DevonCorp_1F_Text_ThoseShoesAreOurProduct": "Hey, those RUNNING SHOES!\\nThey're one of our products!\\pIt makes me happy when I see someone\\nusing something we made.",
    "RustboroCity_DevonCorp_1F_Text_RobberWasntVeryBright": "That stolen parcel…\\pWell, sure it's important, but it's not\\nanything that anyone can use.\\pIn my estimation, that robber must not\\nhave been very bright.",
    "RustboroCity_DevonCorp_1F_Text_SoundsLikeStolenGoodsRecovered": "It sounds like they've recovered\\nthe ripped-off DEVON GOODS.",
    "RustboroCity_DevonCorp_1F_Text_OnlyAuthorizedPeopleEnter": "I'm sorry, only authorized people\\nare allowed to enter here.",
    "RustboroCity_DevonCorp_1F_Text_HowCouldWeGetRobbed": "It's beyond stupid.\\nHow could we get robbed?",
    "RustboroCity_DevonCorp_1F_Text_YoureAlwaysWelcomeHere": "Hi, there!\\nYou're always welcome here!",
    "RustboroCity_DevonCorp_1F_Text_RocksMetalDisplay": "Samples of rocks and metal are\\ndisplayed in the glass case.\\pThere's a panel with some writing\\non it…\\p“DEVON CORPORATION got its start as\\na producer of stones from quarries.\\p“The company also produced iron from\\nfilings in the sand.\\p“From that humble start as a producer\\nof raw materials, DEVON developed.\\p“DEVON is now a manufacturer of a wide\\nrange of industrial products.”",
    "RustboroCity_DevonCorp_1F_Text_ProductDisplay": "Prototypes and test products fill\\nthe glass display case.\\pThere's a panel with a description…\\p“In addition to industrial products,\\nDEVON now markets sundries and\\lpharmaceuticals for better lifestyles.\\p“Recently, DEVON has begun marketing\\ntools for POKéMON TRAINERS, including\\lPOKé BALLS and POKéNAV systems.”",
  },
};

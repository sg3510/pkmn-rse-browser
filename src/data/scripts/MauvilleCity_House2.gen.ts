// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MauvilleCity_House2_EventScript_Woman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_COIN_CASE", "MauvilleCity_House2_EventScript_ReceivedCoinCase"] },
      { cmd: "msgbox", args: ["MauvilleCity_House2_Text_BuyHarborMailAtSlateport", "MSGBOX_DEFAULT"] },
      { cmd: "checkitem", args: ["ITEM_HARBOR_MAIL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "MauvilleCity_House2_EventScript_AskToTradeForHarborMail"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MauvilleCity_House2_EventScript_AskToTradeForHarborMail": [
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_ExclamationMark"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Common_Movement_Delay48"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["MauvilleCity_House2_Text_TradeHarborMailForCoinCase", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "MauvilleCity_House2_EventScript_AcceptTrade"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "MauvilleCity_House2_EventScript_DeclineTrade"] },
      { cmd: "end" },
    ],
    "MauvilleCity_House2_EventScript_AcceptTrade": [
      { cmd: "msgbox", args: ["MauvilleCity_House2_Text_IllTradeYouCoinCase", "MSGBOX_DEFAULT"] },
      { cmd: "removeitem", args: ["ITEM_HARBOR_MAIL"] },
      { cmd: "giveitem", args: ["ITEM_COIN_CASE"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_COIN_CASE"] },
      { cmd: "goto", args: ["MauvilleCity_House2_EventScript_ReceivedCoinCase"] },
      { cmd: "end" },
    ],
    "MauvilleCity_House2_EventScript_ReceivedCoinCase": [
      { cmd: "msgbox", args: ["MauvilleCity_House2_Text_UseCoinCaseAtGameCorner", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MauvilleCity_House2_EventScript_DeclineTrade": [
      { cmd: "msgbox", args: ["MauvilleCity_House2_Text_ThatsDisappointing", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MauvilleCity_House2_Text_BuyHarborMailAtSlateport": "If I had a BIKE, it'd be easy to cycle to\\nSLATEPORT for some shopping.\\pI'd be able to buy HARBOR MAIL at the\\nPOKéMON MART in SLATEPORT…",
    "MauvilleCity_House2_Text_TradeHarborMailForCoinCase": "Oh! You have HARBOR MAIL?\\nWill you trade it for a COIN CASE?",
    "MauvilleCity_House2_Text_IllTradeYouCoinCase": "Oh, I'm so happy!\\nOkay, I'll trade you a COIN CASE!",
    "MauvilleCity_House2_Text_UseCoinCaseAtGameCorner": "That COIN CASE can be used\\nat the GAME CORNER.",
    "MauvilleCity_House2_Text_ThatsDisappointing": "Oh, that's disappointing.\\pA COIN CASE is needed for the\\nGAME CORNER.",
  },
};

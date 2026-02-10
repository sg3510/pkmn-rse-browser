// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FortreeCity_House2_EventScript_HiddenPowerGiver": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_TM_HIDDEN_POWER", "FortreeCity_House2_EventScript_ExplainHiddenPower"] },
      { cmd: "call_if_unset", args: ["FLAG_MET_HIDDEN_POWER_GIVER", "FortreeCity_House2_EventScript_Greeting"] },
      { cmd: "msgbox", args: ["FortreeCity_House2_Text_CoinInWhichHand", "MSGBOX_DEFAULT"] },
      { cmd: "multichoice", args: [21, 8, "MULTI_RIGHTLEFT", "TRUE"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [1, "FortreeCity_House2_EventScript_WrongGuess"] },
      { cmd: "msgbox", args: ["FortreeCity_House2_Text_CorrectTryAgainWhichHand", "MSGBOX_DEFAULT"] },
      { cmd: "multichoice", args: [21, 8, "MULTI_RIGHTLEFT", "TRUE"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [1, "FortreeCity_House2_EventScript_WrongGuess"] },
      { cmd: "msgbox", args: ["FortreeCity_House2_Text_CorrectTryAgainWhichHand2", "MSGBOX_DEFAULT"] },
      { cmd: "multichoice", args: [21, 8, "MULTI_RIGHTLEFT", "TRUE"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [0, "FortreeCity_House2_EventScript_WrongGuess"] },
      { cmd: "msgbox", args: ["FortreeCity_House2_Text_YourHiddenPowerHasAwoken", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_TM_HIDDEN_POWER"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 0, "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_TM_HIDDEN_POWER"] },
      { cmd: "msgbox", args: ["FortreeCity_House2_Text_ExplainHiddenPower", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_House2_EventScript_Greeting": [
      { cmd: "msgbox", args: ["FortreeCity_House2_Text_HiddenPowersArousedByNature", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_MET_HIDDEN_POWER_GIVER"] },
      { cmd: "return" },
    ],
    "FortreeCity_House2_EventScript_ExplainHiddenPower": [
      { cmd: "msgbox", args: ["FortreeCity_House2_Text_ExplainHiddenPower", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_House2_EventScript_WrongGuess": [
      { cmd: "msgbox", args: ["FortreeCity_House2_Text_YouGuessedWrong", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FortreeCity_House2_Text_HiddenPowersArousedByNature": "People… POKéMON…\\pTheir hidden powers are aroused by\\nliving in natural environments…",
    "FortreeCity_House2_Text_CoinInWhichHand": "Let this old woman see if your hidden\\npower has awoken…\\pI hold a coin in my hand.\\pNow, tell me, have I palmed it in\\nthe right hand? Or in the left?",
    "FortreeCity_House2_Text_CorrectTryAgainWhichHand": "Oh! Yes, correct!\\pWe shall try again.\\pIn which hand have I palmed the coin?\\nThe right or left?",
    "FortreeCity_House2_Text_CorrectTryAgainWhichHand2": "Oh! Yes, correct!\\pWe shall try again.\\pIn which hand have I palmed the coin?\\nThe right or left?",
    "FortreeCity_House2_Text_YourHiddenPowerHasAwoken": "Oh! Splendid!\\nYour hidden power has awoken!\\pHere, take this and awaken the hidden\\npower of your POKéMON.",
    "FortreeCity_House2_Text_ExplainHiddenPower": "HIDDEN POWER is a move that changes\\nwith the POKéMON.",
    "FortreeCity_House2_Text_YouGuessedWrong": "No, too bad.\\nYou guessed wrong.",
  },
};

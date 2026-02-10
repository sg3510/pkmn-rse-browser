// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MtPyre_1F_EventScript_CleanseTagWoman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_CLEANSE_TAG", "MtPyre_1F_EventScript_ReceivedCleanseTag"] },
      { cmd: "msgbox", args: ["MtPyre_1F_Text_TakeThisForYourOwnGood", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_CLEANSE_TAG"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_CLEANSE_TAG"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MtPyre_1F_EventScript_ReceivedCleanseTag": [
      { cmd: "msgbox", args: ["MtPyre_1F_Text_ExplainCleanseTag", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MtPyre_1F_EventScript_PokefanF": [
      { cmd: "msgbox", args: ["MtPyre_1F_Text_ComeToPayRespects", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MtPyre_1F_EventScript_Man": [
      { cmd: "msgbox", args: ["MtPyre_1F_Text_RestingPlaceOfZigzagoon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MtPyre_1F_Text_TakeThisForYourOwnGood": "All sorts of beings wander the slopes\\nof MT. PYRE…\\pThere is no telling what may happen.\\nTake this. It's for your own good.",
    "MtPyre_1F_Text_ExplainCleanseTag": "Have a POKéMON hold that\\nCLEANSE TAG.\\pIt will help ward off wild POKéMON.",
    "MtPyre_1F_Text_ComeToPayRespects": "Did you come to pay your respect\\nto the spirits of departed POKéMON?\\pYou must care for your POKéMON a lot.",
    "MtPyre_1F_Text_RestingPlaceOfZigzagoon": "This is the final resting place of my\\nZIGZAGOON. I cherished it…",
  },
};

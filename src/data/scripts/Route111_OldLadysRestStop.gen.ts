// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route111_OldLadysRestStop_OnTransition",
  },
  scripts: {
    "Route111_OldLadysRestStop_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_OLD_LADY_REST_SHOP"] },
      { cmd: "end" },
    ],
    "Route111_OldLadysRestStop_EventScript_OldLady": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["Route111_OldLadysRestStop_Text_RestUpHere", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "Route111_OldLadysRestStop_EventScript_Rest"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "Route111_OldLadysRestStop_EventScript_DeclineRest"] },
      { cmd: "end" },
    ],
    "Route111_OldLadysRestStop_EventScript_Rest": [
      { cmd: "msgbox", args: ["Route111_OldLadysRestStop_Text_TakeYourTimeRestUp", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "call", args: ["Common_EventScript_OutOfCenterPartyHeal"] },
      { cmd: "msgbox", args: ["Route111_OldLadysRestStop_Text_StillTiredTakeAnotherRest", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "Route111_OldLadysRestStop_EventScript_Rest"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "Route111_OldLadysRestStop_EventScript_DeclineRest"] },
      { cmd: "end" },
    ],
    "Route111_OldLadysRestStop_EventScript_DeclineRest": [
      { cmd: "msgbox", args: ["Route111_OldLadysRestStop_Text_DontNeedToBeShy", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route111_OldLadysRestStop_Text_RestUpHere": "Oh, dear, dear.\\nAren't your POKéMON exhausted?\\pIf you'd like, rest up here.\\nThat's a fine idea! You should do that.",
    "Route111_OldLadysRestStop_Text_TakeYourTimeRestUp": "That's right.\\nTake your time and rest up!",
    "Route111_OldLadysRestStop_Text_StillTiredTakeAnotherRest": "Oh, dear, dear.\\nAre your POKéMON still tired?\\pYou should take another rest here.\\nThat's a fine idea. You should do that.",
    "Route111_OldLadysRestStop_Text_DontNeedToBeShy": "Is that so?\\nYou don't need to be shy about it.",
  },
};

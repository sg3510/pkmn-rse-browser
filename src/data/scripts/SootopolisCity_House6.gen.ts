// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SootopolisCity_House6_EventScript_Woman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_WAILMER_DOLL", "SootopolisCity_House6_EventScript_ReceivedWailmerDoll"] },
      { cmd: "msgbox", args: ["SootopolisCity_House6_Text_FirstGuestInWhileTakeDoll", "MSGBOX_YESNO"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "NO", "SootopolisCity_House6_EventScript_DeclineWailmerDoll"] },
      { cmd: "msgbox", args: ["SootopolisCity_House6_Text_TakeGoodCareOfIt", "MSGBOX_DEFAULT"] },
      { cmd: "givedecoration", args: ["DECOR_WAILMER_DOLL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "SootopolisCity_House6_EventScript_NoRoomForWailmerDoll"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_WAILMER_DOLL"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_House6_EventScript_DeclineWailmerDoll": [
      { cmd: "msgbox", args: ["SootopolisCity_House6_Text_DontWantThisDoll", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_House6_EventScript_ReceivedWailmerDoll": [
      { cmd: "msgbox", args: ["SootopolisCity_House6_Text_LovePlushDolls", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_House6_EventScript_NoRoomForWailmerDoll": [
      { cmd: "bufferdecorationname", args: ["STR_VAR_2", "DECOR_WAILMER_DOLL"] },
      { cmd: "msgbox", args: ["gText_NoRoomLeftForAnother", "MSGBOX_DEFAULT"] },
      { cmd: "msgbox", args: ["SootopolisCity_House6_Text_IllHoldItForYou", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SootopolisCity_House6_Text_FirstGuestInWhileTakeDoll": "Hello! You're our first guest in\\na good while.\\pYou've brightened up my day, so I'll\\ngive you a big WAILMER DOLL.",
    "SootopolisCity_House6_Text_TakeGoodCareOfIt": "Take good care of it!",
    "SootopolisCity_House6_Text_IllHoldItForYou": "Oh, you want it, but not right now?\\nOkay, then I'll hold it for you.",
    "SootopolisCity_House6_Text_DontWantThisDoll": "Are you sure?\\nYou don't want this DOLL?",
    "SootopolisCity_House6_Text_LovePlushDolls": "I love plush DOLLS!",
  },
};

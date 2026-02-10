// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LilycoveCity_House2_EventScript_FatMan": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_TM_REST", "LilycoveCity_House2_EventScript_ReceivedRest"] },
      { cmd: "msgbox", args: ["LilycoveCity_House2_Text_NotAwakeYetHaveThis", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_TM_REST"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_TM_REST"] },
      { cmd: "msgbox", args: ["LilycoveCity_House2_Text_SleepIsEssential", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_House2_EventScript_ReceivedRest": [
      { cmd: "msgbox", args: ["LilycoveCity_House2_Text_SleepIsEssential", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_House2_Text_NotAwakeYetHaveThis": "Huh? What? What's that?\\pI'm not near awake yet…\\nYou can have this…",
    "LilycoveCity_House2_Text_SleepIsEssential": "Yawn…\\pSleep is essential for good health…\\nSleep and regain health…",
  },
};

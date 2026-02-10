// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "GraniteCave_1F_EventScript_Hiker": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_HM_FLASH", "GraniteCave_1F_EventScript_ReceivedFlash"] },
      { cmd: "msgbox", args: ["GraniteCave_1F_Text_GetsDarkAheadHereYouGo", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_HM_FLASH"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_HM_FLASH"] },
      { cmd: "msgbox", args: ["GraniteCave_1F_Text_ExplainFlash", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "GraniteCave_1F_EventScript_ReceivedFlash": [
      { cmd: "msgbox", args: ["GraniteCave_1F_Text_ExplainFlash", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "GraniteCave_1F_Text_GetsDarkAheadHereYouGo": "Hey, you.\\nIt gets awfully dark ahead.\\lIt'll be tough trying to explore.\\pThat guy who came by earlier…\\nSTEVEN, I think it was.\\pHe knew how to use FLASH, so he ought\\nto be all right, but…\\pWell, for us HIKERS, helping out those\\nthat we meet is our motto.\\pHere you go, I'll pass this on to you.",
    "GraniteCave_1F_Text_ExplainFlash": "Teach that hidden move FLASH to\\na POKéMON and use it.\\pIt lights up even the inky darkness\\nof caves.\\pBut, to use it, you need the GYM BADGE\\nfrom DEWFORD's POKéMON GYM.",
  },
};

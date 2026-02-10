// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SootopolisCity_House1_EventScript_BrickBreakBlackBelt": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_TM_BRICK_BREAK", "SootopolisCity_House1_EventScript_ReceivedBrickBreak"] },
      { cmd: "msgbox", args: ["SootopolisCity_House1_Text_DevelopedThisTM", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_TM_BRICK_BREAK"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_TM_BRICK_BREAK"] },
      { cmd: "msgbox", args: ["SootopolisCity_House1_Text_ExplainBrickBreak", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_House1_EventScript_ReceivedBrickBreak": [
      { cmd: "msgbox", args: ["SootopolisCity_House1_Text_ExplainBrickBreak", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_House1_EventScript_Kecleon": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_KECLEON", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["SootopolisCity_House1_Text_Kecleon", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SootopolisCity_House1_Text_DevelopedThisTM": "For thirty years I've remained in\\nSOOTOPOLIS honing my skills.\\pI developed a shattering TM.\\nI bequeath it to you!",
    "SootopolisCity_House1_Text_ExplainBrickBreak": "TM31 contains BRICK BREAK! It's a move\\nso horrible that I can't describe it.",
    "SootopolisCity_House1_Text_Kecleon": "KECLEON: Puu puhyaah.",
  },
};

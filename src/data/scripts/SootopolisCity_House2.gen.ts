// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SootopolisCity_House2_EventScript_ExpertF": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["SootopolisCity_House2_Text_DidYouKnowAboutMtPyreOrbs", "MSGBOX_YESNO"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "YES", "SootopolisCity_House2_EventScript_KnowAboutOrbs"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "NO", "SootopolisCity_House2_EventScript_DontKnowAboutOrbs"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_House2_EventScript_KnowAboutOrbs": [
      { cmd: "msgbox", args: ["SootopolisCity_House2_Text_YesTwoOrbsSideBySide", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "SootopolisCity_House2_EventScript_DontKnowAboutOrbs": [
      { cmd: "msgbox", args: ["SootopolisCity_House2_Text_OughtToVisitAndSee", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
  },
  movements: {
  },
  text: {
    "SootopolisCity_House2_Text_DidYouKnowAboutMtPyreOrbs": "MT. PYRE…\\pAt its peak are two orbs placed side\\nby side. Did you know?",
    "SootopolisCity_House2_Text_YesTwoOrbsSideBySide": "Yes, two orbs side by side…\\pThe sight of them together…\\nIt is somehow soothing…",
    "SootopolisCity_House2_Text_OughtToVisitAndSee": "Is that so?\\nPerhaps you ought to visit and see…",
  },
};

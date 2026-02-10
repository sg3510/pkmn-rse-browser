// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SootopolisCity_House3_EventScript_Woman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["SootopolisCity_House3_Text_JuanHasManyFansDoYou", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "SootopolisCity_House3_EventScript_HaveFans"] },
      { cmd: "msgbox", args: ["SootopolisCity_House3_Text_LonesomeTryWorkingHarder", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_House3_EventScript_HaveFans": [
      { cmd: "msgbox", args: ["SootopolisCity_House3_Text_YouMustBePrettyStrong", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_House3_EventScript_Girl": [
      { cmd: "msgbox", args: ["SootopolisCity_House3_Text_TrainerFanClubWasWild", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SootopolisCity_House3_Text_JuanHasManyFansDoYou": "You're a POKéMON TRAINER, aren't you?\\pSOOTOPOLIS's JUAN has many fans.\\nEven more than his student WALLACE!\\pDo you have any?",
    "SootopolisCity_House3_Text_YouMustBePrettyStrong": "Oh, then you must be pretty strong.",
    "SootopolisCity_House3_Text_LonesomeTryWorkingHarder": "Oh, dear…\\nThat's a little lonesome.\\pTry working a little harder to get\\na fan following.",
    "SootopolisCity_House3_Text_TrainerFanClubWasWild": "Dedicated fans come over from even\\noutside of HOENN.\\pIt was really wild when I went to the\\nTRAINER FAN CLUB in LILYCOVE.",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MagmaHideout_3F_2R_EventScript_Grunt10": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_MAGMA_HIDEOUT_10", "MagmaHideout_3F_2R_Text_Grunt10Intro", "MagmaHideout_3F_2R_Text_Grunt10Defeat"] },
      { cmd: "msgbox", args: ["MagmaHideout_3F_2R_Text_Grunt10PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MagmaHideout_3F_2R_Text_Grunt10Intro": "I understand everything our leader\\nsays. But you know what?\\pDoing stuff like digging up a super-\\nancient POKéMON and ripping off\\lsomeone's METEORITE…\\pI think we're going a little too far.\\nWhat do you think?",
    "MagmaHideout_3F_2R_Text_Grunt10Defeat": "Yeah, I think we are doing something\\nwrong somehow.",
    "MagmaHideout_3F_2R_Text_Grunt10PostBattle": "You know, losing to you cleared my mind.\\pThe next time I see our leader,\\nI'm going to ask him about what we do.",
  },
};

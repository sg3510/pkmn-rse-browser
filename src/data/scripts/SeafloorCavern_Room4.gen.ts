// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SeafloorCavern_Room4_EventScript_Grunt3": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_SEAFLOOR_CAVERN_3", "SeafloorCavern_Room4_Text_Grunt3Intro", "SeafloorCavern_Room4_Text_Grunt3Defeat"] },
      { cmd: "msgbox", args: ["SeafloorCavern_Room4_Text_Grunt3PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "SeafloorCavern_Room4_EventScript_Grunt4": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_SEAFLOOR_CAVERN_4", "SeafloorCavern_Room4_Text_Grunt4Intro", "SeafloorCavern_Room4_Text_Grunt4Defeat"] },
      { cmd: "msgbox", args: ["SeafloorCavern_Room4_Text_Grunt4PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SeafloorCavern_Room4_Text_Grunt3Intro": "Who are you?\\nWhere did you come in from?",
    "SeafloorCavern_Room4_Text_Grunt3Defeat": "Lost it…",
    "SeafloorCavern_Room4_Text_Grunt3PostBattle": "I can't find the way out!\\pI'm not afraid. Don't get me wrong!",
    "SeafloorCavern_Room4_Text_Grunt4Intro": "Who are you?\\nWhere do you think you're going?",
    "SeafloorCavern_Room4_Text_Grunt4Defeat": "I failed to win!",
    "SeafloorCavern_Room4_Text_Grunt4PostBattle": "My partner forgot the map in that\\nsubmarine!\\pHow's that for being useless?",
  },
};

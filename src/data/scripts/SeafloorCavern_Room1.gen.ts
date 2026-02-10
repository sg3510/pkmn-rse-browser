// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SeafloorCavern_Room1_EventScript_Grunt1": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_SEAFLOOR_CAVERN_1", "SeafloorCavern_Room1_Text_Grunt1Intro", "SeafloorCavern_Room1_Text_Grunt1Defeat"] },
      { cmd: "msgbox", args: ["SeafloorCavern_Room1_Text_Grunt1PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "SeafloorCavern_Room1_EventScript_Grunt2": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_SEAFLOOR_CAVERN_2", "SeafloorCavern_Room1_Text_Grunt2Intro", "SeafloorCavern_Room1_Text_Grunt2Defeat"] },
      { cmd: "msgbox", args: ["SeafloorCavern_Room1_Text_Grunt2PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SeafloorCavern_Room1_Text_Grunt1Intro": "We don't need a kid around!\\nGo on home already!",
    "SeafloorCavern_Room1_Text_Grunt1Defeat": "I want to go home…",
    "SeafloorCavern_Room1_Text_Grunt1PostBattle": "I want to get a promotion so I can\\nboss around the GRUNTS…",
    "SeafloorCavern_Room1_Text_Grunt2Intro": "That submarine… It's tiny inside.\\nI'm sore all over!",
    "SeafloorCavern_Room1_Text_Grunt2Defeat": "Losing makes me sore!",
    "SeafloorCavern_Room1_Text_Grunt2PostBattle": "That submarine we jacked, man,\\nit's brutal as a ride.\\lIt's way too tight in there!",
  },
};

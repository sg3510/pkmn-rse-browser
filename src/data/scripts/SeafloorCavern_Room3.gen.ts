// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SeafloorCavern_Room3_EventScript_Shelly": [
      { cmd: "trainerbattle_single", args: ["TRAINER_SHELLY_SEAFLOOR_CAVERN", "SeafloorCavern_Room3_Text_ShellyIntro", "SeafloorCavern_Room3_Text_ShellyDefeat"] },
      { cmd: "msgbox", args: ["SeafloorCavern_Room3_Text_ShellyPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "SeafloorCavern_Room3_EventScript_Grunt5": [
      { cmd: "trainerbattle_single", args: ["TRAINER_GRUNT_SEAFLOOR_CAVERN_5", "SeafloorCavern_Room3_Text_Grunt5Intro", "SeafloorCavern_Room3_Text_Grunt5Defeat"] },
      { cmd: "msgbox", args: ["SeafloorCavern_Room3_Text_Grunt5PostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SeafloorCavern_Room3_Text_ShellyIntro": "Ahahahaha!\\pHow did you manage to get here without\\na submarine?\\lWhat an impressive child!\\pBut… It won't do to have you\\nmeddling about here.\\pAnd, I do want payback for what\\nhappened at the WEATHER INSTITUTE…\\pI'm going to give you a little taste\\nof pain! Resign yourself to it!",
    "SeafloorCavern_Room3_Text_ShellyDefeat": "Ahahahaha!\\pOuch!",
    "SeafloorCavern_Room3_Text_ShellyPostBattle": "Ahahahaha!\\nYou're so darn strong.\\pIt's terribly disappointing that you're\\nnot a TEAM AQUA member.\\pYou could have enjoyed the fabulous\\nworld our BOSS has promised as\\lone of us…",
    "SeafloorCavern_Room3_Text_Grunt5Intro": "For our dream to become real, we need\\nthe power of POKéMON.\\pBut meddlers like you use the power of\\nPOKéMON to mess with us even at\\la place like this!\\pLife just doesn't work the way we\\nneed it to!",
    "SeafloorCavern_Room3_Text_Grunt5Defeat": "Gwah!",
    "SeafloorCavern_Room3_Text_Grunt5PostBattle": "You know, we don't dare question\\nthe motives of our leader.\\pBut here you are, just some punk,\\ngoing up against our BOSS.\\pMaybe…\\nYou must be something…",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "AbandonedShip_Rooms_1F_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["AbandonedShip_Rooms_1F_Text_TakingALookAround", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms_1F_EventScript_Demetrius": [
      { cmd: "trainerbattle_single", args: ["TRAINER_DEMETRIUS", "AbandonedShip_Rooms_1F_Text_DemetriusIntro", "AbandonedShip_Rooms_1F_Text_DemetriusDefeat"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms_1F_Text_DemetriusPostBattle", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms_1F_EventScript_Thalia": [
      { cmd: "trainerbattle_single", args: ["TRAINER_THALIA_1", "AbandonedShip_Rooms_1F_Text_ThaliaIntro", "AbandonedShip_Rooms_1F_Text_ThaliaDefeat", "AbandonedShip_Rooms_1F_EventScript_RegisterThalia"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ShouldTryRematchBattle"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "AbandonedShip_Rooms_1F_EventScript_ThaliaRematch"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms_1F_Text_ThaliaPostBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms_1F_EventScript_RegisterThalia": [
      { cmd: "special", args: ["PlayerFaceTrainerAfterBattle"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms_1F_Text_ThaliaRegister", "MSGBOX_DEFAULT"] },
      { cmd: "register_matchcall", args: ["TRAINER_THALIA_1"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AbandonedShip_Rooms_1F_EventScript_ThaliaRematch": [
      { cmd: "trainerbattle_rematch", args: ["TRAINER_THALIA_1", "AbandonedShip_Rooms_1F_Text_ThaliaRematchIntro", "AbandonedShip_Rooms_1F_Text_ThaliaRematchDefeat"] },
      { cmd: "msgbox", args: ["AbandonedShip_Rooms_1F_Text_ThaliaPostRematch", "MSGBOX_AUTOCLOSE"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AbandonedShip_Rooms_1F_Text_TakingALookAround": "Ships of this sort are rare, so I'm\\ntaking a look around.\\pHmhm…\\nThere appear to be other cabins…",
    "AbandonedShip_Rooms_1F_Text_ThaliaIntro": "What on earth would compel you to\\ncome here? You must be curious!",
    "AbandonedShip_Rooms_1F_Text_ThaliaDefeat": "Not just curious, but also strong…",
    "AbandonedShip_Rooms_1F_Text_ThaliaPostBattle": "The man next door…\\pHe says he's just sightseeing,\\nbut I don't know about that.",
    "AbandonedShip_Rooms_1F_Text_ThaliaRegister": "You're such a tough TRAINER!\\nLet me register you as a memento!",
    "AbandonedShip_Rooms_1F_Text_ThaliaRematchIntro": "What on earth would compel you to\\ncome back? You must really be curious!",
    "AbandonedShip_Rooms_1F_Text_ThaliaRematchDefeat": "Aren't you too strong?",
    "AbandonedShip_Rooms_1F_Text_ThaliaPostRematch": "I'm sure that man's up to something!\\nHe just acts so suspiciously!",
    "AbandonedShip_Rooms_1F_Text_DemetriusIntro": "Waaah!\\nI've been found! …Huh?",
    "AbandonedShip_Rooms_1F_Text_DemetriusDefeat": "Oh, you're not my mom.",
    "AbandonedShip_Rooms_1F_Text_DemetriusPostBattle": "I'm in trouble with my mom, so I ran.\\nKeep it a secret where I am!",
  },
};

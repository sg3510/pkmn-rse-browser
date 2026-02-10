// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FallarborTown_MoveRelearnersHouse_EventScript_MoveRelearner": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_MOVE_RELEARNER", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "goto_if_set", args: ["FLAG_TEMP_1", "FallarborTown_MoveRelearnersHouse_EventScript_AskTeachMove"] },
      { cmd: "msgbox", args: ["FallarborTown_MoveRelearnersHouse_Text_ImTheMoveTutor", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_TEMP_1"] },
      { cmd: "goto", args: ["FallarborTown_MoveRelearnersHouse_EventScript_AskTeachMove"] },
      { cmd: "end" },
    ],
    "FallarborTown_MoveRelearnersHouse_EventScript_AskTeachMove": [
      { cmd: "checkitem", args: ["ITEM_HEART_SCALE"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "FallarborTown_MoveRelearnersHouse_EventScript_ComeBackWithHeartScale"] },
      { cmd: "msgbox", args: ["FallarborTown_MoveRelearnersHouse_Text_ThatsAHeartScaleWantMeToTeachMove", "MSGBOX_YESNO"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: ["NO", "FallarborTown_MoveRelearnersHouse_EventScript_ComeBackWithHeartScale"] },
      { cmd: "goto", args: ["FallarborTown_MoveRelearnersHouse_EventScript_ChooseMon"] },
      { cmd: "end" },
    ],
    "FallarborTown_MoveRelearnersHouse_EventScript_ChooseMon": [
      { cmd: "msgbox", args: ["FallarborTown_MoveRelearnersHouse_Text_TutorWhichMon", "MSGBOX_DEFAULT"] },
      { cmd: "special", args: ["ChooseMonForMoveRelearner"] },
      { cmd: "waitstate" },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "FallarborTown_MoveRelearnersHouse_EventScript_ComeBackWithHeartScale"] },
      { cmd: "special", args: ["IsSelectedMonEgg"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "FallarborTown_MoveRelearnersHouse_EventScript_CantTeachEgg"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8005", 0, "FallarborTown_MoveRelearnersHouse_EventScript_NoMoveToTeachMon"] },
      { cmd: "goto", args: ["FallarborTown_MoveRelearnersHouse_EventScript_ChooseMove"] },
      { cmd: "end" },
    ],
    "FallarborTown_MoveRelearnersHouse_EventScript_ChooseMove": [
      { cmd: "msgbox", args: ["FallarborTown_MoveRelearnersHouse_Text_TeachWhichMove", "MSGBOX_DEFAULT"] },
      { cmd: "special", args: ["TeachMoveRelearnerMove"] },
      { cmd: "waitstate" },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", 0, "FallarborTown_MoveRelearnersHouse_EventScript_ChooseMon"] },
      { cmd: "msgbox", args: ["FallarborTown_MoveRelearnersHouse_Text_HandedOverHeartScale", "MSGBOX_DEFAULT"] },
      { cmd: "removeitem", args: ["ITEM_HEART_SCALE"] },
      { cmd: "goto", args: ["FallarborTown_MoveRelearnersHouse_EventScript_ComeBackWithHeartScale"] },
      { cmd: "end" },
    ],
    "FallarborTown_MoveRelearnersHouse_EventScript_NoMoveToTeachMon": [
      { cmd: "msgbox", args: ["FallarborTown_MoveRelearnersHouse_Text_DontHaveMoveToTeachPokemon", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["FallarborTown_MoveRelearnersHouse_EventScript_ChooseMon"] },
      { cmd: "end" },
    ],
    "FallarborTown_MoveRelearnersHouse_EventScript_CantTeachEgg": [
      { cmd: "msgbox", args: ["FallarborTown_MoveRelearnersHouse_Text_CantTeachEgg", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["FallarborTown_MoveRelearnersHouse_EventScript_ChooseMon"] },
      { cmd: "end" },
    ],
    "FallarborTown_MoveRelearnersHouse_EventScript_ComeBackWithHeartScale": [
      { cmd: "msgbox", args: ["FallarborTown_MoveRelearnersHouse_Text_ComeBackWithHeartScale", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FallarborTown_MoveRelearnersHouse_Text_ImTheMoveTutor": "I'm the MOVE TUTOR.\\pI know all the moves that POKéMON\\nlearn--every one of them--and I can\\lteach POKéMON those moves.\\pI can teach a move to a POKéMON\\nof yours if you'd like.\\pI'll do it for a HEART SCALE.\\nI'm collecting those now.",
    "FallarborTown_MoveRelearnersHouse_Text_ThatsAHeartScaleWantMeToTeachMove": "Oh! That's it! That's an honest to\\ngoodness HEART SCALE!\\pLet me guess, you want me to teach\\na move?",
    "FallarborTown_MoveRelearnersHouse_Text_TutorWhichMon": "Which POKéMON needs tutoring?",
    "FallarborTown_MoveRelearnersHouse_Text_TeachWhichMove": "Which move should I teach?",
    "FallarborTown_MoveRelearnersHouse_Text_DontHaveMoveToTeachPokemon": "Sorry…\\pIt doesn't appear as if I have any move\\nI can teach that POKéMON.",
    "FallarborTown_MoveRelearnersHouse_Text_HandedOverHeartScale": "{PLAYER} handed over one HEART SCALE\\nin exchange.",
    "FallarborTown_MoveRelearnersHouse_Text_ComeBackWithHeartScale": "If your POKéMON need to learn a move,\\ncome back with a HEART SCALE.",
    "FallarborTown_MoveRelearnersHouse_Text_CantTeachEgg": "Hunh? There isn't a single move that\\nI can teach an EGG.",
  },
};

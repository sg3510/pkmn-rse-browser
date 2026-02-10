// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LilycoveCity_MoveDeletersHouse_EventScript_MoveDeleter": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_MOVE_DELETER", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_ICanMakeMonForgetMove", "MSGBOX_YESNO"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: ["YES", "LilycoveCity_MoveDeletersHouse_EventScript_ChooseMonAndMoveToForget"] },
      { cmd: "case", args: ["NO", "LilycoveCity_MoveDeletersHouse_EventScript_ComeAgain"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_MoveDeletersHouse_EventScript_ChooseMonAndMoveToForget": [
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_WhichMonShouldForget", "MSGBOX_DEFAULT"] },
      { cmd: "special", args: ["ChoosePartyMon"] },
      { cmd: "waitstate" },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "LilycoveCity_MoveDeletersHouse_EventScript_ComeAgain"] },
      { cmd: "special", args: ["IsSelectedMonEgg"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "LilycoveCity_MoveDeletersHouse_EventScript_EggCantForgetMoves"] },
      { cmd: "special", args: ["GetNumMovesSelectedMonHas"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 1, "LilycoveCity_MoveDeletersHouse_EventScript_MonOnlyKnowsOneMove"] },
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_WhichMoveShouldBeForgotten", "MSGBOX_DEFAULT"] },
      { cmd: "fadescreen", args: ["FADE_TO_BLACK"] },
      { cmd: "special", args: ["MoveDeleterChooseMoveToForget"] },
      { cmd: "fadescreen", args: ["FADE_FROM_BLACK"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8005", "MAX_MON_MOVES", "LilycoveCity_MoveDeletersHouse_EventScript_ChooseMonAndMoveToForget"] },
      { cmd: "special", args: ["BufferMoveDeleterNicknameAndMove"] },
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_MonsMoveShouldBeForgotten", "MSGBOX_YESNO"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: ["YES", "LilycoveCity_MoveDeletersHouse_EventScript_TryForgetMove"] },
      { cmd: "case", args: ["NO", "LilycoveCity_MoveDeletersHouse_EventScript_ComeAgain"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_MoveDeletersHouse_EventScript_TryForgetMove": [
      { cmd: "special", args: ["IsLastMonThatKnowsSurf"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "LilycoveCity_MoveDeletersHouse_EventScript_LastMonWithSurf"] },
      { cmd: "special", args: ["MoveDeleterForgetMove"] },
      { cmd: "playfanfare", args: ["MUS_MOVE_DELETED"] },
      { cmd: "waitfanfare" },
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_MonHasForgottenMove", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_MoveDeletersHouse_EventScript_MonOnlyKnowsOneMove": [
      { cmd: "special", args: ["BufferMoveDeleterNicknameAndMove"] },
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_MonOnlyKnowsOneMove", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_MoveDeletersHouse_EventScript_EggCantForgetMoves": [
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_EggCantForgetMoves", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_MoveDeletersHouse_EventScript_ComeAgain": [
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_ComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_MoveDeletersHouse_EventScript_LastMonWithSurf": [
      { cmd: "special", args: ["BufferMoveDeleterNicknameAndMove"] },
      { cmd: "msgbox", args: ["LilycoveCity_MoveDeletersHouse_Text_CantForgetSurf", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_MoveDeletersHouse_Text_ICanMakeMonForgetMove": "Uh…\\nOh, yes, I'm the MOVE DELETER.\\pI can make POKéMON forget their moves.\\pWould you like me to do that?",
    "LilycoveCity_MoveDeletersHouse_Text_WhichMonShouldForget": "Which POKéMON should forget a move?",
    "LilycoveCity_MoveDeletersHouse_Text_WhichMoveShouldBeForgotten": "Which move should be forgotten?",
    "LilycoveCity_MoveDeletersHouse_Text_MonOnlyKnowsOneMove": "{STR_VAR_1} knows only one move\\nso it can't be forgotten…",
    "LilycoveCity_MoveDeletersHouse_Text_MonsMoveShouldBeForgotten": "Hm! {STR_VAR_1}'s {STR_VAR_2}?\\nThat move should be forgotten?",
    "LilycoveCity_MoveDeletersHouse_Text_MonHasForgottenMove": "It worked to perfection!\\p{STR_VAR_1} has forgotten\\n{STR_VAR_2} completely.",
    "LilycoveCity_MoveDeletersHouse_Text_ComeAgain": "Come again if there are moves that\\nneed to be forgotten.",
    "LilycoveCity_MoveDeletersHouse_Text_EggCantForgetMoves": "What?\\nNo EGG should know any moves.",
    "LilycoveCity_MoveDeletersHouse_Text_CantForgetSurf": "Hm!\\pYour {STR_VAR_1} doesn't seem willing\\nto forget SURF.",
  },
};

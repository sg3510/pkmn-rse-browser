// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "Route114_FossilManiacsTunnel_OnLoad",
    onTransition: "Route114_FossilManiacsTunnel_OnTransition",
  },
  scripts: {
    "Route114_FossilManiacsTunnel_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_SYS_GAME_CLEAR", "Route114_FossilManiacsTunnel_EventScript_MoveFossilManiac"] },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsTunnel_EventScript_MoveFossilManiac": [
      { cmd: "setobjectxyperm", args: ["LOCALID_FOSSIL_MANIAC", 6, 5] },
      { cmd: "setobjectmovementtype", args: ["LOCALID_FOSSIL_MANIAC", "MOVEMENT_TYPE_FACE_DOWN"] },
      { cmd: "return" },
    ],
    "Route114_FossilManiacsTunnel_OnLoad": [
      { cmd: "call_if_unset", args: ["FLAG_SYS_GAME_CLEAR", "Route114_FossilManiacsTunnel_EventScript_CloseDesertUnderpass"] },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsTunnel_EventScript_CloseDesertUnderpass": [
      { cmd: "setmetatile", args: [6, 1, "METATILE_Fallarbor_RedRockWall", "TRUE"] },
      { cmd: "setmetatile", args: [6, 2, "METATILE_Fallarbor_RedRockWall", "TRUE"] },
      { cmd: "return" },
    ],
    "Route114_FossilManiacsTunnel_EventScript_ManiacMentionCaveIn": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_FOSSIL_MANIAC", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Common_Movement_WalkInPlaceFasterDown"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["Route114_FossilManiacsTunnel_Text_NotSafeThatWay", "MSGBOX_DEFAULT"] },
      { cmd: "setvar", args: ["VAR_FOSSIL_MANIAC_STATE", 2] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsTunnel_EventScript_FossilManiac": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_REVIVED_FOSSIL_MON", "Route114_FossilManiacsTunnel_EventScript_PlayerRevivedFossil"] },
      { cmd: "checkitem", args: ["ITEM_ROOT_FOSSIL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route114_FossilManiacsTunnel_EventScript_PlayerHasFossil"] },
      { cmd: "checkitem", args: ["ITEM_CLAW_FOSSIL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "Route114_FossilManiacsTunnel_EventScript_PlayerHasFossil"] },
      { cmd: "msgbox", args: ["Route114_FossilManiacsTunnel_Text_LookInDesertForFossils", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsTunnel_EventScript_PlayerHasFossil": [
      { cmd: "msgbox", args: ["Route114_FossilManiacsTunnel_Text_DevonCorpRevivingFossils", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsTunnel_EventScript_PlayerRevivedFossil": [
      { cmd: "msgbox", args: ["Route114_FossilManiacsTunnel_Text_FossilsAreWonderful", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route114_FossilManiacsTunnel_Text_LookInDesertForFossils": "I'm the FOSSIL MANIAC…\\nI'm a nice guy who loves FOSSILS…\\pDo you want a FOSSIL?\\pBut the FOSSILS around these parts all\\nbelong to me… None for you…\\pIf you can't bear to go without\\na FOSSIL, look in a desert where there\\lare boulders and sand that may hide\\lFOSSILS…",
    "Route114_FossilManiacsTunnel_Text_DevonCorpRevivingFossils": "You found a FOSSIL, didn't you?\\nThat's so nice… It's so dreamy…\\pWhat are you going to do with that\\nFOSSIL?\\pFrom what I've heard, DEVON is doing\\nresearch on reviving POKéMON from\\lFOSSILS…\\pI love my FOSSILS, so I would never\\ndo anything like that…",
    "Route114_FossilManiacsTunnel_Text_FossilsAreWonderful": "FOSSILS are so… Wonderful…\\nIt's so dreamy…",
    "Route114_FossilManiacsTunnel_Text_NotSafeThatWay": "Oh…\\nIt's not safe that way…\\pI was digging away, you see…\\nWhen the whole wall collapsed…\\pI think there's a giant cavern\\nunderneath now…\\pBut I've left it alone because I don't\\nthink there are any FOSSILS there…",
  },
};

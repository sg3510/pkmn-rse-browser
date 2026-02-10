// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "GraniteCave_StevensRoom_EventScript_Steven": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["GraniteCave_StevensRoom_Text_ImStevenLetterForMe", "MSGBOX_DEFAULT"] },
      { cmd: "setvar", args: ["VAR_0x8004", "ITEM_LETTER"] },
      { cmd: "call", args: ["Common_EventScript_PlayerHandedOverTheItem"] },
      { cmd: "setflag", args: ["FLAG_DELIVERED_STEVEN_LETTER"] },
      { cmd: "msgbox", args: ["GraniteCave_StevensRoom_Text_ThankYouTakeThis", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_TM_STEEL_WING"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "FALSE", "GraniteCave_StevensRoom_EventScript_BagFull"] },
      { cmd: "msgbox", args: ["GraniteCave_StevensRoom_Text_CouldBecomeChampionLetsRegister", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "delay", args: [30] },
      { cmd: "playfanfare", args: ["MUS_REGISTER_MATCH_CALL"] },
      { cmd: "msgbox", args: ["GraniteCave_StevensRoom_Text_RegisteredSteven", "MSGBOX_DEFAULT"] },
      { cmd: "waitfanfare" },
      { cmd: "closemessage" },
      { cmd: "delay", args: [30] },
      { cmd: "setflag", args: ["FLAG_REGISTERED_STEVEN_POKENAV"] },
      { cmd: "msgbox", args: ["GraniteCave_StevensRoom_Text_IveGotToHurryAlong", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_NORTH", "GraniteCave_StevensRoom_EventScript_StevenExitNorth"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_SOUTH", "GraniteCave_StevensRoom_EventScript_StevenExitSouth"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_WEST", "GraniteCave_StevensRoom_EventScript_StevenExitWestEast"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_EAST", "GraniteCave_StevensRoom_EventScript_StevenExitWestEast"] },
      { cmd: "playse", args: ["SE_EXIT"] },
      { cmd: "removeobject", args: ["LOCALID_GRANITE_CAVE_STEVEN"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "GraniteCave_StevensRoom_EventScript_StevenExitNorth": [
      { cmd: "applymovement", args: ["LOCALID_GRANITE_CAVE_STEVEN", "GraniteCave_StevensRoom_Movement_StevenExit"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "GraniteCave_StevensRoom_EventScript_StevenExitWestEast": [
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "GraniteCave_StevensRoom_Movement_PlayerTurnTowardExit"] },
      { cmd: "applymovement", args: ["LOCALID_GRANITE_CAVE_STEVEN", "GraniteCave_StevensRoom_Movement_StevenExit"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "GraniteCave_StevensRoom_EventScript_StevenExitSouth": [
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "GraniteCave_StevensRoom_Movement_PlayerTurnTowardExit"] },
      { cmd: "applymovement", args: ["LOCALID_GRANITE_CAVE_STEVEN", "GraniteCave_StevensRoom_Movement_StevenExitSouth"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "GraniteCave_StevensRoom_EventScript_BagFull": [
      { cmd: "msgbox", args: ["GraniteCave_StevensRoom_Text_OhBagIsFull", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
  },
  movements: {
    "GraniteCave_StevensRoom_Movement_StevenExit": ["walk_up", "walk_up", "walk_up", "walk_up", "walk_up", "delay_8"],
    "GraniteCave_StevensRoom_Movement_PlayerTurnTowardExit": ["delay_16", "delay_16", "delay_16", "walk_in_place_faster_up"],
    "GraniteCave_StevensRoom_Movement_StevenExitSouth": ["walk_left", "walk_up", "walk_up", "walk_up", "walk_right", "walk_up", "walk_up", "delay_8"],
  },
  text: {
    "GraniteCave_StevensRoom_Text_ImStevenLetterForMe": "My name is STEVEN.\\pI'm interested in rare stones,\\nso I travel here and there.\\pOh?\\nA LETTER for me?",
    "GraniteCave_StevensRoom_Text_ThankYouTakeThis": "STEVEN: Okay, thank you.\\pYou went through all this trouble to\\ndeliver that. I need to thank you.\\pLet me see…\\nI'll give you this TM.\\pIt contains my favorite move,\\nSTEEL WING.",
    "GraniteCave_StevensRoom_Text_CouldBecomeChampionLetsRegister": "STEVEN: Your POKéMON appear quite\\ncapable.\\pIf you keep training, you could even\\nbecome the CHAMPION of the POKéMON\\lLEAGUE one day. That's what I think.\\pI know, since we've gotten to know each\\nother, let's register one another in\\lour POKéNAVS.\\p… … … … … …",
    "GraniteCave_StevensRoom_Text_RegisteredSteven": "Registered STEVEN\\nin the POKéNAV.",
    "GraniteCave_StevensRoom_Text_IveGotToHurryAlong": "Now, I've got to hurry along.",
    "GraniteCave_StevensRoom_Text_OhBagIsFull": "Oh, your BAG is full…\\nThat's too bad, then.",
  },
};

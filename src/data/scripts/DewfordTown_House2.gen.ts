// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "DewfordTown_House2_EventScript_Man": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SILK_SCARF", "DewfordTown_House2_EventScript_ExplainSilkScarf"] },
      { cmd: "msgbox", args: ["DewfordTown_House2_Text_WantYouToHaveSilkScarf", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_SILK_SCARF"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "DewfordTown_House2_EventScript_NoRoomForScarf"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SILK_SCARF"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "DewfordTown_House2_EventScript_NoRoomForScarf": [
      { cmd: "msgbox", args: ["DewfordTown_House2_Text_NoRoom", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "DewfordTown_House2_EventScript_ExplainSilkScarf": [
      { cmd: "msgbox", args: ["DewfordTown_House2_Text_ExplainSilkScarf", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "DewfordTown_House2_EventScript_Boy": [
      { cmd: "msgbox", args: ["DewfordTown_House2_Text_BrawlySoCool", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "DewfordTown_House2_Text_WantYouToHaveSilkScarf": "Gorge your eyes on this!\\pIt's a SILK SCARF. It's right at the\\ncutting edge of fashion, yeah!\\pOh, I can see your eyes twinkling!\\nYou appreciate my dazzling style!\\pOh, you're a delight!\\nHere you go. I want you to have it!",
    "DewfordTown_House2_Text_NoRoom": "Oh, you don't have room?\\pNow, listen tight, this SCARF is a must-\\nhave! Why, I would sell all my items\\lin order to get it!",
    "DewfordTown_House2_Text_ExplainSilkScarf": "The SILK SCARF raises the power of\\nNORMAL-type moves.\\pIt's a marvelous SCARF that will go\\nwith almost all POKéMON!",
    "DewfordTown_House2_Text_BrawlySoCool": "Wow, you bothered to cross the sea\\nto visit DEWFORD?\\pDid you maybe come here because you\\nheard about BRAWLY?\\pHe's so cool…\\nEveryone idolizes him.",
  },
};

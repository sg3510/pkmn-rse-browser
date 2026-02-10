// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "CaveOfOrigin_B1F_EventScript_Wallace": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["CaveOfOrigin_B1F_Text_WallaceStory", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_CAVE_OF_ORIGIN_WALLACE", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [60] },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "applymovement", args: ["LOCALID_CAVE_OF_ORIGIN_WALLACE", "Common_Movement_ExclamationMark"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_CAVE_OF_ORIGIN_WALLACE", "Common_Movement_Delay48"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "delay", args: [30] },
      { cmd: "applymovement", args: ["LOCALID_CAVE_OF_ORIGIN_WALLACE", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "message", args: ["CaveOfOrigin_B1F_Text_WhereIsRayquaza"] },
      { cmd: "waitmessage" },
      { cmd: "goto", args: ["CaveOfOrigin_B1F_EventScript_WheresRayquaza"] },
    ],
    "CaveOfOrigin_B1F_EventScript_WheresRayquaza": [
      { cmd: "multichoice", args: [0, 0, "MULTI_WHERES_RAYQUAZA", "FALSE"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [0, "CaveOfOrigin_B1F_EventScript_AtCaveOfOrigin"] },
      { cmd: "case", args: [1, "CaveOfOrigin_B1F_EventScript_AtMtPyre"] },
      { cmd: "case", args: [2, "CaveOfOrigin_B1F_EventScript_AtSkyPillar"] },
      { cmd: "case", args: [3, "CaveOfOrigin_B1F_EventScript_DontRemember"] },
      { cmd: "goto", args: ["CaveOfOrigin_B1F_EventScript_DontRemember"] },
      { cmd: "end" },
    ],
    "CaveOfOrigin_B1F_EventScript_AtCaveOfOrigin": [
      { cmd: "message", args: ["CaveOfOrigin_B1F_Text_ButWereInCaveOfOrigin"] },
      { cmd: "waitmessage" },
      { cmd: "goto", args: ["CaveOfOrigin_B1F_EventScript_WheresRayquaza"] },
    ],
    "CaveOfOrigin_B1F_EventScript_AtMtPyre": [
      { cmd: "message", args: ["CaveOfOrigin_B1F_Text_OldLadyDidntMentionThat"] },
      { cmd: "waitmessage" },
      { cmd: "goto", args: ["CaveOfOrigin_B1F_EventScript_WheresRayquaza"] },
    ],
    "CaveOfOrigin_B1F_EventScript_DontRemember": [
      { cmd: "message", args: ["CaveOfOrigin_B1F_Text_CantYouRememberSomehow"] },
      { cmd: "waitmessage" },
      { cmd: "goto", args: ["CaveOfOrigin_B1F_EventScript_WheresRayquaza"] },
    ],
    "CaveOfOrigin_B1F_EventScript_AtSkyPillar": [
      { cmd: "msgbox", args: ["CaveOfOrigin_B1F_Text_WellHeadToSkyPillar", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "playse", args: ["SE_EXIT"] },
      { cmd: "fadescreenspeed", args: ["FADE_TO_BLACK", 4] },
      { cmd: "setflag", args: ["FLAG_WALLACE_GOES_TO_SKY_PILLAR"] },
      { cmd: "setvar", args: ["VAR_SOOTOPOLIS_CITY_STATE", 3] },
      { cmd: "removeobject", args: ["LOCALID_CAVE_OF_ORIGIN_WALLACE"] },
      { cmd: "clearflag", args: ["FLAG_HIDE_SKY_PILLAR_WALLACE"] },
      { cmd: "fadescreen", args: ["FADE_FROM_BLACK"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "CaveOfOrigin_B1F_Text_WallaceStory": "Ah, so you are {PLAYER}{KUN}?\\nI've heard tales of your exploits.\\pMy name is WALLACE.\\pI was once the GYM LEADER of\\nSOOTOPOLIS, but something came up.\\pSo now, I've entrusted my mentor JUAN\\nwith the GYM's operation.\\p… … … … … …\\n… … … … … …\\pGROUDON and KYOGRE, the two POKéMON\\nwreaking havoc here, are considered\\lto be super-ancient POKéMON.\\pBut there aren't just two super-\\nancient POKéMON.\\pThere is one more somewhere.\\pSomewhere, there is a super-\\nancient POKéMON named RAYQUAZA.\\pIt's said that it was RAYQUAZA that\\nbecalmed the two combatants in\\lthe distant past.\\pBut even I have no clue as to\\nRAYQUAZA's whereabouts…",
    "CaveOfOrigin_B1F_Text_WhereIsRayquaza": "WALLACE: {PLAYER}{KUN}, do you perhaps\\nknow where RAYQUAZA is now?\\pIf you do, please tell me.",
    "CaveOfOrigin_B1F_Text_ButWereInCaveOfOrigin": "WALLACE: The CAVE OF ORIGIN?\\pBut that's right here!\\nI need you to do better than that!\\pPlease, I need you to think about\\nwhere RAYQUAZA might be right now.",
    "CaveOfOrigin_B1F_Text_OldLadyDidntMentionThat": "WALLACE: MT. PYRE?\\pBut when I met the old lady there\\nearlier, she made no mention of it.\\pI very much doubt that the old lady\\nwould try to hide something from me…\\p{PLAYER}{KUN}, could you think about this\\nmore carefully for me?",
    "CaveOfOrigin_B1F_Text_CantYouRememberSomehow": "WALLACE: Huh? You don't remember?\\nHmm… That's a problem…\\pCan't you remember somehow?",
    "CaveOfOrigin_B1F_Text_WellHeadToSkyPillar": "WALLACE: The SKY PILLAR?\\pThat's it!\\nIt must be the SKY PILLAR!\\p{PLAYER}{KUN}, there's not a moment to lose!\\nWe'll head to the SKY PILLAR right away!",
  },
};

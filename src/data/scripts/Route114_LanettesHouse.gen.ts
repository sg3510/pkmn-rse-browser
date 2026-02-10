// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route114_LanettesHouse_OnTransition",
  },
  scripts: {
    "Route114_LanettesHouse_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_LANETTES_HOUSE"] },
      { cmd: "end" },
    ],
    "Route114_LanettesHouse_EventScript_Lanette": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_DOLL_LANETTE", "Route114_LanettesHouse_EventScript_OfferAdvice"] },
      { cmd: "setflag", args: ["FLAG_SYS_PC_LANETTE"] },
      { cmd: "msgbox", args: ["Route114_LanettesHouse_Text_EverythingClutteredKeepThis", "MSGBOX_DEFAULT"] },
      { cmd: "givedecoration", args: ["DECOR_LOTAD_DOLL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowNoRoomForDecor"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_DOLL_LANETTE"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_LanettesHouse_EventScript_OfferAdvice": [
      { cmd: "msgbox", args: ["Route114_LanettesHouse_Text_OrganizeYourBoxes", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_LanettesHouse_EventScript_Notebook": [
      { cmd: "lockall" },
      { cmd: "msgbox", args: ["Route114_LanettesHouse_Text_ResearchNotesPage1", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "Route114_LanettesHouse_EventScript_NotebookPage2"] },
      { cmd: "msgbox", args: ["Route114_LanettesHouse_Text_ClosedTheNotebook", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route114_LanettesHouse_EventScript_NotebookPage2": [
      { cmd: "msgbox", args: ["Route114_LanettesHouse_Text_ResearchNotesPage2", "MSGBOX_YESNO"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "YES", "Route114_LanettesHouse_EventScript_NotebookPage3"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route114_LanettesHouse_EventScript_NotebookPage3": [
      { cmd: "msgbox", args: ["Route114_LanettesHouse_Text_ResearchNotesPage3", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "Route114_LanettesHouse_EventScript_PC": [
      { cmd: "msgbox", args: ["Route114_LanettesHouse_Text_EmailFromBill", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route114_LanettesHouse_Text_EverythingClutteredKeepThis": "LANETTE: Oh! {PLAYER}{KUN}!\\pI'm sorry everything is so cluttered…\\nWhen I get engrossed in research,\\lthings end up this way…\\pThis is embarrassing… Please keep\\nthis a secret in exchange for this.",
    "Route114_LanettesHouse_Text_OrganizeYourBoxes": "May I offer advice about my POKéMON\\nStorage System?\\pYou should organize your BOXES so you\\ncan tell which POKéMON are in them.",
    "Route114_LanettesHouse_Text_ResearchNotesPage1": "It's LANETTE's research notes.\\nThere's information about BOXES.\\pDesign BOXES to hold 30 POKéMON each.\\pEach TRAINER should be able to store\\n420 POKéMON on the PC system.\\pKeep reading?",
    "Route114_LanettesHouse_Text_ResearchNotesPage2": "A marking system should be added to\\nmake POKéMON easier to organize.\\pThe name and wallpaper design of each\\nBOX will be made changeable to please\\lthe stored POKéMON.\\pKeep reading?",
    "Route114_LanettesHouse_Text_ResearchNotesPage3": "When storing a POKéMON, it should be\\nsent to the BOX inspected last.\\pIf that BOX is full, the received\\nPOKéMON is stored in the next BOX.\\pIn other words, when a BOX is examined,\\nit is automatically selected as the BOX\\lto which POKéMON are sent.",
    "Route114_LanettesHouse_Text_ClosedTheNotebook": "{PLAYER} closed the notebook.",
    "Route114_LanettesHouse_Text_EmailFromBill": "There's an e-mail from someone on\\nthe PC.\\p“… … … … … … …\\p“Your Storage System offers more\\nconvenience than mine.\\p“It has a lot of user-friendly features\\nthat make it fun and useful, too.\\p“It makes me proud that I played\\na part in its development.\\p“Here's hoping that you'll continue\\nresearch in Storage Systems.\\p“From BILL\\n… … … … … … … …”",
  },
};

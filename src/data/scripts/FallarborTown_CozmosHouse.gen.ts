// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FallarborTown_CozmosHouse_EventScript_ProfCozmo": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_TM_RETURN", "FallarborTown_CozmosHouse_EventScript_GaveMeteorite"] },
      { cmd: "checkitem", args: ["ITEM_METEORITE"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "FallarborTown_CozmosHouse_EventScript_PlayerHasMeteorite"] },
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_MeteoriteWillNeverBeMineNow", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_CozmosHouse_EventScript_PlayerHasMeteorite": [
      { cmd: "call_if_unset", args: ["FLAG_TEMP_2", "FallarborTown_CozmosHouse_EventScript_NoticeMeteorite"] },
      { cmd: "call_if_set", args: ["FLAG_TEMP_2", "FallarborTown_CozmosHouse_EventScript_AskForMeteorite"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "FallarborTown_CozmosHouse_EventScript_DeclineGiveMeteorite"] },
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_PleaseUseThisTM", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_TM_RETURN"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setvar", args: ["VAR_0x8004", "ITEM_METEORITE"] },
      { cmd: "call", args: ["Common_EventScript_PlayerHandedOverTheItem"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_TM_RETURN"] },
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_ReallyGoingToHelpMyResearch", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_CozmosHouse_EventScript_NoticeMeteorite": [
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_MeteoriteWillNeverBeMineNow", "MSGBOX_DEFAULT"] },
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_IsThatMeteoriteMayIHaveIt", "MSGBOX_YESNO"] },
      { cmd: "return" },
    ],
    "FallarborTown_CozmosHouse_EventScript_AskForMeteorite": [
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_MayIHaveMeteorite", "MSGBOX_YESNO"] },
      { cmd: "return" },
    ],
    "FallarborTown_CozmosHouse_EventScript_DeclineGiveMeteorite": [
      { cmd: "setflag", args: ["FLAG_TEMP_2"] },
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_CrushedWithDisappointment", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_CozmosHouse_EventScript_GaveMeteorite": [
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_ReallyGoingToHelpMyResearch", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_CozmosHouse_EventScript_CozmosWife": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_TM_RETURN", "FallarborTown_CozmosHouse_EventScript_CozmoIsHappy"] },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_EVIL_TEAM_MT_CHIMNEY", "FallarborTown_CozmosHouse_EventScript_CozmoIsSad"] },
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_CozmoWentToMeteorFalls", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_CozmosHouse_EventScript_CozmoIsSad": [
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_FeelSorryForCozmo", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_CozmosHouse_EventScript_CozmoIsHappy": [
      { cmd: "msgbox", args: ["FallarborTown_CozmosHouse_Text_CozmoIsSoHappy", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FallarborTown_CozmosHouse_Text_MeteoriteWillNeverBeMineNow": "PROF. COZMO: Oh…\\nI never should have let myself be\\lconned into telling TEAM MAGMA where\\lyou can find METEORITES…\\pThat METEORITE from METEOR FALLS…\\nIt's never going to be mine now…",
    "FallarborTown_CozmosHouse_Text_IsThatMeteoriteMayIHaveIt": "Oh!\\nHah?\\pThat item…\\pCould it be?\\pIs it the METEORITE that TEAM MAGMA\\ntook from METEOR FALLS?\\pPlease, may I have it?\\pI'm not asking for it for free.\\nHow about in exchange for this TM?",
    "FallarborTown_CozmosHouse_Text_PleaseUseThisTM": "PROF. COZMO: This TM, it represents\\nmy feeling of gratitude.\\lPlease use it!",
    "FallarborTown_CozmosHouse_Text_ReallyGoingToHelpMyResearch": "PROF. COZMO: Oh, I can't believe it.\\nThis is really, really great!\\pThis is really going to help my research!",
    "FallarborTown_CozmosHouse_Text_CrushedWithDisappointment": "PROF. COZMO: Oh, but…\\nI'm crushed with disappointment…",
    "FallarborTown_CozmosHouse_Text_MayIHaveMeteorite": "PROF. COZMO: Please, may I have that\\nMETEORITE?\\pI'm not asking for it for free.\\nHow about in exchange for this TM?",
    "FallarborTown_CozmosHouse_Text_CozmoWentToMeteorFalls": "PROF. COZMO went off to METEOR FALLS\\non ROUTE 114 with some people from\\lTEAM MAGMA.",
    "FallarborTown_CozmosHouse_Text_FeelSorryForCozmo": "Poor PROF. COZMO…\\nHe's so depressed… I feel sorry for him.",
    "FallarborTown_CozmosHouse_Text_CozmoIsSoHappy": "Look at PROF. COZMO…\\nHe's so happy! I think it's cute.",
  },
};

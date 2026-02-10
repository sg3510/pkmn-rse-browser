// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "BattleFrontier_RankingHall_EventScript_TowerSinglesRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_TOWER_SINGLES"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_TowerDoublesRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_TOWER_DOUBLES"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_TowerMultisRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_TOWER_MULTIS"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_TowerLinkRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_TOWER_LINK"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_ArenaRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_ARENA"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_PalaceRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_PALACE"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_FactoryRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_FACTORY"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_DomeRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_DOME"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_PikeRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_PIKE"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_PyramidRecords": [
      { cmd: "lockall" },
      { cmd: "setvar", args: ["VAR_0x8005", "RANKING_HALL_PYRAMID"] },
      { cmd: "goto", args: ["BattleFrontier_RankingHall_EventScript_ShowRecords"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_ShowRecords": [
      { cmd: "special", args: ["ShowRankingHallRecordsWindow"] },
      { cmd: "waitbuttonpress" },
      { cmd: "special", args: ["ScrollRankingHallRecordsWindow"] },
      { cmd: "waitbuttonpress" },
      { cmd: "special", args: ["RemoveRecordsWindow"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_Attendant": [
      { cmd: "msgbox", args: ["BattleFrontier_RankingHall_Text_ExplainRankingHall", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_DomePikeFactoryRecordsSign": [
      { cmd: "msgbox", args: ["BattleFrontier_RankingHall_Text_DomePikeFactoryRecords", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_PalaceArenaPyramidRecordsSIgn": [
      { cmd: "msgbox", args: ["BattleFrontier_RankingHall_Text_PalaceArenaPyramidRecords", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_NinjaBoy": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["BattleFrontier_RankingHall_Text_IsYourNameOnThisList", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "BattleFrontier_RankingHall_EventScript_NinjaBoyNameOnList"] },
      { cmd: "msgbox", args: ["BattleFrontier_RankingHall_Text_WorkHarderIfYouSawFriendsName", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_NinjaBoyNameOnList": [
      { cmd: "msgbox", args: ["BattleFrontier_RankingHall_Text_WowThatsSuper", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_RankingHall_EventScript_Boy": [
      { cmd: "msgbox", args: ["BattleFrontier_RankingHall_Text_MyNamesNotUpThere", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "BattleFrontier_RankingHall_Text_ExplainRankingHall": "This is the RANKING HALL.\\pThis is where we recognize the immortal\\nTRAINERS who left great records in\\lBATTLE FRONTIER events.",
    "BattleFrontier_RankingHall_Text_DomePikeFactoryRecords": "BATTLE DOME, BATTLE PIKE,\\nand BATTLE FACTORY Records",
    "BattleFrontier_RankingHall_Text_PalaceArenaPyramidRecords": "BATTLE PALACE, BATTLE ARENA,\\nand BATTLE PYRAMID Records",
    "BattleFrontier_RankingHall_Text_IsYourNameOnThisList": "Hi, is your name on this list?",
    "BattleFrontier_RankingHall_Text_WowThatsSuper": "Wow, that's super!\\nI'll have to try harder, too!",
    "BattleFrontier_RankingHall_Text_WorkHarderIfYouSawFriendsName": "Oh, is that right?\\pIf you saw your friend's name up here,\\nI bet it would make you work harder!",
    "BattleFrontier_RankingHall_Text_MyNamesNotUpThere": "Hmm…\\nMy name's not up there…\\pWell, it's only natural since I haven't\\ntaken any challenges yet.",
  },
};

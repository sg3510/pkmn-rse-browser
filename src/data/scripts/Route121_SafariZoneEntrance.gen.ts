// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onFrame: [
      { var: "VAR_SAFARI_ZONE_STATE", value: 1, script: "Route121_SafariZoneEntrance_EventScript_ExitSafariZone" },
    ],
  },
  scripts: {
    "Route121_SafariZoneEntrance_EventScript_ExitSafariZone": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Route121_SafariZoneEntrance_Movement_ExitSafariZone"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "setvar", args: ["VAR_SAFARI_ZONE_STATE", 0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_WelcomeAttendant": [
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_WelcomeToSafariZone", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_InfoAttendant": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_WelcomeFirstTime", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "Route121_SafariZoneEntrance_EventScript_FirstTimeInfo"] },
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_ComeInAndEnjoy", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_FirstTimeInfo": [
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_FirstTimeInfo", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_EntranceCounterTrigger": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "showmoneybox", args: [0, 0] },
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_WouldYouLikeToPlay", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "Route121_SafariZoneEntrance_EventScript_TryEnterSafariZone"] },
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_PlayAnotherTime", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["Route121_SafariZoneEntrance_EventScript_MovePlayerBackFromCounter"] },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_TryEnterSafariZone": [
      { cmd: "checkitem", args: ["ITEM_POKEBLOCK_CASE"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 0, "Route121_SafariZoneEntrance_EventScript_NoPokeblockCase"] },
      { cmd: "call", args: ["Route121_SafariZoneEntrance_EventScript_CheckHasRoomForPokemon"] },
      { cmd: "checkmoney", args: [500] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 0, "Route121_SafariZoneEntrance_EventScript_NotEnoughMoney"] },
      { cmd: "playse", args: ["SE_SHOP"] },
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_ThatWillBe500Please", "MSGBOX_DEFAULT"] },
      { cmd: "removemoney", args: [500] },
      { cmd: "updatemoneybox" },
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_HereAreYourSafariBalls", "MSGBOX_DEFAULT"] },
      { cmd: "playfanfare", args: ["MUS_OBTAIN_ITEM"] },
      { cmd: "message", args: ["Route121_SafariZoneEntrance_Text_Received30SafariBalls"] },
      { cmd: "waitfanfare" },
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_PleaseEnjoyYourself", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "hidemoneybox" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Route121_SafariZoneEntrance_Movement_EnterSafariZone"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "special", args: ["EnterSafariMode"] },
      { cmd: "setvar", args: ["VAR_SAFARI_ZONE_STATE", 2] },
      { cmd: "clearflag", args: ["FLAG_GOOD_LUCK_SAFARI_ZONE"] },
      { cmd: "warp", args: ["MAP_SAFARI_ZONE_SOUTH", 32, 33] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_CheckHasRoomForPokemon": [
      { cmd: "getpartysize" },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "PARTY_SIZE", "Route121_SafariZoneEntrance_EventScript_HasRoomForPokemon"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ScriptCheckFreePokemonStorageSpace"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 1, "Route121_SafariZoneEntrance_EventScript_HasRoomForPokemon"] },
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_PCIsFull", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["Route121_SafariZoneEntrance_EventScript_MovePlayerBackFromCounter"] },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_HasRoomForPokemon": [
      { cmd: "return" },
    ],
    "Route121_SafariZoneEntrance_EventScript_NoPokeblockCase": [
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_YouNeedPokeblockCase", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["Route121_SafariZoneEntrance_EventScript_MovePlayerBackFromCounter"] },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_NotEnoughMoney": [
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_NotEnoughMoney", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["Route121_SafariZoneEntrance_EventScript_MovePlayerBackFromCounter"] },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_MovePlayerBackFromCounter": [
      { cmd: "closemessage" },
      { cmd: "hidemoneybox" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Route121_SafariZoneEntrance_Movement_BackAwayFromCounter"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route121_SafariZoneEntrance_EventScript_TrainerTipSign": [
      { cmd: "msgbox", args: ["Route121_SafariZoneEntrance_Text_TrainerTip", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "Route121_SafariZoneEntrance_Movement_ExitSafariZone": ["walk_up", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right", "walk_right"],
    "Route121_SafariZoneEntrance_Movement_BackAwayFromCounter": ["walk_right"],
    "Route121_SafariZoneEntrance_Movement_EnterSafariZone": ["walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_left", "walk_down", "delay_16"],
  },
  text: {
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SlateportCity_BattleTentBattleRoom_OnTransition",
    onFrame: [
      { var: "VAR_TEMP_0", value: 0, script: "SlateportCity_BattleTentBattleRoom_EventScript_EnterRoom" },
    ],
    onWarpInto: [
      { var: "VAR_TEMP_1", value: 0, script: "SlateportCity_BattleTentBattleRoom_EventScript_SetUpObjects" },
    ],
  },
  scripts: {
    "SlateportCity_BattleTentBattleRoom_OnTransition": [
      { cmd: "call", args: ["SlateportCity_BattleTentBattleRoom_EventScript_SetPlayerGfx"] },
      { cmd: "end" },
    ],
    "SlateportCity_BattleTentBattleRoom_EventScript_SetPlayerGfx": [
      { cmd: "checkplayergender" },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "MALE", "SlateportCity_BattleTentBattleRoom_EventScript_SetPlayerGfxMale"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FEMALE", "SlateportCity_BattleTentBattleRoom_EventScript_SetPlayerGfxFemale"] },
      { cmd: "return" },
    ],
    "SlateportCity_BattleTentBattleRoom_EventScript_SetPlayerGfxMale": [
      { cmd: "setvar", args: ["VAR_OBJ_GFX_ID_1", "OBJ_EVENT_GFX_RIVAL_BRENDAN_NORMAL"] },
      { cmd: "return" },
    ],
    "SlateportCity_BattleTentBattleRoom_EventScript_SetPlayerGfxFemale": [
      { cmd: "setvar", args: ["VAR_OBJ_GFX_ID_1", "OBJ_EVENT_GFX_RIVAL_MAY_NORMAL"] },
      { cmd: "return" },
    ],
    "SlateportCity_BattleTentBattleRoom_EventScript_SetUpObjects": [
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "hideobjectat", args: ["LOCALID_PLAYER", "MAP_FALLARBOR_TOWN_BATTLE_TENT_BATTLE_ROOM"] },
      { cmd: "hideobjectat", args: ["LOCALID_SLATEPORT_TENT_BATTLE_OPPONENT", "MAP_SLATEPORT_CITY_BATTLE_TENT_BATTLE_ROOM"] },
      { cmd: "end" },
    ],
    "SlateportCity_BattleTentBattleRoom_EventScript_EnterRoom": [
      { cmd: "applymovement", args: ["LOCALID_SLATEPORT_TENT_BATTLE_PLAYER", "SlateportCity_BattleTentBattleRoom_Movement_PlayerEnter"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "factory_setopponentgfx" },
      { cmd: "setobjectxyperm", args: ["LOCALID_SLATEPORT_TENT_BATTLE_OPPONENT", 5, 1] },
      { cmd: "removeobject", args: ["LOCALID_SLATEPORT_TENT_BATTLE_OPPONENT"] },
      { cmd: "addobject", args: ["LOCALID_SLATEPORT_TENT_BATTLE_OPPONENT"] },
      { cmd: "applymovement", args: ["LOCALID_SLATEPORT_TENT_BATTLE_OPPONENT", "SlateportCity_BattleTentBattleRoom_Movement_OpponentEnter"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "battletent_getopponentintro" },
      { cmd: "lockall" },
      { cmd: "msgbox", args: ["gStringVar4", "MSGBOX_DEFAULT"] },
      { cmd: "waitmessage" },
      { cmd: "closemessage" },
      { cmd: "special", args: ["HealPlayerParty"] },
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIAL_BATTLE_FACTORY"] },
      { cmd: "setvar", args: ["VAR_0x8005", 0] },
      { cmd: "special", args: ["DoSpecialTrainerBattle"] },
      { cmd: "waitstate" },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [1, "SlateportCity_BattleTentBattleRoom_EventScript_DefeatedOpponent"] },
    ],
    "SlateportCity_BattleTent_EventScript_WarpToLobbyLost": [
      { cmd: "frontier_set", args: ["FRONTIER_DATA_CHALLENGE_STATUS", "CHALLENGE_STATUS_LOST"] },
      { cmd: "special", args: ["LoadPlayerParty"] },
      { cmd: "warp", args: ["MAP_SLATEPORT_CITY_BATTLE_TENT_LOBBY", 6, 6] },
      { cmd: "waitstate" },
    ],
    "SlateportCity_BattleTentBattleRoom_EventScript_DefeatedOpponent": [
      { cmd: "frontier_get", args: ["FRONTIER_DATA_BATTLE_NUM"] },
      { cmd: "addvar", args: ["VAR_RESULT", 1] },
      { cmd: "frontier_set", args: ["FRONTIER_DATA_BATTLE_NUM", "VAR_RESULT"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [3, "SlateportCity_BattleTentBattleRoom_EventScript_WarpToLobbyWon"] },
      { cmd: "setvar", args: ["VAR_0x8006", 1] },
      { cmd: "warp", args: ["MAP_SLATEPORT_CITY_BATTLE_TENT_CORRIDOR", 2, 3] },
      { cmd: "waitstate" },
    ],
    "SlateportCity_BattleTentBattleRoom_EventScript_WarpToLobbyWon": [
      { cmd: "frontier_set", args: ["FRONTIER_DATA_CHALLENGE_STATUS", "CHALLENGE_STATUS_WON"] },
      { cmd: "special", args: ["LoadPlayerParty"] },
      { cmd: "warp", args: ["MAP_SLATEPORT_CITY_BATTLE_TENT_LOBBY", 6, 6] },
      { cmd: "waitstate" },
    ],
  },
  movements: {
    "SlateportCity_BattleTentBattleRoom_Movement_PlayerEnter": ["walk_up", "walk_up", "walk_up", "walk_in_place_faster_right"],
    "SlateportCity_BattleTentBattleRoom_Movement_OpponentEnter": ["walk_down", "walk_down", "walk_down", "walk_down", "walk_in_place_faster_left"],
  },
  text: {
  },
};

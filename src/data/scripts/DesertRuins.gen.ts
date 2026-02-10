// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "DesertRuins_OnLoad",
    onTransition: "DesertRuins_OnTransition",
    onResume: "DesertRuins_OnResume",
  },
  scripts: {
    "DesertRuins_OnResume": [
      { cmd: "call_if_set", args: ["FLAG_SYS_CTRL_OBJ_DELETE", "DesertRuins_EventScript_TryRemoveRegirock"] },
      { cmd: "end" },
    ],
    "DesertRuins_EventScript_TryRemoveRegirock": [
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "B_OUTCOME_CAUGHT", "Common_EventScript_NopReturn"] },
      { cmd: "removeobject", args: ["VAR_LAST_TALKED"] },
      { cmd: "return" },
    ],
    "DesertRuins_OnLoad": [
      { cmd: "call_if_unset", args: ["FLAG_SYS_REGIROCK_PUZZLE_COMPLETED", "DesertRuins_EventScript_HideRegiEntrance"] },
      { cmd: "end" },
    ],
    "DesertRuins_EventScript_HideRegiEntrance": [
      { cmd: "setmetatile", args: [7, 19, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [8, 19, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [9, 19, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [7, 20, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "setmetatile", args: [8, 20, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "setmetatile", args: [9, 20, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "return" },
    ],
    "DesertRuins_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_DESERT_RUINS"] },
      { cmd: "call_if_unset", args: ["FLAG_DEFEATED_REGIROCK", "DesertRuins_EventScript_ShowRegirock"] },
      { cmd: "end" },
    ],
    "DesertRuins_EventScript_ShowRegirock": [
      { cmd: "clearflag", args: ["FLAG_HIDE_REGIROCK"] },
      { cmd: "return" },
    ],
    "DesertRuins_EventScript_CaveEntranceMiddle": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_SYS_REGIROCK_PUZZLE_COMPLETED", "DesertRuins_EventScript_BigHoleInWall"] },
      { cmd: "braillemsgbox", args: ["DesertRuins_Braille_UseRockSmash"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "DesertRuins_EventScript_BigHoleInWall": [
      { cmd: "msgbox", args: ["gText_BigHoleInTheWall", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "DesertRuins_EventScript_CaveEntranceSide": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["DesertRuins_Braille_UseRockSmash"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "DesertRuins_EventScript_Regirock": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_REGIROCK", "CRY_MODE_ENCOUNTER"] },
      { cmd: "delay", args: [40] },
      { cmd: "waitmoncry" },
      { cmd: "setwildbattle", args: ["SPECIES_REGIROCK", 40] },
      { cmd: "setflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "special", args: ["StartRegiBattle"] },
      { cmd: "waitstate" },
      { cmd: "clearflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_WON", "DesertRuins_EventScript_DefeatedRegirock"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_RAN", "DesertRuins_EventScript_RanFromRegirock"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_PLAYER_TELEPORTED", "DesertRuins_EventScript_RanFromRegirock"] },
      { cmd: "setflag", args: ["FLAG_DEFEATED_REGIROCK"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "DesertRuins_EventScript_DefeatedRegirock": [
      { cmd: "setflag", args: ["FLAG_DEFEATED_REGIROCK"] },
      { cmd: "goto", args: ["Common_EventScript_RemoveStaticPokemon"] },
      { cmd: "end" },
    ],
    "DesertRuins_EventScript_RanFromRegirock": [
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIES_REGIROCK"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

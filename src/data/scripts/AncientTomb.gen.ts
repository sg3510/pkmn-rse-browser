// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "AncientTomb_OnLoad",
    onTransition: "AncientTomb_OnTransition",
    onResume: "AncientTomb_OnResume",
  },
  scripts: {
    "AncientTomb_OnResume": [
      { cmd: "call_if_set", args: ["FLAG_SYS_CTRL_OBJ_DELETE", "AncientTomb_EventScript_TryRemoveRegisteel"] },
      { cmd: "end" },
    ],
    "AncientTomb_EventScript_TryRemoveRegisteel": [
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "B_OUTCOME_CAUGHT", "Common_EventScript_NopReturn"] },
      { cmd: "removeobject", args: ["VAR_LAST_TALKED"] },
      { cmd: "return" },
    ],
    "AncientTomb_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_ANCIENT_TOMB"] },
      { cmd: "call_if_unset", args: ["FLAG_DEFEATED_REGISTEEL", "AncientTomb_EventScript_ShowRegisteel"] },
      { cmd: "end" },
    ],
    "AncientTomb_EventScript_ShowRegisteel": [
      { cmd: "clearflag", args: ["FLAG_HIDE_REGISTEEL"] },
      { cmd: "return" },
    ],
    "AncientTomb_OnLoad": [
      { cmd: "call_if_unset", args: ["FLAG_SYS_REGISTEEL_PUZZLE_COMPLETED", "AncientTomb_EventScript_HideRegiEntrance"] },
      { cmd: "end" },
    ],
    "AncientTomb_EventScript_HideRegiEntrance": [
      { cmd: "setmetatile", args: [7, 19, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [8, 19, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [9, 19, "METATILE_Cave_EntranceCover", "TRUE"] },
      { cmd: "setmetatile", args: [7, 20, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "setmetatile", args: [8, 20, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "setmetatile", args: [9, 20, "METATILE_Cave_SealedChamberBraille_Mid", "TRUE"] },
      { cmd: "return" },
    ],
    "AncientTomb_EventScript_CaveEntranceMiddle": [
      { cmd: "lockall" },
      { cmd: "goto_if_set", args: ["FLAG_SYS_REGISTEEL_PUZZLE_COMPLETED", "AncientTomb_EventScript_BigHoleInWall"] },
      { cmd: "braillemsgbox", args: ["AncientTomb_Braille_ShineInTheMiddle"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AncientTomb_EventScript_BigHoleInWall": [
      { cmd: "msgbox", args: ["gText_BigHoleInTheWall", "MSGBOX_DEFAULT"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AncientTomb_EventScript_CaveEntranceSide": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["AncientTomb_Braille_ShineInTheMiddle"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "AncientTomb_EventScript_Registeel": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_REGISTEEL", "CRY_MODE_ENCOUNTER"] },
      { cmd: "delay", args: [40] },
      { cmd: "waitmoncry" },
      { cmd: "setwildbattle", args: ["SPECIES_REGISTEEL", 40] },
      { cmd: "setflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "special", args: ["StartRegiBattle"] },
      { cmd: "waitstate" },
      { cmd: "clearflag", args: ["FLAG_SYS_CTRL_OBJ_DELETE"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetBattleOutcome"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_WON", "AncientTomb_EventScript_DefeatedRegisteel"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_RAN", "AncientTomb_EventScript_RanFromRegisteel"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "B_OUTCOME_PLAYER_TELEPORTED", "AncientTomb_EventScript_RanFromRegisteel"] },
      { cmd: "setflag", args: ["FLAG_DEFEATED_REGISTEEL"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AncientTomb_EventScript_DefeatedRegisteel": [
      { cmd: "setflag", args: ["FLAG_DEFEATED_REGISTEEL"] },
      { cmd: "goto", args: ["Common_EventScript_RemoveStaticPokemon"] },
      { cmd: "end" },
    ],
    "AncientTomb_EventScript_RanFromRegisteel": [
      { cmd: "setvar", args: ["VAR_0x8004", "SPECIES_REGISTEEL"] },
      { cmd: "goto", args: ["Common_EventScript_LegendaryFlewAway"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

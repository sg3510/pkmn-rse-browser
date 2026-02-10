// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MossdeepCity_House2_EventScript_Man": [
      { cmd: "msgbox", args: ["MossdeepCity_House2_Text_SisterMailsBoyfriendInFortree", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MossdeepCity_House2_EventScript_Twin": [
      { cmd: "msgbox", args: ["MossdeepCity_House2_Text_PokemonCarriesMailBackAndForth", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MossdeepCity_House2_EventScript_Wingull": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_WINGULL", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["MossdeepCity_House2_Text_Wingull", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "closemessage" },
      { cmd: "setflag", args: ["FLAG_WINGULL_DELIVERED_MAIL"] },
      { cmd: "clearflag", args: ["FLAG_HIDE_FORTREE_CITY_HOUSE_4_WINGULL"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_NORTH", "MossdeepCity_House2_EventScript_WingullExitNorth"] },
      { cmd: "call_if_eq", args: ["VAR_FACING", "DIR_WEST", "MossdeepCity_House2_EventScript_WingullExitWest"] },
      { cmd: "removeobject", args: ["LOCALID_MOSSDEEP_HOUSE_WINGULL"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House2_EventScript_WingullExitNorth": [
      { cmd: "applymovement", args: ["LOCALID_MOSSDEEP_HOUSE_WINGULL", "MossdeepCity_House2_Movement_WingullExitNorth"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
    "MossdeepCity_House2_EventScript_WingullExitWest": [
      { cmd: "applymovement", args: ["LOCALID_MOSSDEEP_HOUSE_WINGULL", "MossdeepCity_House2_Movement_WingullExitEast"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "return" },
    ],
  },
  movements: {
    "MossdeepCity_House2_Movement_WingullExitNorth": ["walk_fast_right", "walk_fast_down", "walk_fast_down", "walk_fast_left", "walk_fast_down", "delay_8"],
    "MossdeepCity_House2_Movement_WingullExitEast": ["walk_fast_down", "walk_fast_down", "walk_fast_down", "delay_8"],
  },
  text: {
    "MossdeepCity_House2_Text_SisterMailsBoyfriendInFortree": "My little sister exchanges MAIL with\\nher boyfriend in FORTREE.\\pI don't envy her one bit at all.",
    "MossdeepCity_House2_Text_PokemonCarriesMailBackAndForth": "Even though I can't see my friend in\\nFORTREE, my POKéMON carries MAIL\\lback and forth for us.\\pI'm not lonesome, even though we're\\napart.",
    "MossdeepCity_House2_Text_Wingull": "WINGULL: Pihyoh!",
  },
};

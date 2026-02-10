// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route114_FossilManiacsHouse_OnTransition",
  },
  scripts: {
    "Route114_FossilManiacsHouse_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_FOSSIL_MANIACS_HOUSE"] },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsHouse_EventScript_FossilManiacsBrother": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_TM_DIG", "Route114_FossilManiacsHouse_EventScript_ReceivedDig"] },
      { cmd: "msgbox", args: ["Route114_FossilManiacsHouse_Text_HaveThisToDigLikeMyBrother", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_TM_DIG"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_TM_DIG"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsHouse_EventScript_ReceivedDig": [
      { cmd: "msgbox", args: ["Route114_FossilManiacsHouse_Text_DigReturnsYouToEntrance", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsHouse_EventScript_RockDisplay": [
      { cmd: "msgbox", args: ["Route114_FossilManiacsHouse_Text_RocksFillDisplayCase", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "Route114_FossilManiacsHouse_EventScript_Bookshelf": [
      { cmd: "msgbox", args: ["Route114_FossilManiacsHouse_Text_CrammedWithBooks", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "Route114_FossilManiacsHouse_Text_HaveThisToDigLikeMyBrother": "My big brother's the FOSSIL MANIAC…\\nHe's a nice guy who loves FOSSILS…\\pHe loves digging holes, too…\\nHe dug this hole by himself…\\pYou can have this, so you can DIG\\nholes just like my big brother…",
    "Route114_FossilManiacsHouse_Text_DigReturnsYouToEntrance": "If you make a POKéMON DIG inside a\\ncave, you're returned to the entrance…",
    "Route114_FossilManiacsHouse_Text_RocksFillDisplayCase": "Rocks in peculiar shapes fill\\nthe display case…",
    "Route114_FossilManiacsHouse_Text_CrammedWithBooks": "THE COMPOSITION OF STRATA…\\nHOW RAIN SHAPES THE LAND…\\lSTONES, SOIL, AND ROCK…\\pIt's crammed with books.",
  },
};

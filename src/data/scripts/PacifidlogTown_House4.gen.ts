// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "PacifidlogTown_House4_EventScript_LittleGirl": [
      { cmd: "msgbox", args: ["PacifidlogTown_House4_Text_SkyPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_House4_EventScript_Woman": [
      { cmd: "msgbox", args: ["PacifidlogTown_House4_Text_PeopleSawHighFlyingPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_House4_EventScript_Boy": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["PacifidlogTown_House4_Text_WhereDidYouComeFrom", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "PacifidlogTown_House4_EventScript_Yes"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "PacifidlogTown_House4_EventScript_No"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_House4_EventScript_Yes": [
      { cmd: "msgbox", args: ["PacifidlogTown_House4_Text_YesTown", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PacifidlogTown_House4_EventScript_No": [
      { cmd: "msgbox", args: ["PacifidlogTown_House4_Text_YouHaveToComeFromSomewhere", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "PacifidlogTown_House4_Text_PeopleSawHighFlyingPokemon": "People were saying they saw a POKéMON\\nflying high above HOENN.\\pIs it flying around all the time?\\nDoesn't it need to rest somewhere?",
    "PacifidlogTown_House4_Text_SkyPokemon": "A sky POKéMON!\\nA sky POKéMON!",
    "PacifidlogTown_House4_Text_WhereDidYouComeFrom": "Where did you come from?",
    "PacifidlogTown_House4_Text_YesTown": "Yes?\\nYES TOWN?\\pI've never heard of a place like that.",
    "PacifidlogTown_House4_Text_YouHaveToComeFromSomewhere": "No? That doesn't make any sense.\\nYou have to come from somewhere.\\pOh! Wait! You're not going to say you\\nwere born at the bottom of the sea?",
  },
};

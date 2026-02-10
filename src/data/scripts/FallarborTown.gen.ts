// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "FallarborTown_OnTransition",
  },
  scripts: {
    "FallarborTown_OnTransition": [
      { cmd: "setflag", args: ["FLAG_VISITED_FALLARBOR_TOWN"] },
      { cmd: "setvar", args: ["VAR_CONTEST_HALL_STATE", 0] },
      { cmd: "clearflag", args: ["FLAG_CONTEST_SKETCH_CREATED"] },
      { cmd: "end" },
    ],
    "FallarborTown_EventScript_ExpertM": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_EVIL_TEAM_MT_CHIMNEY", "FallarborTown_EventScript_ExpertMNormal"] },
      { cmd: "msgbox", args: ["FallarborTown_Text_ShadyCharactersCozmosHome", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_EventScript_ExpertMNormal": [
      { cmd: "msgbox", args: ["FallarborTown_Text_RegionKnownForMeteors", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_EventScript_Girl": [
      { cmd: "msgbox", args: ["FallarborTown_Text_MyPreciousAzurill", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FallarborTown_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["FallarborTown_Text_HaveYouChallengedFlannery", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FallarborTown_EventScript_Azurill": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_AZURILL", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["FallarborTown_Text_Azurill", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_EventScript_BattleTentSign": [
      { cmd: "msgbox", args: ["FallarborTown_Text_BattleTentSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "FallarborTown_EventScript_TownSign": [
      { cmd: "msgbox", args: ["FallarborTown_Text_TownSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "FallarborTown_EventScript_MoveTutorSign": [
      { cmd: "msgbox", args: ["FallarborTown_Text_MoveTutorSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FallarborTown_Text_ShadyCharactersCozmosHome": "Something's happening,\\nand I don't like it!\\pI've seen shady characters wandering\\nin and out of PROF. COZMO's home…",
    "FallarborTown_Text_RegionKnownForMeteors": "This region's been known for meteors\\nsince the olden days.\\pThey say METEOR FALLS was gouged out\\nby a falling meteorite long ago.",
    "FallarborTown_Text_MyPreciousAzurill": "See! Take a look!\\nThis is my precious AZURILL!\\pIt's slick and smooth and plushy, too!",
    "FallarborTown_Text_Azurill": "AZURILL: Rooreelooo.",
    "FallarborTown_Text_HaveYouChallengedFlannery": "Have you already challenged FLANNERY,\\nthe LEADER of LAVARIDGE GYM?\\pThe girl's grandfather was famous.\\nHe was one of the ELITE FOUR in the\\lPOKéMON LEAGUE at one point.\\pIt wouldn't surprise me to see FLANNERY\\nbecome a great TRAINER in her own\\lright.",
    "FallarborTown_Text_BattleTentSign": "BATTLE TENT FALLARBOR SITE\\n“May the Greatest Teams Gather!”",
    "FallarborTown_Text_TownSign": "FALLARBOR TOWN\\n“A farm community with small gardens.”",
    "FallarborTown_Text_MoveTutorSign": "MOVE TUTOR'S HOUSE\\n“New moves taught to POKéMON.”",
  },
};

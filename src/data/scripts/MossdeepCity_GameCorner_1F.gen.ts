// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "CableClub_OnLoad",
    onFrame: [
      { var: "VAR_CABLE_CLUB_STATE", value: "USING_MINIGAME", script: "CableClub_EventScript_ExitMinigameRoom" },
    ],
    onWarpInto: [
      { var: "VAR_CABLE_CLUB_STATE", value: "USING_MINIGAME", script: "CableClub_EventScript_CheckTurnAttendant" },
    ],
  },
  scripts: {
    "MossdeepCity_GameCorner_1F_EventScript_InfoMan": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto", args: ["MossdeepCity_GameCorner_1F_EventScript_InfoMan2"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_GameCorner_1F_EventScript_OldMan": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto", args: ["MossdeepCity_GameCorner_1F_EventScript_OldMan2"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RS_MysteryEventsHouse_EventScript_Door": [
      { cmd: "msgbox", args: ["RS_MysteryEventsHouse_Text_DoorIsLocked", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RS_MysteryEventsHouse_Text_OldManGreeting": "When I was young, I traveled the world\\nas a POKéMON TRAINER.\\pNow that I've become an old buzzard,\\nmy only amusement is watching young\\lTRAINERS battle.",
    "RS_MysteryEventsHouse_Text_DoorIsLocked": "The door appears to be locked.",
    "RS_MysteryEventsHouse_Text_ChallengeVisitingTrainer": "A TRAINER named {STR_VAR_1} is\\nvisiting my home.\\pWould you like to challenge\\n{STR_VAR_1}?",
    "RS_MysteryEventsHouse_Text_YouWontBattle": "You won't battle? I'm disappointed\\nthat I can't see you battle…",
    "RS_MysteryEventsHouse_Text_KeepItToA3On3": "Oh, good, good!\\pBut my house isn't all that sturdy.\\pCould I ask you to keep it down to\\na 3-on-3 match?",
    "RS_MysteryEventsHouse_Text_SaveYourProgress": "Before you two battle, you should\\nsave your progress.",
    "RS_MysteryEventsHouse_Text_HopeToSeeAGoodMatch": "I hope to see a good match!",
    "RS_MysteryEventsHouse_Text_BattleTie": "So, it became a standoff.\\pIt was a brilliant match in which\\nneither side conceded a step!",
    "RS_MysteryEventsHouse_Text_BattleWon": "That was superlative!\\pWhy, it was like seeing myself in\\nmy youth again!",
    "RS_MysteryEventsHouse_Text_BattleLost": "Ah, too bad for you!\\pBut it was a good match.\\nI hope you can win next time.",
  },
};

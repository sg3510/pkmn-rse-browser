// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MeteorFalls_StevensCave_EventScript_Steven": [
      { cmd: "lock" },
      { cmd: "goto_if_set", args: ["FLAG_DEFEATED_METEOR_FALLS_STEVEN", "MeteorFalls_StevensCave_EventScript_Defeated"] },
      { cmd: "waitse" },
      { cmd: "playse", args: ["SE_PIN"] },
      { cmd: "applymovement", args: ["LOCALID_METEOR_FALLS_STEVEN", "Common_Movement_ExclamationMark"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_METEOR_FALLS_STEVEN", "Common_Movement_Delay48"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "applymovement", args: ["LOCALID_METEOR_FALLS_STEVEN", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["MeteorFalls_StevensCave_Text_ShouldKnowHowGoodIAmExpectWorst", "MSGBOX_DEFAULT"] },
      { cmd: "trainerbattle_no_intro", args: ["TRAINER_STEVEN", "MeteorFalls_StevensCave_Text_StevenDefeat"] },
      { cmd: "msgbox", args: ["MeteorFalls_StevensCave_Text_MyPredictionCameTrue", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_DEFEATED_METEOR_FALLS_STEVEN"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MeteorFalls_StevensCave_EventScript_Defeated": [
      { cmd: "applymovement", args: ["LOCALID_METEOR_FALLS_STEVEN", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["MeteorFalls_StevensCave_Text_MyPredictionCameTrue", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MeteorFalls_StevensCave_Text_ShouldKnowHowGoodIAmExpectWorst": "STEVEN: Oh, wow, {PLAYER}{KUN}.\\nI'm amazed you knew where to find me.\\pDo you, uh…maybe think of me as\\njust a rock maniac?\\pNo, that can't be right.\\pWe battled alongside each other at\\nthe SOOTOPOLIS SPACE CENTER.\\pYou should have a very good idea\\nabout how good I am.\\pOkay, {PLAYER}{KUN}, if you're going to mount\\na serious challenge, expect the worst!",
    "MeteorFalls_StevensCave_Text_StevenDefeat": "You…\\nI had no idea you'd become so strong…",
    "MeteorFalls_StevensCave_Text_MyPredictionCameTrue": "STEVEN: Come to think of it, ever since\\nour paths first crossed in GRANITE\\lCAVE in DEWFORD, I had this feeling.\\pI thought that you would eventually\\nbecome the CHAMPION.\\pMy predictions usually come true.\\pAnd where will you go from here?\\p… … … … … …\\n… … … … … …\\pFufufu, even I couldn't tell you that.",
  },
};

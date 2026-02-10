// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "PacifidlogTown_OnTransition",
    onResume: "PacifidlogTown_OnResume",
  },
  scripts: {
    "PacifidlogTown_OnTransition": [
      { cmd: "setflag", args: ["FLAG_VISITED_PACIFIDLOG_TOWN"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_OnResume": [
      { cmd: "setstepcallback", args: ["STEP_CB_PACIFIDLOG_BRIDGE"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_EventScript_NinjaBoy": [
      { cmd: "msgbox", args: ["PacifidlogTown_Text_NeatHousesOnWater", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_EventScript_Girl": [
      { cmd: "msgbox", args: ["PacifidlogTown_Text_FastRunningCurrent", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_EventScript_Fisherman": [
      { cmd: "msgbox", args: ["PacifidlogTown_Text_SkyPillarTooScary", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PacifidlogTown_EventScript_TownSign": [
      { cmd: "msgbox", args: ["PacifidlogTown_Text_TownSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "PacifidlogTown_Text_FastRunningCurrent": "The sea between PACIFIDLOG and\\nSLATEPORT has a fast-running tide.\\pIf you decide to SURF, you could end\\nup swept away somewhere else.",
    "PacifidlogTown_Text_NeatHousesOnWater": "See, isn't it neat?\\nThese houses are on water!\\pI was born here!",
    "PacifidlogTown_Text_SkyPillarTooScary": "The SKY PILLAR?\\p…Oh, you must mean that tall, tall\\ntower a little further out.\\pIf you asked me, I wouldn't climb it.\\nIt's too scary to get up that high.\\pLife at sea level in PACIFIDLOG,\\nthat suits me fine.",
    "PacifidlogTown_Text_TownSign": "PACIFIDLOG TOWN\\p“Where the morning sun smiles upon\\nthe waters.”",
  },
};

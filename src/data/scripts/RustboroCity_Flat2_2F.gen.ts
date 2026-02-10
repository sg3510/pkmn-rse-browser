// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "RustboroCity_Flat2_2F_EventScript_OldMan": [
      { cmd: "msgbox", args: ["RustboroCity_Flat2_2F_Text_DevonWasTinyInOldDays", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_Flat2_2F_EventScript_NinjaBoy": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_PREMIER_BALL_RUSTBORO", "RustboroCity_Flat2_2F_EventScript_GavePremierBall"] },
      { cmd: "msgbox", args: ["RustboroCity_Flat2_2F_Text_MyDaddyMadeThisYouCanHaveIt", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_PREMIER_BALL"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_PREMIER_BALL_RUSTBORO"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_Flat2_2F_EventScript_GavePremierBall": [
      { cmd: "msgbox", args: ["RustboroCity_Flat2_2F_Text_GoingToWorkAtDevonToo", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_Flat2_2F_Text_DevonWasTinyInOldDays": "Way back in the old days, DEVON was just\\na teeny, tiny company.",
    "RustboroCity_Flat2_2F_Text_MyDaddyMadeThisYouCanHaveIt": "My daddy's working at the CORPORATION.\\pMy daddy made this!\\nBut I can't use it, so you can have it.",
    "RustboroCity_Flat2_2F_Text_GoingToWorkAtDevonToo": "My daddy's working at the CORPORATION.\\pWhen I grow up, I'm going to work for\\nDEVON, too.",
  },
};

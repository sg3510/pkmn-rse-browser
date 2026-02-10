// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MirageTower_4F_EventScript_RootFossil": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["MirageTower_4F_Text_TakeRootFossil", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "MirageTower_4F_EventScript_LeaveRootFossil"] },
      { cmd: "giveitem", args: ["ITEM_ROOT_FOSSIL"] },
      { cmd: "closemessage" },
      { cmd: "setflag", args: ["FLAG_HIDE_MIRAGE_TOWER_ROOT_FOSSIL"] },
      { cmd: "setflag", args: ["FLAG_HIDE_MIRAGE_TOWER_CLAW_FOSSIL"] },
      { cmd: "removeobject", args: ["LOCALID_MIRAGE_ROOT_FOSSIL"] },
      { cmd: "delay", args: [30] },
      { cmd: "setflag", args: ["FLAG_CHOSE_ROOT_FOSSIL"] },
      { cmd: "goto", args: ["MirageTower_4F_EventScript_CollapseMirageTower"] },
      { cmd: "end" },
    ],
    "MirageTower_4F_EventScript_LeaveRootFossil": [
      { cmd: "msgbox", args: ["MirageTower_4F_Text_LeftRootFossilAlone", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MirageTower_4F_EventScript_ClawFossil": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["MirageTower_4F_Text_TakeClawFossil", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "MirageTower_4F_EventScript_LeaveClawFossil"] },
      { cmd: "giveitem", args: ["ITEM_CLAW_FOSSIL"] },
      { cmd: "closemessage" },
      { cmd: "setflag", args: ["FLAG_HIDE_MIRAGE_TOWER_CLAW_FOSSIL"] },
      { cmd: "setflag", args: ["FLAG_HIDE_MIRAGE_TOWER_ROOT_FOSSIL"] },
      { cmd: "removeobject", args: ["LOCALID_MIRAGE_CLAW_FOSSIL"] },
      { cmd: "delay", args: [30] },
      { cmd: "setflag", args: ["FLAG_CHOSE_CLAW_FOSSIL"] },
      { cmd: "goto", args: ["MirageTower_4F_EventScript_CollapseMirageTower"] },
      { cmd: "end" },
    ],
    "MirageTower_4F_EventScript_LeaveClawFossil": [
      { cmd: "msgbox", args: ["MirageTower_4F_Text_LeaveClawFossilAlone", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MirageTower_4F_EventScript_CollapseMirageTower": [
      { cmd: "setvar", args: ["VAR_0x8004", 1] },
      { cmd: "setvar", args: ["VAR_0x8005", 1] },
      { cmd: "setvar", args: ["VAR_0x8006", 32] },
      { cmd: "setvar", args: ["VAR_0x8007", 2] },
      { cmd: "special", args: ["ShakeCamera"] },
      { cmd: "waitstate" },
      { cmd: "special", args: ["DoMirageTowerCeilingCrumble"] },
      { cmd: "waitstate" },
      { cmd: "setvar", args: ["VAR_MIRAGE_TOWER_STATE", 1] },
      { cmd: "clearflag", args: ["FLAG_LANDMARK_MIRAGE_TOWER"] },
      { cmd: "warp", args: ["MAP_ROUTE111", 19, 59] },
      { cmd: "waitstate" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MirageTower_4F_Text_TakeRootFossil": "You found the ROOT FOSSIL.\\pIf this FOSSIL is taken, the ground\\naround it will likely crumble away…\\pTake the ROOT FOSSIL anyway?",
    "MirageTower_4F_Text_LeftRootFossilAlone": "{PLAYER} left the ROOT FOSSIL alone.",
    "MirageTower_4F_Text_TakeClawFossil": "You found the CLAW FOSSIL.\\pIf this FOSSIL is taken, the ground\\naround it will likely crumble away…\\pTake the CLAW FOSSIL anyway?",
    "MirageTower_4F_Text_LeaveClawFossilAlone": "{PLAYER} left the CLAW FOSSIL alone.",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onLoad: "InsideOfTruck_OnLoad",
    onResume: "InsideOfTruck_OnResume",
  },
  scripts: {
    "InsideOfTruck_OnLoad": [
      { cmd: "setmetatile", args: [4, 1, "METATILE_InsideOfTruck_ExitLight_Top", "FALSE"] },
      { cmd: "setmetatile", args: [4, 2, "METATILE_InsideOfTruck_ExitLight_Mid", "FALSE"] },
      { cmd: "setmetatile", args: [4, 3, "METATILE_InsideOfTruck_ExitLight_Bottom", "FALSE"] },
      { cmd: "end" },
    ],
    "InsideOfTruck_OnResume": [
      { cmd: "setstepcallback", args: ["STEP_CB_TRUCK"] },
      { cmd: "end" },
    ],
    "InsideOfTruck_EventScript_SetIntroFlags": [
      { cmd: "lockall" },
      { cmd: "setflag", args: ["FLAG_HIDE_MAP_NAME_POPUP"] },
      { cmd: "checkplayergender" },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "MALE", "InsideOfTruck_EventScript_SetIntroFlagsMale"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FEMALE", "InsideOfTruck_EventScript_SetIntroFlagsFemale"] },
      { cmd: "end" },
    ],
    "InsideOfTruck_EventScript_SetIntroFlagsMale": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F"] },
      { cmd: "setvar", args: ["VAR_LITTLEROOT_INTRO_STATE", 1] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_MOM"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_MOM"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_SIBLING"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F_POKE_BALL"] },
      { cmd: "setvar", args: ["VAR_LITTLEROOT_HOUSES_STATE_BRENDAN", 1] },
      { cmd: "setdynamicwarp", args: ["MAP_LITTLEROOT_TOWN", 3, 10] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "InsideOfTruck_EventScript_SetIntroFlagsFemale": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_LITTLEROOT_TOWN_MAYS_HOUSE_2F"] },
      { cmd: "setvar", args: ["VAR_LITTLEROOT_INTRO_STATE", 2] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_MOM"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_MOM"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_SIBLING"] },
      { cmd: "setflag", args: ["FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_2F_POKE_BALL"] },
      { cmd: "setvar", args: ["VAR_LITTLEROOT_HOUSES_STATE_MAY", 1] },
      { cmd: "setdynamicwarp", args: ["MAP_LITTLEROOT_TOWN", 12, 10] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "InsideOfTruck_EventScript_MovingBox": [
      { cmd: "msgbox", args: ["InsideOfTruck_Text_BoxPrintedWithMonLogo", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "InsideOfTruck_Text_BoxPrintedWithMonLogo": "The box is printed with a POKéMON logo.\\pIt's a POKéMON brand moving and\\ndelivery service.",
  },
};

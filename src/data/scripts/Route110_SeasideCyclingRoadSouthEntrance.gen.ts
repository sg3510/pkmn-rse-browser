// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "Route110_SeasideCyclingRoadSouthEntrance_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["Route110_SeasideCyclingRoadSouthEntrance_Text_GoAllOutOnCyclingRoad", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route110_SeasideCyclingRoadSouthEntrance_EventScript_BikeCheck": [
      { cmd: "lockall" },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetPlayerAvatarBike"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 0, "Route110_SeasideCyclingRoadSouthEntrance_EventScript_NoBike"] },
      { cmd: "setflag", args: ["FLAG_SYS_CYCLING_ROAD"] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route110_SeasideCyclingRoadSouthEntrance_EventScript_NoBike": [
      { cmd: "msgbox", args: ["Route110_SeasideCyclingRoadSouthEntrance_Text_TooDangerousToWalk", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "Route110_SeasideCyclingRoadSouthEntrance_Movement_PushPlayerBackFromCounter"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "Route110_SeasideCyclingRoadSouthEntrance_EventScript_ClearCyclingRoad": [
      { cmd: "lockall" },
      { cmd: "clearflag", args: ["FLAG_SYS_CYCLING_ROAD"] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
    "Route110_SeasideCyclingRoadSouthEntrance_Movement_PushPlayerBackFromCounter": ["walk_left"],
  },
  text: {
    "Route110_SeasideCyclingRoadSouthEntrance_Text_GoAllOutOnCyclingRoad": "On CYCLING ROAD, you can go all out\\nand cycle as fast as you'd like.\\pIt feels great to go that fast, but try\\nnot to crash into anyone!",
    "Route110_SeasideCyclingRoadSouthEntrance_Text_TooDangerousToWalk": "Sorry, you can't walk on CYCLING\\nROAD. It's too dangerous.\\pPlease come back with a BIKE.",
  },
};

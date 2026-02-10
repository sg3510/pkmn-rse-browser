// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "PacifidlogTown_House5_EventScript_MirageIslandWatcher": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "specialvar", args: ["VAR_RESULT", "IsMirageIslandPresent"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "PacifidlogTown_House5_EventScript_MirageIslandPresent"] },
      { cmd: "msgbox", args: ["PacifidlogTown_House5_Text_CantSeeMirageIslandToday", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PacifidlogTown_House5_EventScript_MirageIslandPresent": [
      { cmd: "msgbox", args: ["PacifidlogTown_House5_Text_CanSeeMirageIslandToday", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PacifidlogTown_House5_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["PacifidlogTown_House5_Text_MirageIslandAppearDependingOnWeather", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "PacifidlogTown_House5_Text_CantSeeMirageIslandToday": "I can't see MIRAGE ISLAND today…",
    "PacifidlogTown_House5_Text_CanSeeMirageIslandToday": "Oh! Oh my!\\nI can see MIRAGE ISLAND today!",
    "PacifidlogTown_House5_Text_MirageIslandAppearDependingOnWeather": "MIRAGE ISLAND…\\pIt must become visible and invisible\\ndepending on the weather conditions\\lthat make mirages appear.\\pOr is it really appearing and\\ndisappearing?",
  },
};

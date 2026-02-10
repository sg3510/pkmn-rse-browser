// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "EverGrandeCity_OnTransition",
  },
  scripts: {
    "EverGrandeCity_OnTransition": [
      { cmd: "call_if_set", args: ["FLAG_SYS_WEATHER_CTRL", "Common_EventScript_SetAbnormalWeather"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_EventScript_VictoryRoadSign": [
      { cmd: "msgbox", args: ["EverGrandeCity_Text_EnteringVictoryRoad", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_EventScript_CitySign": [
      { cmd: "msgbox", args: ["EverGrandeCity_Text_CitySign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_EventScript_PokemonLeagueSign": [
      { cmd: "msgbox", args: ["EverGrandeCity_Text_EnteringPokemonLeague", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "EverGrandeCity_EventScript_SetVisitedEverGrande": [
      { cmd: "setflag", args: ["FLAG_VISITED_EVER_GRANDE_CITY"] },
      { cmd: "setvar", args: ["VAR_TEMP_1", 1] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "EverGrandeCity_Text_EnteringVictoryRoad": "ENTERING VICTORY ROAD",
    "EverGrandeCity_Text_EnteringPokemonLeague": "ENTERING POKéMON LEAGUE\\nCENTER GATE",
    "EverGrandeCity_Text_CitySign": "EVER GRANDE CITY\\p“The paradise of flowers, the sea,\\nand POKéMON.”",
  },
};

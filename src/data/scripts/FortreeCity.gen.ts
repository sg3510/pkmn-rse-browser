// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "FortreeCity_OnTransition",
    onResume: "FortreeCity_OnResume",
  },
  scripts: {
    "FortreeCity_OnTransition": [
      { cmd: "setflag", args: ["FLAG_VISITED_FORTREE_CITY"] },
      { cmd: "end" },
    ],
    "FortreeCity_OnResume": [
      { cmd: "setstepcallback", args: ["STEP_CB_FORTREE_BRIDGE"] },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_Man": [
      { cmd: "msgbox", args: ["FortreeCity_Text_SawGiganticPokemonInSky", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_Woman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_KECLEON_FLED_FORTREE", "FortreeCity_EventScript_WomanGymAccessible"] },
      { cmd: "msgbox", args: ["FortreeCity_Text_SomethingBlockingGym", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_WomanGymAccessible": [
      { cmd: "msgbox", args: ["FortreeCity_Text_ThisTimeIllBeatWinona", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_Girl": [
      { cmd: "msgbox", args: ["FortreeCity_Text_TreesGrowByDrinkingRainwater", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_OldMan": [
      { cmd: "msgbox", args: ["FortreeCity_Text_EveryoneHealthyAndLively", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_Boy": [
      { cmd: "msgbox", args: ["FortreeCity_Text_BugPokemonComeThroughWindow", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_GameboyKid": [
      { cmd: "msgbox", args: ["FortreeCity_Text_PokemonThatEvolveWhenTraded", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_CitySign": [
      { cmd: "msgbox", args: ["FortreeCity_Text_CitySign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_GymSign": [
      { cmd: "msgbox", args: ["FortreeCity_Text_GymSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_Kecleon": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "checkitem", args: ["ITEM_DEVON_SCOPE"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "FortreeCity_EventScript_AskUseDevonScope"] },
      { cmd: "msgbox", args: ["FortreeCity_Text_SomethingUnseeable", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_AskUseDevonScope": [
      { cmd: "msgbox", args: ["FortreeCity_Text_UnseeableUseDevonScope", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "FortreeCity_EventScript_UseDevonScope"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_EventScript_UseDevonScope": [
      { cmd: "msgbox", args: ["FortreeCity_Text_UsedDevonScopePokemonFled", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "Movement_KecleonAppears"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_KECLEON", "CRY_MODE_ENCOUNTER"] },
      { cmd: "delay", args: [40] },
      { cmd: "waitmoncry" },
      { cmd: "applymovement", args: ["VAR_LAST_TALKED", "FortreeCity_Movement_KecleonFlee"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "removeobject", args: ["VAR_LAST_TALKED"] },
      { cmd: "setflag", args: ["FLAG_KECLEON_FLED_FORTREE"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
    "FortreeCity_Movement_KecleonFlee": ["walk_right"],
  },
  text: {
    "FortreeCity_Text_SawGiganticPokemonInSky": "No one believes me, but I saw this\\ngigantic POKéMON in the sky.\\pIt seemed to squirm as it flew toward\\nROUTE 131.\\pBy the way… Sniff…\\nUm… You, uh…smell singed.\\pWere you at a volcano or something?",
    "FortreeCity_Text_SomethingBlockingGym": "I want to go to the POKéMON GYM,\\nbut something's blocking the way.\\pAfter all the bother I went through\\ntraining on ROUTE 120…",
    "FortreeCity_Text_ThisTimeIllBeatWinona": "I've got my pride-and-joy POKéMON\\nwith me. This time, I'll beat WINONA.",
    "FortreeCity_Text_TreesGrowByDrinkingRainwater": "The ground absorbs rainwater, and\\ntrees grow by drinking that water…\\pOur FORTREE CITY exists because\\nthere's both water and soil.",
    "FortreeCity_Text_EveryoneHealthyAndLively": "The CITY consists of homes built on\\ntrees.\\pPerhaps because of that lifestyle,\\neveryone is healthy and lively.\\pWhy, even myself--I feel as if I've\\ngrown thirty years younger.",
    "FortreeCity_Text_BugPokemonComeThroughWindow": "Living on top of trees is okay.\\pBut sometimes BUG POKéMON come in\\nthrough windows.\\lIt can be really startling.",
    "FortreeCity_Text_PokemonThatEvolveWhenTraded": "There are POKéMON that evolve when\\nyou trade them! That's what I heard.",
    "FortreeCity_Text_SomethingUnseeable": "Something unseeable is in the way.",
    "FortreeCity_Text_UnseeableUseDevonScope": "Something unseeable is in the way.\\pWant to use the DEVON SCOPE?",
    "FortreeCity_Text_UsedDevonScopePokemonFled": "{PLAYER} used the DEVON SCOPE.\\pAn invisible POKéMON became completely\\nvisible!\\pThe startled POKéMON fled!",
    "FortreeCity_Text_CitySign": "FORTREE CITY\\n“The treetop city that frolics with\\lnature.”",
    "FortreeCity_Text_GymSign": "FORTREE CITY POKéMON GYM\\nLEADER: WINONA\\p“The bird user taking flight into\\nthe world.”",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "VerdanturfTown_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["VerdanturfTown_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "VerdanturfTown_Mart_Pokemart": [
      { cmd: ".2byte", args: ["ITEM_GREAT_BALL"] },
      { cmd: ".2byte", args: ["ITEM_NEST_BALL"] },
      { cmd: ".2byte", args: ["ITEM_SUPER_POTION"] },
      { cmd: ".2byte", args: ["ITEM_ANTIDOTE"] },
      { cmd: ".2byte", args: ["ITEM_PARALYZE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_AWAKENING"] },
      { cmd: ".2byte", args: ["ITEM_BURN_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_ICE_HEAL"] },
      { cmd: ".2byte", args: ["ITEM_REPEL"] },
      { cmd: ".2byte", args: ["ITEM_X_SPECIAL"] },
      { cmd: ".2byte", args: ["ITEM_FLUFFY_TAIL"] },
      { cmd: "pokemartlistend" },
    ],
    "VerdanturfTown_Mart_EventScript_Boy": [
      { cmd: "msgbox", args: ["VerdanturfTown_Mart_Text_XSpecialIsCrucial", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_Mart_EventScript_ExpertF": [
      { cmd: "msgbox", args: ["VerdanturfTown_Mart_Text_NoStrategyGuidesForBattleTent", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_Mart_EventScript_Lass": [
      { cmd: "msgbox", args: ["VerdanturfTown_Mart_Text_NestBallOnWeakenedPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "VerdanturfTown_Mart_Text_XSpecialIsCrucial": "For any POKéMON match, X SPECIAL\\nis crucial.\\pIt jacks up the power of some moves\\neven though it's only for one battle.",
    "VerdanturfTown_Mart_Text_NoStrategyGuidesForBattleTent": "They don't seem to sell any winning\\nstrategy guides for the BATTLE TENT…\\pIt seems one must rely on one's\\nown wits after all…",
    "VerdanturfTown_Mart_Text_NestBallOnWeakenedPokemon": "The NEST BALL works better on\\nweakened POKéMON.\\pVERDANTURF is the only place you can\\nbuy it.",
  },
};

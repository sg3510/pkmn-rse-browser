// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LilycoveCity_DepartmentStore_3F_EventScript_ClerkLeft": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["LilycoveCity_DepartmentStore_3F_Pokemart_Vitamins"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_3F_Pokemart_Vitamins": [
      { cmd: "pokemartlistend" },
    ],
    "LilycoveCity_DepartmentStore_3F_EventScript_ClerkRight": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["LilycoveCity_DepartmentStore_3F_Pokemart_StatBoosters"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_3F_Pokemart_StatBoosters": [
      { cmd: "pokemartlistend" },
    ],
    "LilycoveCity_DepartmentStore_3F_EventScript_TriathleteM": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_3F_Text_ItemsBestForTougheningPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_3F_EventScript_PokefanM": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_3F_Text_WantMoreEndurance", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_3F_EventScript_Woman": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_3F_Text_GaveCarbosToSpeedUpMon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_DepartmentStore_3F_Text_ItemsBestForTougheningPokemon": "For quickly toughening up POKéMON,\\nitems are the best.\\pPROTEIN boosts ATTACK,\\nand CALCIUM raises SP. ATK.",
    "LilycoveCity_DepartmentStore_3F_Text_WantMoreEndurance": "I want my POKéMON to have more\\nendurance.\\pI'm trying to decide whether to raise\\nDEFENSE with IRON, or SP. DEF with ZINC.",
    "LilycoveCity_DepartmentStore_3F_Text_GaveCarbosToSpeedUpMon": "I gave a CARBOS to my POKéMON,\\nand its SPEED went up.",
  },
};

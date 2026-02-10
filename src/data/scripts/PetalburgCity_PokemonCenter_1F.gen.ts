// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "PetalburgCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "PetalburgCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_PETALBURG_CITY"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "end" },
    ],
    "PetalburgCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_PETALBURG_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_PokemonCenter_1F_EventScript_FatMan": [
      { cmd: "msgbox", args: ["PetalburgCity_PokemonCenter_1F_Text_PCStorageSystem", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PetalburgCity_PokemonCenter_1F_EventScript_Youngster": [
      { cmd: "msgbox", args: ["PetalburgCity_PokemonCenter_1F_Text_OranBerryRegainedHP", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "PetalburgCity_PokemonCenter_1F_EventScript_Woman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["PetalburgCity_PokemonCenter_1F_Text_ManyTypesOfPokemon", "MSGBOX_DEFAULT"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "IsStarterInParty"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "PetalburgCity_PokemonCenter_1F_EventScript_SayStarterTypeInfo"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_PokemonCenter_1F_EventScript_SayStarterTypeInfo": [
      { cmd: "call_if_eq", args: ["VAR_STARTER_MON", 0, "PetalburgCity_PokemonCenter_1F_EventScript_SayTreeckoType"] },
      { cmd: "call_if_eq", args: ["VAR_STARTER_MON", 1, "PetalburgCity_PokemonCenter_1F_EventScript_SayTorchicType"] },
      { cmd: "call_if_eq", args: ["VAR_STARTER_MON", 2, "PetalburgCity_PokemonCenter_1F_EventScript_SayMudkipType"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PetalburgCity_PokemonCenter_1F_EventScript_SayTreeckoType": [
      { cmd: "msgbox", args: ["PetalburgCity_PokemonCenter_1F_Text_TreeckoIsGrassType", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "PetalburgCity_PokemonCenter_1F_EventScript_SayTorchicType": [
      { cmd: "msgbox", args: ["PetalburgCity_PokemonCenter_1F_Text_TorchicIsFireType", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "PetalburgCity_PokemonCenter_1F_EventScript_SayMudkipType": [
      { cmd: "msgbox", args: ["PetalburgCity_PokemonCenter_1F_Text_MudkipIsWaterType", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
  },
  movements: {
  },
  text: {
    "PetalburgCity_PokemonCenter_1F_Text_PCStorageSystem": "That PC-based POKéMON Storage\\nSystem…\\pWhoever made it must be some kind\\nof a scientific wizard!",
    "PetalburgCity_PokemonCenter_1F_Text_OranBerryRegainedHP": "When my POKéMON ate an\\nORAN BERRY, it regained HP!",
    "PetalburgCity_PokemonCenter_1F_Text_ManyTypesOfPokemon": "There are many types of POKéMON.\\pAll types have their strengths and\\nweaknesses against other types.\\pDepending on the types of POKéMON,\\na battle could be easy or hard.",
    "PetalburgCity_PokemonCenter_1F_Text_TreeckoIsGrassType": "For example, your TREECKO\\nis a GRASS type.\\pIt's strong against the WATER and\\nGROUND types.\\pBut, it's weak against FIRE-type\\nPOKéMON.",
    "PetalburgCity_PokemonCenter_1F_Text_TorchicIsFireType": "For example, your TORCHIC\\nis a FIRE type.\\pIt's strong against the GRASS and\\nBUG types.\\pBut, it's weak against WATER-type\\nPOKéMON.",
    "PetalburgCity_PokemonCenter_1F_Text_MudkipIsWaterType": "For example, your MUDKIP\\nis a WATER type.\\pIt's strong against the FIRE type.\\pBut, it's weak against GRASS-type\\nand ELECTRIC-type POKéMON.",
  },
};

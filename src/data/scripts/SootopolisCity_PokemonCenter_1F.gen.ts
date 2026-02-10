// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SootopolisCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "SootopolisCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_SOOTOPOLIS_CITY"] },
      { cmd: "end" },
    ],
    "SootopolisCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_SOOTOPOLIS_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_PokemonCenter_1F_EventScript_Gentleman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_ge", args: ["VAR_SKY_PILLAR_STATE", 2, "SootopolisCity_PokemonCenter_1F_EventScript_GentlemanNoLegendaries"] },
      { cmd: "goto_if_unset", args: ["FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN", "SootopolisCity_PokemonCenter_1F_EventScript_GentlemanNoLegendaries"] },
      { cmd: "msgbox", args: ["SootopolisCity_PokemonCenter_1F_Text_EveryoneTakenRefuge", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_PokemonCenter_1F_EventScript_GentlemanNoLegendaries": [
      { cmd: "msgbox", args: ["SootopolisCity_PokemonCenter_1F_Text_WallaceToughestInHoenn", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_PokemonCenter_1F_EventScript_Woman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_ge", args: ["VAR_SKY_PILLAR_STATE", 2, "SootopolisCity_PokemonCenter_1F_EventScript_WomanNoLegendaries"] },
      { cmd: "goto_if_unset", args: ["FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN", "SootopolisCity_PokemonCenter_1F_EventScript_WomanNoLegendaries"] },
      { cmd: "msgbox", args: ["SootopolisCity_PokemonCenter_1F_Text_ArentPokemonOurFriends", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_PokemonCenter_1F_EventScript_WomanNoLegendaries": [
      { cmd: "msgbox", args: ["SootopolisCity_PokemonCenter_1F_Text_AlwaysBeFriendsWithPokemon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SootopolisCity_PokemonCenter_1F_Text_WallaceToughestInHoenn": "WALLACE is rumored to be the toughest\\nTRAINER in the whole HOENN region.\\pThis town's GYM is led by the TRAINER\\nwho taught WALLACE.\\pBut the ELITE FOUR… They're said to be\\neven stronger than WALLACE's mentor.\\pHow strong could they be?",
    "SootopolisCity_PokemonCenter_1F_Text_EveryoneTakenRefuge": "Everyone in town has taken refuge\\nand won't come out of their homes.\\pEven I would rather not venture\\noutside.",
    "SootopolisCity_PokemonCenter_1F_Text_AlwaysBeFriendsWithPokemon": "Whenever, wherever, and whatever\\nhappens, I will always be friends with\\lPOKéMON.\\pBecause it's fun to be with POKéMON!",
    "SootopolisCity_PokemonCenter_1F_Text_ArentPokemonOurFriends": "Aren't POKéMON our friends?\\pWhy are they going wild this way?",
  },
};

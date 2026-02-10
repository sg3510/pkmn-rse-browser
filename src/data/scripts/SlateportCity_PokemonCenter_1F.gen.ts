// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "SlateportCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "SlateportCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_SLATEPORT_CITY"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "end" },
    ],
    "SlateportCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_SLATEPORT_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SlateportCity_PokemonCenter_1F_EventScript_Sailor": [
      { cmd: "msgbox", args: ["SlateportCity_PokemonCenter_1F_Text_RaiseDifferentTypesOfPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "SlateportCity_PokemonCenter_1F_EventScript_Woman": [
      { cmd: "msgbox", args: ["SlateportCity_PokemonCenter_1F_Text_TradedMonWithFriend", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SlateportCity_PokemonCenter_1F_Text_RaiseDifferentTypesOfPokemon": "Want a tip for battling?\\pI'd say it's raising different kinds\\nof POKéMON in a balanced manner.\\pIt's no good to make just one\\nPOKéMON strong.\\pIf it has a type disadvantage,\\nit might not stand a chance.",
    "SlateportCity_PokemonCenter_1F_Text_TradedMonWithFriend": "I trade POKéMON with my friends.\\pIf a traded POKéMON is holding an\\nitem, it makes me twice as happy!",
  },
};

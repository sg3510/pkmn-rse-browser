// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "OldaleTown_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "OldaleTown_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_OLDALE_TOWN"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "end" },
    ],
    "OldaleTown_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_OLDALE_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "OldaleTown_PokemonCenter_1F_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["OldaleTown_PokemonCenter_1F_Text_TrainersCanUsePC", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "OldaleTown_PokemonCenter_1F_EventScript_Boy": [
      { cmd: "msgbox", args: ["OldaleTown_PokemonCenter_1F_Text_PokemonCentersAreGreat", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "OldaleTown_PokemonCenter_1F_EventScript_Girl": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_SYS_POKEDEX_GET", "OldaleTown_PokemonCenter_1F_EventScript_WirelessClubAvailable"] },
      { cmd: "msgbox", args: ["OldaleTown_PokemonCenter_1F_Text_WirelessClubNotAvailable", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "OldaleTown_PokemonCenter_1F_EventScript_WirelessClubAvailable": [
      { cmd: "msgbox", args: ["OldaleTown_PokemonCenter_1F_Text_TradedInWirelessClub", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "OldaleTown_PokemonCenter_1F_Text_TrainersCanUsePC": "That PC in the corner there is\\nfor any POKéMON TRAINER to use.\\pNaturally, that means you're welcome\\nto use it, too.",
    "OldaleTown_PokemonCenter_1F_Text_PokemonCentersAreGreat": "POKéMON CENTERS are great!\\pYou can use their services as much\\nas you like, and it's all for free.\\lYou never have to worry!",
    "OldaleTown_PokemonCenter_1F_Text_WirelessClubNotAvailable": "The POKéMON WIRELESS CLUB on\\nthe second floor was built recently.\\pBut they say they're still making\\nadjustments.",
    "OldaleTown_PokemonCenter_1F_Text_TradedInWirelessClub": "The POKéMON WIRELESS CLUB on\\nthe second floor was built recently.\\pI traded POKéMON right away.",
  },
};

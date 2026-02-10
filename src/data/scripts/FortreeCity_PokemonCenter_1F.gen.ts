// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "FortreeCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "FortreeCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_FORTREE_CITY"] },
      { cmd: "end" },
    ],
    "FortreeCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_FORTREE_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_PokemonCenter_1F_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["FortreeCity_PokemonCenter_1F_Text_GoToSafariZone", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_PokemonCenter_1F_EventScript_Man": [
      { cmd: "msgbox", args: ["FortreeCity_PokemonCenter_1F_Text_RecordCornerIsNeat", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_PokemonCenter_1F_EventScript_Boy": [
      { cmd: "msgbox", args: ["FortreeCity_PokemonCenter_1F_Text_DoYouKnowAboutPokenav", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FortreeCity_PokemonCenter_1F_Text_GoToSafariZone": "Listen, kid, are you working\\non a POKéDEX?\\pHmm… Go to the SAFARI ZONE.\\nThat's my suggestion.",
    "FortreeCity_PokemonCenter_1F_Text_RecordCornerIsNeat": "Have you done anything at\\nthe RECORD CORNER?\\pIt's pretty neat. It mixes and matches\\nthe records of TRAINERS.\\pI don't know quite how it works,\\nbut it's cool. It's exciting, even!",
    "FortreeCity_PokemonCenter_1F_Text_DoYouKnowAboutPokenav": "Oh, wow, you have a POKéNAV!\\nAnd it's just like mine!\\pDo you know about POKéNAV's\\nMATCH CALL system?\\pAccess it, and you can chat with\\nregistered TRAINERS anytime.\\pIt also shows you which TRAINERS\\nwant a rematch with you.\\pIt's really nifty! Those DEVON guys\\nsure know what they're doing!",
  },
};

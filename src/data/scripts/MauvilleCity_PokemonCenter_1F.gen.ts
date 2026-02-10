// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "MauvilleCity_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "MauvilleCity_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_MAUVILLE_CITY"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "goto", args: ["MauvilleCity_PokemonCenter_1F_EventScript_SetMauvilleOldManGfx"] },
      { cmd: "end" },
    ],
    "MauvilleCity_PokemonCenter_1F_EventScript_SetMauvilleOldManGfx": [
      { cmd: "special", args: ["SetMauvilleOldManObjEventGfx"] },
      { cmd: "end" },
    ],
    "MauvilleCity_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_MAUVILLE_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MauvilleCity_PokemonCenter_1F_EventScript_Woman1": [
      { cmd: "msgbox", args: ["MauvilleCity_PokemonCenter_1F_Text_ManOverThereSaysWeirdThings", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MauvilleCity_PokemonCenter_1F_EventScript_Woman2": [
      { cmd: "msgbox", args: ["MauvilleCity_PokemonCenter_1F_Text_MyDataUpdatedFromRecordCorner", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "MauvilleCity_PokemonCenter_1F_EventScript_Youngster": [
      { cmd: "msgbox", args: ["MauvilleCity_PokemonCenter_1F_Text_RecordCornerSoundsFun", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MauvilleCity_PokemonCenter_1F_Text_ManOverThereSaysWeirdThings": "That man over there, he says weird\\nthings!\\pHe's funny in a weird way.\\nI doubt I'll forget about him!",
    "MauvilleCity_PokemonCenter_1F_Text_MyDataUpdatedFromRecordCorner": "When I accessed the RECORD CORNER,\\nthe data for what's hot in DEWFORD\\lgot updated.\\pNow that bit of data is the same\\nas my friend's!",
    "MauvilleCity_PokemonCenter_1F_Text_RecordCornerSoundsFun": "A RECORD CORNER opened upstairs in\\nthe POKéMON CENTER.\\pI don't know what it's about, but it\\nsounds fun. I'll go check it out!",
  },
};

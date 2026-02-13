// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onWarpInto: [
      { var: "VAR_SOOTOPOLIS_CITY_STATE", value: 1, script: "LilycoveCity_DepartmentStore_5F_EventScript_BlockRoofStairs" },
      { var: "VAR_SOOTOPOLIS_CITY_STATE", value: 2, script: "LilycoveCity_DepartmentStore_5F_EventScript_BlockRoofStairs" },
      { var: "VAR_SOOTOPOLIS_CITY_STATE", value: 3, script: "LilycoveCity_DepartmentStore_5F_EventScript_BlockRoofStairs" },
    ],
  },
  scripts: {
    "LilycoveCity_DepartmentStore_5F_EventScript_BlockRoofStairs": [
      { cmd: "setobjectxy", args: ["LOCALID_DEPARTMENT_STORE_STAIRS_WOMAN", 16, 2] },
      { cmd: "turnobject", args: ["LOCALID_DEPARTMENT_STORE_STAIRS_WOMAN", "DIR_NORTH"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_ClerkFarLeft": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemartdecoration2", args: ["LilycoveCity_DepartmentStore_5F_Pokemart_Dolls"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_Pokemart_Dolls": [
      { cmd: "pokemartlistend" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_ClerkMidLeft": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemartdecoration2", args: ["LilycoveCity_DepartmentStore_5F_Pokemart_Cushions"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_Pokemart_Cushions": [
      { cmd: "pokemartlistend" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_ClerkMidRight": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemartdecoration2", args: ["LilycoveCity_DepartmentStore_5F_Pokemart_Posters"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_Pokemart_Posters": [
      { cmd: "pokemartlistend" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_ClerkFarRight": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemartdecoration2", args: ["LilycoveCity_DepartmentStore_5F_Pokemart_Mats"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_Pokemart_Mats": [
      { cmd: "pokemartlistend" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_PokefanF": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_5F_Text_PlaceFullOfCuteDolls", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_Woman": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_DEPARTMENT_STORE_STAIRS_WOMAN", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "goto_if_eq", args: ["VAR_SOOTOPOLIS_CITY_STATE", 0, "LilycoveCity_DepartmentStore_5F_EventScript_WomanNormal"] },
      { cmd: "goto_if_ge", args: ["VAR_SOOTOPOLIS_CITY_STATE", 4, "LilycoveCity_DepartmentStore_5F_EventScript_WomanNormal"] },
      { cmd: "goto", args: ["LilycoveCity_DepartmentStore_5F_EventScript_WomanLegendaryWeather"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_WomanNormal": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_5F_Text_SellManyCuteMatsHere", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_WomanLegendaryWeather": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_5F_Text_ClosedRooftopForWeather", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_DEPARTMENT_STORE_STAIRS_WOMAN", "Common_Movement_WalkInPlaceFasterUp"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_5F_EventScript_LittleGirl": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_5F_Text_GettingDollInsteadOfPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_DepartmentStore_5F_Text_PlaceFullOfCuteDolls": "This place is full of cute DOLLS.\\pI should buy some for me, instead of\\njust for my children.",
    "LilycoveCity_DepartmentStore_5F_Text_GettingDollInsteadOfPokemon": "I'm not big enough to raise POKéMON,\\nso I'm getting a cute DOLL instead.",
    "LilycoveCity_DepartmentStore_5F_Text_SellManyCuteMatsHere": "They sell many cute MATS here.\\pI wonder which one I should get?\\nMaybe I'll buy them all…",
    "LilycoveCity_DepartmentStore_5F_Text_ClosedRooftopForWeather": "I think they closed the rooftop\\nbecause the weather is wild today.",
  },
};

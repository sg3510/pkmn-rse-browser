// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FortreeCity_DecorationShop_EventScript_PokefanM": [
      { cmd: "msgbox", args: ["FortreeCity_DecorationShop_Text_MerchandiseSentToPC", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_DecorationShop_EventScript_Girl": [
      { cmd: "msgbox", args: ["FortreeCity_DecorationShop_Text_BuyingDeskForDolls", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_DecorationShop_EventScript_ClerkDesks": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemartdecoration", args: ["FortreeCity_DecorationShop_PokemartDecor_Desks"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "FortreeCity_DecorationShop_PokemartDecor_Desks": [
      { cmd: ".2byte", args: ["DECOR_SMALL_DESK"] },
      { cmd: ".2byte", args: ["DECOR_POKEMON_DESK"] },
      { cmd: ".2byte", args: ["DECOR_HEAVY_DESK"] },
      { cmd: ".2byte", args: ["DECOR_RAGGED_DESK"] },
      { cmd: ".2byte", args: ["DECOR_COMFORT_DESK"] },
      { cmd: ".2byte", args: ["DECOR_BRICK_DESK"] },
      { cmd: ".2byte", args: ["DECOR_CAMP_DESK"] },
      { cmd: ".2byte", args: ["DECOR_HARD_DESK"] },
      { cmd: "pokemartlistend" },
    ],
    "FortreeCity_DecorationShop_EventScript_ClerkChairs": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemartdecoration", args: ["FortreeCity_DecorationShop_PokemartDecor_Chairs"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
      { cmd: ".align", args: [2] },
    ],
    "FortreeCity_DecorationShop_PokemartDecor_Chairs": [
      { cmd: ".2byte", args: ["DECOR_SMALL_CHAIR"] },
      { cmd: ".2byte", args: ["DECOR_POKEMON_CHAIR"] },
      { cmd: ".2byte", args: ["DECOR_HEAVY_CHAIR"] },
      { cmd: ".2byte", args: ["DECOR_RAGGED_CHAIR"] },
      { cmd: ".2byte", args: ["DECOR_COMFORT_CHAIR"] },
      { cmd: ".2byte", args: ["DECOR_BRICK_CHAIR"] },
      { cmd: ".2byte", args: ["DECOR_CAMP_CHAIR"] },
      { cmd: ".2byte", args: ["DECOR_HARD_CHAIR"] },
      { cmd: "pokemartlistend" },
    ],
  },
  movements: {
  },
  text: {
    "FortreeCity_DecorationShop_Text_MerchandiseSentToPC": "Merchandise you buy here is sent to\\nyour own PC.\\pThat's fantastic! I wish they could\\nalso deliver me home like that.",
    "FortreeCity_DecorationShop_Text_BuyingDeskForDolls": "I'm buying a pretty desk and I'm\\nputting my cute DOLLS on it.\\pIf I don't, when I decorate my\\nSECRET BASE, my DOLLS will get\\ldirty or poked with splinters.",
  },
};

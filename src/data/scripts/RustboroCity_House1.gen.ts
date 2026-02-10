// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "RustboroCity_House1_EventScript_Trader": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RUSTBORO_NPC_TRADE_COMPLETED", "RustboroCity_House1_EventScript_TradeCompleted"] },
      { cmd: "setvar", args: ["VAR_0x8008", "INGAME_TRADE_SEEDOT"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_0x8008"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetInGameTradeSpeciesInfo"] },
      { cmd: "copyvar", args: ["VAR_0x8009", "VAR_RESULT"] },
      { cmd: "msgbox", args: ["RustboroCity_House1_Text_IllTradeIfYouWant", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "RustboroCity_House1_EventScript_DeclineTrade"] },
      { cmd: "special", args: ["ChoosePartyMon"] },
      { cmd: "waitstate" },
      { cmd: "copyvar", args: ["VAR_0x800A", "VAR_0x8004"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "RustboroCity_House1_EventScript_DeclineTrade"] },
      { cmd: "copyvar", args: ["VAR_0x8005", "VAR_0x800A"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetTradeSpecies"] },
      { cmd: "copyvar", args: ["VAR_0x800B", "VAR_RESULT"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "VAR_0x8009", "RustboroCity_House1_EventScript_NotRequestedMon"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_0x8008"] },
      { cmd: "copyvar", args: ["VAR_0x8005", "VAR_0x800A"] },
      { cmd: "special", args: ["CreateInGameTradePokemon"] },
      { cmd: "special", args: ["DoInGameTradeScene"] },
      { cmd: "waitstate" },
      { cmd: "msgbox", args: ["RustboroCity_House1_Text_PleaseBeGoodToMyPokemon", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_RUSTBORO_NPC_TRADE_COMPLETED"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_House1_EventScript_DeclineTrade": [
      { cmd: "msgbox", args: ["RustboroCity_House1_Text_YouDontWantToThatsOkay", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_House1_EventScript_NotRequestedMon": [
      { cmd: "bufferspeciesname", args: ["STR_VAR_1", "VAR_0x8009"] },
      { cmd: "msgbox", args: ["RustboroCity_House1_Text_DoesntLookLikeMonToMe", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_House1_EventScript_TradeCompleted": [
      { cmd: "msgbox", args: ["RustboroCity_House1_Text_AnyPokemonCanBeCute", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_House1_EventScript_Hiker": [
      { cmd: "msgbox", args: ["RustboroCity_House1_Text_AllSortsOfPlaces", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_House1_Text_IllTradeIfYouWant": "Huh? My POKéMON is cute?\\nSure, I knew that.\\pBut if you really want, I'm willing\\nto trade it to you.\\pI'll trade you my {STR_VAR_2} for\\na {STR_VAR_1} if you want.",
    "RustboroCity_House1_Text_PleaseBeGoodToMyPokemon": "Eheheh…\\nPlease be good to my POKéMON.",
    "RustboroCity_House1_Text_DoesntLookLikeMonToMe": "Huh? That doesn't look anything like\\na {STR_VAR_1} to me.",
    "RustboroCity_House1_Text_YouDontWantToThatsOkay": "Oh, if you don't want to, that's okay.\\nBut my POKéMON is cute, you know…",
    "RustboroCity_House1_Text_AnyPokemonCanBeCute": "Any POKéMON can be cute if you raise\\nit with care and kindness.",
    "RustboroCity_House1_Text_AllSortsOfPlaces": "In all sorts of places, there are all\\nsorts of POKéMON and people.\\pI find that fascinating, so I go to all\\nsorts of places.",
  },
};

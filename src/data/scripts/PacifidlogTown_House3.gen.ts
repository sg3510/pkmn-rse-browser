// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "PacifidlogTown_House3_EventScript_Trader": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_PACIFIDLOG_NPC_TRADE_COMPLETED", "PacifidlogTown_House3_EventScript_TradeCompleted"] },
      { cmd: "setvar", args: ["VAR_0x8008", "INGAME_TRADE_HORSEA"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_0x8008"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetInGameTradeSpeciesInfo"] },
      { cmd: "copyvar", args: ["VAR_0x8009", "VAR_RESULT"] },
      { cmd: "msgbox", args: ["PacifidlogTown_House3_Text_WillingToTradeIt", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "PacifidlogTown_House3_EventScript_DeclineTrade"] },
      { cmd: "special", args: ["ChoosePartyMon"] },
      { cmd: "waitstate" },
      { cmd: "copyvar", args: ["VAR_0x800A", "VAR_0x8004"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "PacifidlogTown_House3_EventScript_DeclineTrade"] },
      { cmd: "copyvar", args: ["VAR_0x8005", "VAR_0x800A"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetTradeSpecies"] },
      { cmd: "copyvar", args: ["VAR_0x800B", "VAR_RESULT"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "VAR_0x8009", "PacifidlogTown_House3_EventScript_NotRequestedMon"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_0x8008"] },
      { cmd: "copyvar", args: ["VAR_0x8005", "VAR_0x800A"] },
      { cmd: "special", args: ["CreateInGameTradePokemon"] },
      { cmd: "special", args: ["DoInGameTradeScene"] },
      { cmd: "waitstate" },
      { cmd: "bufferspeciesname", args: ["STR_VAR_1", "VAR_0x8009"] },
      { cmd: "msgbox", args: ["PacifidlogTown_House3_Text_ItsSubtlyDifferentThankYou", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_PACIFIDLOG_NPC_TRADE_COMPLETED"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PacifidlogTown_House3_EventScript_DeclineTrade": [
      { cmd: "msgbox", args: ["PacifidlogTown_House3_Text_NotDesperateOrAnything", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PacifidlogTown_House3_EventScript_NotRequestedMon": [
      { cmd: "bufferspeciesname", args: ["STR_VAR_1", "VAR_0x8009"] },
      { cmd: "msgbox", args: ["PacifidlogTown_House3_Text_WontAcceptAnyLessThanRealMon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PacifidlogTown_House3_EventScript_TradeCompleted": [
      { cmd: "msgbox", args: ["PacifidlogTown_House3_Text_ReallyWantedToGetBagon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "PacifidlogTown_House3_EventScript_Girl": [
      { cmd: "msgbox", args: ["PacifidlogTown_House3_Text_IsThatAPokedex", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "PacifidlogTown_House3_Text_WillingToTradeIt": "Check out this {STR_VAR_2}!\\pIt's the {STR_VAR_2} that I caught\\nyesterday to celebrate my birthday!\\pOh, I can see that you want it!\\nAfter all, it's priceless!\\pI'll tell you what. I might be willing\\nto trade it for a {STR_VAR_1}.",
    "PacifidlogTown_House3_Text_ItsSubtlyDifferentThankYou": "Oh, so this is a {STR_VAR_1}?\\pIt's sort of like a {STR_VAR_2},\\nand yet it's subtly different.\\pThank you!",
    "PacifidlogTown_House3_Text_WontAcceptAnyLessThanRealMon": "No, no, no! I won't accept any\\nless than a real {STR_VAR_1}!",
    "PacifidlogTown_House3_Text_NotDesperateOrAnything": "Oh, so you're not going to go through\\nwith this?\\pThat's cool. I'm not desperate to make\\na trade or anything.",
    "PacifidlogTown_House3_Text_ReallyWantedToGetBagon": "I know I could go looking for one\\non my own, but…\\pBut I really wanted to get a BAGON\\nthat another TRAINER caught…",
    "PacifidlogTown_House3_Text_IsThatAPokedex": "Is that a POKéDEX?\\pDid you get to meet a lot of different\\nPOKéMON?\\pI wish I was like you.",
  },
};

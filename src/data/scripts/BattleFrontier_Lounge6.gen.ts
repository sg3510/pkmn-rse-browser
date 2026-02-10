// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "BattleFrontier_Lounge6_EventScript_Trader": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_BATTLE_FRONTIER_TRADE_DONE", "BattleFrontier_Lounge6_EventScript_TradeCompleted"] },
      { cmd: "setvar", args: ["VAR_0x8008", "INGAME_TRADE_MEOWTH"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_0x8008"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetInGameTradeSpeciesInfo"] },
      { cmd: "copyvar", args: ["VAR_0x8009", "VAR_RESULT"] },
      { cmd: "msgbox", args: ["BattleFrontier_Lounge6_Text_WouldYouLikeToTrade", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "BattleFrontier_Lounge6_EventScript_DeclineTrade"] },
      { cmd: "special", args: ["ChoosePartyMon"] },
      { cmd: "waitstate" },
      { cmd: "copyvar", args: ["VAR_0x800A", "VAR_0x8004"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "BattleFrontier_Lounge6_EventScript_DeclineTrade"] },
      { cmd: "copyvar", args: ["VAR_0x8005", "VAR_0x800A"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetTradeSpecies"] },
      { cmd: "copyvar", args: ["VAR_0x800B", "VAR_RESULT"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "VAR_0x8009", "BattleFrontier_Lounge6_EventScript_NotRequestedMon"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_0x8008"] },
      { cmd: "copyvar", args: ["VAR_0x8005", "VAR_0x800A"] },
      { cmd: "special", args: ["CreateInGameTradePokemon"] },
      { cmd: "special", args: ["DoInGameTradeScene"] },
      { cmd: "waitstate" },
      { cmd: "msgbox", args: ["BattleFrontier_Lounge6_Text_PromiseIllBeGoodToIt", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_BATTLE_FRONTIER_TRADE_DONE"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge6_EventScript_DeclineTrade": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge6_Text_WellThatsFineToo", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge6_EventScript_NotRequestedMon": [
      { cmd: "bufferspeciesname", args: ["STR_VAR_1", "VAR_0x8009"] },
      { cmd: "msgbox", args: ["BattleFrontier_Lounge6_Text_DontTradeForAnythingButMon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge6_EventScript_TradeCompleted": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge6_Text_SkittySoMuchCuterThanImagined", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "BattleFrontier_Lounge6_Text_WouldYouLikeToTrade": "My POKéMON is a {STR_VAR_2}.\\nDo you know it?\\lIt's quite cute and rather nice.\\pThis little one, I could trade with\\npride!\\pWould you like to trade me a {STR_VAR_1}\\nfor my {STR_VAR_2}?",
    "BattleFrontier_Lounge6_Text_PromiseIllBeGoodToIt": "Oh, it's adorable!\\nThank you!\\lI promise I'll be good to it!\\pOh! I hope you'll be good to\\nmy {STR_VAR_2}, too!",
    "BattleFrontier_Lounge6_Text_DontTradeForAnythingButMon": "Oh, I'm sorry!\\nI don't intend to trade for anything\\lbut a {STR_VAR_1}.",
    "BattleFrontier_Lounge6_Text_WellThatsFineToo": "Oh, you won't?\\nWell, that's fine, too.\\lPlease come visit us again.",
    "BattleFrontier_Lounge6_Text_SkittySoMuchCuterThanImagined": "Giggle!\\nA SKITTY is so much cuter than I had\\limagined. I'm delighted!",
  },
};

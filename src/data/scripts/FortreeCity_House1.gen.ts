// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FortreeCity_House1_EventScript_Trader": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_FORTREE_NPC_TRADE_COMPLETED", "FortreeCity_House1_EventScript_TradeCompleted"] },
      { cmd: "setvar", args: ["VAR_0x8008", "INGAME_TRADE_PLUSLE"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_0x8008"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetInGameTradeSpeciesInfo"] },
      { cmd: "copyvar", args: ["VAR_0x8009", "VAR_RESULT"] },
      { cmd: "msgbox", args: ["FortreeCity_House1_Text_YouWillTradeWontYou", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "FortreeCity_House1_EventScript_DeclineTrade"] },
      { cmd: "special", args: ["ChoosePartyMon"] },
      { cmd: "waitstate" },
      { cmd: "copyvar", args: ["VAR_0x800A", "VAR_0x8004"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "FortreeCity_House1_EventScript_DeclineTrade"] },
      { cmd: "copyvar", args: ["VAR_0x8005", "VAR_0x800A"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetTradeSpecies"] },
      { cmd: "copyvar", args: ["VAR_0x800B", "VAR_RESULT"] },
      { cmd: "goto_if_ne", args: ["VAR_RESULT", "VAR_0x8009", "FortreeCity_House1_EventScript_NotRequestedMon"] },
      { cmd: "copyvar", args: ["VAR_0x8004", "VAR_0x8008"] },
      { cmd: "copyvar", args: ["VAR_0x8005", "VAR_0x800A"] },
      { cmd: "special", args: ["CreateInGameTradePokemon"] },
      { cmd: "special", args: ["DoInGameTradeScene"] },
      { cmd: "waitstate" },
      { cmd: "bufferspeciesname", args: ["STR_VAR_1", "VAR_0x8009"] },
      { cmd: "msgbox", args: ["FortreeCity_House1_Text_MonYouTakeCare", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_FORTREE_NPC_TRADE_COMPLETED"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_House1_EventScript_DeclineTrade": [
      { cmd: "msgbox", args: ["FortreeCity_House1_Text_YouWontTradeMe", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_House1_EventScript_NotRequestedMon": [
      { cmd: "bufferspeciesname", args: ["STR_VAR_1", "VAR_0x8009"] },
      { cmd: "msgbox", args: ["FortreeCity_House1_Text_ThisIsntAMon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_House1_EventScript_TradeCompleted": [
      { cmd: "msgbox", args: ["FortreeCity_House1_Text_GoingToMakeVolbeatStrong", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FortreeCity_House1_EventScript_ExpertF": [
      { cmd: "msgbox", args: ["FortreeCity_House1_Text_TradingMemoriesWithOthers", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FortreeCity_House1_EventScript_Zigzagoon": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_ZIGZAGOON", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["FortreeCity_House1_Text_Zigzagoon", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FortreeCity_House1_Text_YouWillTradeWontYou": "Wrooooaaar! I need it!\\nI have to get me a {STR_VAR_1}!\\lI'll do anything for it!\\p…Uh… Did you hear that?\\nMy shout from the bottom of my heart?\\pHaving heard that, you will trade\\nyour {STR_VAR_1} for my {STR_VAR_2},\\lwon't you?",
    "FortreeCity_House1_Text_MonYouTakeCare": "Oh, yeah, right on!\\p{STR_VAR_1}, welcome!\\n{STR_VAR_2}, you take care!",
    "FortreeCity_House1_Text_ThisIsntAMon": "Uh, no, I don't think so.\\nThat isn't a {STR_VAR_1}.",
    "FortreeCity_House1_Text_YouWontTradeMe": "No? You won't trade me?\\nEven after I bared my heart to you?",
    "FortreeCity_House1_Text_GoingToMakeVolbeatStrong": "I'm going to make VOLBEAT super\\nstrong from this moment on!\\pI hope you do the same with PLUSLE!",
    "FortreeCity_House1_Text_TradingMemoriesWithOthers": "Trading POKéMON with others…\\pIt's as if you're trading your own\\nmemories with other people.",
    "FortreeCity_House1_Text_Zigzagoon": "ZIGZAGOON: Gumomoh?",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SlateportCity_NameRatersHouse_EventScript_NameRater": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_PleasedToRateMonNickname", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "SlateportCity_NameRatersHouse_EventScript_ChooseMonToRate"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "SlateportCity_NameRatersHouse_EventScript_DeclineNameRate"] },
      { cmd: "end" },
    ],
    "SlateportCity_NameRatersHouse_EventScript_ChooseMonToRate": [
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_CritiqueWhichMonNickname", "MSGBOX_DEFAULT"] },
      { cmd: "special", args: ["ChoosePartyMon"] },
      { cmd: "waitstate" },
      { cmd: "goto_if_ne", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "SlateportCity_NameRatersHouse_EventScript_RateMonNickname"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "SlateportCity_NameRatersHouse_EventScript_DeclineNameRate"] },
      { cmd: "end" },
    ],
    "SlateportCity_NameRatersHouse_EventScript_DeclineNameRate": [
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_DoVisitAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SlateportCity_NameRatersHouse_EventScript_RateMonNickname": [
      { cmd: "specialvar", args: ["VAR_RESULT", "ScriptGetPartyMonSpecies"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "SPECIES_EGG", "SlateportCity_NameRatersHouse_EventScript_CantRateEgg"] },
      { cmd: "special", args: ["BufferMonNickname"] },
      { cmd: "special", args: ["IsMonOTIDNotPlayers"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "SlateportCity_NameRatersHouse_EventScript_PlayerNotMonsOT"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "MonOTNameNotPlayer"] },
      { cmd: "special", args: ["BufferMonNickname"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "SlateportCity_NameRatersHouse_EventScript_PlayerNotMonsOT"] },
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_FineNameSuggestBetterOne", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "SlateportCity_NameRatersHouse_EventScript_ChangeNickname"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "SlateportCity_NameRatersHouse_EventScript_DeclineNameRate"] },
      { cmd: "end" },
    ],
    "SlateportCity_NameRatersHouse_EventScript_CantRateEgg": [
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_ThatIsMerelyAnEgg", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SlateportCity_NameRatersHouse_EventScript_PlayerNotMonsOT": [
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_MagnificentName", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SlateportCity_NameRatersHouse_EventScript_ChangeNickname": [
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_WhatShallNewNameBe", "MSGBOX_DEFAULT"] },
      { cmd: "call", args: ["Common_EventScript_NameReceivedPartyMon"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "TryPutNameRaterShowOnTheAir"] },
      { cmd: "special", args: ["BufferMonNickname"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "SlateportCity_NameRatersHouse_EventScript_NewNameDifferent"] },
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_NameNoDifferentYetSuperior", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SlateportCity_NameRatersHouse_EventScript_NewNameDifferent": [
      { cmd: "msgbox", args: ["SlateportCity_NameRatersHouse_Text_MonShallBeKnownAsName", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SlateportCity_NameRatersHouse_Text_PleasedToRateMonNickname": "Hi, hi! I'm the NAME RATER!\\nI'm the fortune-teller of names!\\pI shall be pleased to rate your\\nPOKéMON's nickname.",
    "SlateportCity_NameRatersHouse_Text_CritiqueWhichMonNickname": "Which POKéMON's nickname should\\nI critique?",
    "SlateportCity_NameRatersHouse_Text_FineNameSuggestBetterOne": "Hmmm… {STR_VAR_1}, is it? That is\\nquite a fine name you bestowed.\\pBut! What say you, if I were to\\nsuggest a slightly better name?",
    "SlateportCity_NameRatersHouse_Text_WhatShallNewNameBe": "Ah, good. Then, what shall the new\\nnickname be?",
    "SlateportCity_NameRatersHouse_Text_MonShallBeKnownAsName": "Done! From now on, this POKéMON\\nshall be known as {STR_VAR_1}!\\pIt is a better name than before!\\nHow fortunate for you!",
    "SlateportCity_NameRatersHouse_Text_DoVisitAgain": "I see.\\nDo come visit again.",
    "SlateportCity_NameRatersHouse_Text_NameNoDifferentYetSuperior": "Done! From now on, this POKéMON\\nshall be known as {STR_VAR_1}!\\pIt looks no different from before,\\nand yet, this is vastly superior!\\pHow fortunate for you!",
    "SlateportCity_NameRatersHouse_Text_MagnificentName": "Hmmm… {STR_VAR_1} it is!\\pThis is a magnificent nickname!\\nIt is impeccably beyond reproach!\\pYou'll do well to cherish your\\n{STR_VAR_1} now and beyond.",
    "SlateportCity_NameRatersHouse_Text_ThatIsMerelyAnEgg": "Now, now.\\nThat is merely an EGG!",
  },
};

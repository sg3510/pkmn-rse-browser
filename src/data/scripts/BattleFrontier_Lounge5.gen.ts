// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "BattleFrontier_Lounge5_EventScript_NatureGirl": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["BattleFrontier_Lounge5_Text_NatureGirlGreeting", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "BattleFrontier_Lounge5_EventScript_NatureGirlNoneShown"] },
      { cmd: "special", args: ["ChoosePartyMon"] },
      { cmd: "waitstate" },
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", "PARTY_NOTHING_CHOSEN", "BattleFrontier_Lounge5_EventScript_NatureGirlNoneShown"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "ScriptGetPartyMonSpecies"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "SPECIES_EGG", "BattleFrontier_Lounge5_EventScript_NatureGirlEgg"] },
      { cmd: "special", args: ["ShowNatureGirlMessage"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge5_EventScript_NatureGirlEgg": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge5_Text_NatureGirlEgg", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge5_EventScript_NatureGirlNoneShown": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge5_Text_NatureGirlNoneShown", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge5_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge5_Text_LadyClaimsSheUnderstandsPokemon", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge5_EventScript_BlackBelt": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge5_Text_GirlSayingSomethingProfound", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "BattleFrontier_Lounge5_EventScript_LittleBoy": [
      { cmd: "msgbox", args: ["BattleFrontier_Lounge5_Text_GirlPlaysAtRedHouseALot", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "BattleFrontier_Lounge5_Text_NatureGirlGreeting": "Ehehe!\\nI can tell what POKéMON are thinking!\\pPlease!\\nCan I see your POKéMON?",
    "BattleFrontier_Lounge5_Text_NatureGirlNoneShown": "Boo!\\nCheapie!",
    "BattleFrontier_Lounge5_Text_NatureGirlHardy": "Hmhm…\\pThis one says it likes to battle!\\nIt will battle even if it has a lot\\lof ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlLonely": "Hmhm…\\pThis one says it likes to be sneaky!\\nBut if it gets enough ouchies,\\lit will hit back!",
    "BattleFrontier_Lounge5_Text_NatureGirlBrave": "Hmhm…\\pThis one says it likes to battle!\\nBut if it gets enough ouchies,\\lit will worry about itself!",
    "BattleFrontier_Lounge5_Text_NatureGirlAdamant": "Hmhm…\\pThis one says it likes to battle!\\nIt will battle even if it has a lot\\lof ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlNaughty": "Hmhm…\\pThis one says it looks after itself!\\nBut if it gets enough ouchies,\\lit will hit back!",
    "BattleFrontier_Lounge5_Text_NatureGirlBold": "Hmhm…\\pThis one says it likes to be sneaky!\\nBut if it gets enough ouchies,\\lit will worry about itself!",
    "BattleFrontier_Lounge5_Text_NatureGirlDocileNaiveQuietQuirky": "Hmhm…\\pThis one says it likes to battle!\\nIt will battle even if it has a lot\\lof ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlRelaxed": "Hmhm…\\pThis one says it likes to be sneaky!\\nBut if it gets enough ouchies,\\lit will hit back!",
    "BattleFrontier_Lounge5_Text_NatureGirlImpish": "Hmhm…\\pThis one says it likes to battle!\\nBut if it gets enough ouchies,\\lit will worry about itself!",
    "BattleFrontier_Lounge5_Text_NatureGirlLax": "Hmhm…\\pThis one says it likes to be sneaky!\\nIt says it likes to be sneaky even\\lif it has a lot of ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlTimid": "Hmhm…\\pThis one says it likes to battle!\\nBut if it gets enough ouchies,\\lit will turn sneaky!",
    "BattleFrontier_Lounge5_Text_NatureGirlHasty": "Hmhm…\\pThis one says it likes to battle!\\nIt will battle even if it has a lot\\lof ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlSerious": "Hmhm…\\pThis one says it likes to be sneaky!\\nIt says it likes to be sneaky even\\lif it has a lot of ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlJolly": "Hmhm…\\pThis one says it likes to be sneaky!\\nBut if it gets enough ouchies,\\lit will worry about itself!",
    "BattleFrontier_Lounge5_Text_NatureGirlModest": "Hmhm…\\pThis one says it looks after itself!\\nIt says it worries about itself whether\\lor not it has a lot of ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlMild": "Hmhm…\\pThis one says it looks after itself!\\nBut if it gets enough ouchies,\\lit will turn sneaky!",
    "BattleFrontier_Lounge5_Text_NatureGirlBashful": "Hmhm…\\pThis one says it looks after itself!\\nIt says it worries about itself even\\lif it has a lot of ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlRash": "Hmhm…\\pThis one says it likes to be sneaky!\\nIt says it likes to be sneaky even\\lif it has a lot of ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlCalm": "Hmhm…\\pThis one says it looks after itself!\\nIt says it worries about itself even\\lif it has a lot of ouchies!",
    "BattleFrontier_Lounge5_Text_NatureGirlGentle": "Hmhm…\\pThis one says it looks after itself!\\nBut if it gets enough ouchies,\\lit will hit back!",
    "BattleFrontier_Lounge5_Text_NatureGirlSassy": "Hmhm…\\pThis one says it likes to battle!\\nBut if it gets enough ouchies,\\lit will turn sneaky!",
    "BattleFrontier_Lounge5_Text_NatureGirlCareful": "Hmhm…\\pThis one says it looks after itself!\\nBut if it gets enough ouchies,\\lit will turn sneaky!",
    "BattleFrontier_Lounge5_Text_NatureGirlEgg": "That's silly! An EGG is asleep!\\nI can't talk to it!",
    "BattleFrontier_Lounge5_Text_LadyClaimsSheUnderstandsPokemon": "How charming!\\nThat little lady claims she can\\lunderstand POKéMON!",
    "BattleFrontier_Lounge5_Text_GirlSayingSomethingProfound": "I have this feeling that the little girl\\nis saying something profound.",
    "BattleFrontier_Lounge5_Text_GirlPlaysAtRedHouseALot": "I know something!\\pThat little girl plays at the red house\\na lot!",
  },
};

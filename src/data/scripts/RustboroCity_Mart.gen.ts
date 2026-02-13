// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "RustboroCity_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "goto_if_unset", args: ["FLAG_MET_DEVON_EMPLOYEE", "RustboroCity_Mart_EventScript_PokemartBasic"] },
      { cmd: "goto_if_set", args: ["FLAG_MET_DEVON_EMPLOYEE", "RustboroCity_Mart_EventScript_PokemartExpanded"] },
      { cmd: "end" },
    ],
    "RustboroCity_Mart_EventScript_PokemartBasic": [
      { cmd: "pokemart", args: ["RustboroCity_Mart_Pokemart_Basic"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_Mart_Pokemart_Basic": [
      { cmd: "pokemartlistend" },
    ],
    "RustboroCity_Mart_EventScript_PokemartExpanded": [
      { cmd: "pokemart", args: ["RustboroCity_Mart_Pokemart_Expanded"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_Mart_Pokemart_Expanded": [
      { cmd: "pokemartlistend" },
    ],
    "RustboroCity_Mart_EventScript_PokefanF": [
      { cmd: "msgbox", args: ["RustboroCity_Mart_Text_BuyingHealsInCaseOfShroomish", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_Mart_EventScript_Boy": [
      { cmd: "msgbox", args: ["RustboroCity_Mart_Text_ShouldBuySuperPotionsInstead", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_Mart_EventScript_BugCatcher": [
      { cmd: "msgbox", args: ["RustboroCity_Mart_Text_GettingEscapeRopeJustInCase", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_Mart_Text_BuyingHealsInCaseOfShroomish": "I'm buying some PARLYZ HEALS and\\nANTIDOTES.\\pJust in case I run into SHROOMISH\\nin PETALBURG WOODS.",
    "RustboroCity_Mart_Text_ShouldBuySuperPotionsInstead": "My POKéMON evolved.\\nIt has a lot of HP now.\\pI should buy SUPER POTIONS for it\\ninstead of ordinary POTIONS.",
    "RustboroCity_Mart_Text_GettingEscapeRopeJustInCase": "I'm getting an ESCAPE ROPE just in\\ncase I get lost in a cave.\\pI just need to use it to get back to\\nthe entrance.",
  },
};

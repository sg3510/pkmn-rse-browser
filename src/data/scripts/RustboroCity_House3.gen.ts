// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "RustboroCity_House3_EventScript_OldMan": [
      { cmd: "msgbox", args: ["RustboroCity_House3_Text_IGivePerfectlySuitedNicknames", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_House3_EventScript_OldWoman": [
      { cmd: "msgbox", args: ["RustboroCity_House3_Text_NamingPikachuPekachu", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_House3_EventScript_Pekachu": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_PIKACHU", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["RustboroCity_House3_Text_Pekachu", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_House3_Text_IGivePerfectlySuitedNicknames": "For my own POKéMON, I give them\\nperfectly suited nicknames!\\pIt's my expression of, uh…\\noriginality, yes, that's it!",
    "RustboroCity_House3_Text_NamingPikachuPekachu": "But giving the name PEKACHU to\\na PIKACHU? It seems pointless.\\pI suppose it is good to use a name\\nthat's easy to understand, but…",
    "RustboroCity_House3_Text_Pekachu": "PEKACHU: Peka!",
  },
};

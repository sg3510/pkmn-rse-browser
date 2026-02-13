// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "FallarborTown_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["FallarborTown_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "FallarborTown_Mart_Pokemart": [
      { cmd: "pokemartlistend" },
    ],
    "FallarborTown_Mart_EventScript_Woman": [
      { cmd: "msgbox", args: ["FallarborTown_Mart_Text_DecidingSkittyEvolve", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FallarborTown_Mart_EventScript_PokefanM": [
      { cmd: "msgbox", args: ["FallarborTown_Mart_Text_SellNuggetIFound", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "FallarborTown_Mart_EventScript_Skitty": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_SKITTY", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["FallarborTown_Mart_Text_Skitty", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "FallarborTown_Mart_Text_DecidingSkittyEvolve": "I'm having a hard time deciding if I\\nshould make my SKITTY evolve or not.\\pI only have to use this MOON STONE,\\nbut it's so hard to decide…\\pIf I make it evolve, it will become\\nmuch stronger.\\pBut it will look so different, too.",
    "FallarborTown_Mart_Text_Skitty": "SKITTY: Miyao?",
    "FallarborTown_Mart_Text_SellNuggetIFound": "This NUGGET I found here…\\nI suppose I'll have to sell it, seeing\\las how it has no other use.",
  },
};

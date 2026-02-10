// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "LavaridgeTown_PokemonCenter_1F_OnTransition",
    onResume: "CableClub_OnResume",
  },
  scripts: {
    "LavaridgeTown_PokemonCenter_1F_OnTransition": [
      { cmd: "setrespawn", args: ["HEAL_LOCATION_LAVARIDGE_TOWN"] },
      { cmd: "call", args: ["Common_EventScript_UpdateBrineyLocation"] },
      { cmd: "end" },
    ],
    "LavaridgeTown_PokemonCenter_1F_EventScript_Nurse": [
      { cmd: "setvar", args: ["VAR_0x800B", "LOCALID_LAVARIDGE_NURSE"] },
      { cmd: "call", args: ["Common_EventScript_PkmnCenterNurse"] },
      { cmd: "waitmessage" },
      { cmd: "waitbuttonpress" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LavaridgeTown_PokemonCenter_1F_EventScript_Youngster": [
      { cmd: "msgbox", args: ["LavaridgeTown_PokemonCenter_1F_Text_HotSpringCanInvigorate", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LavaridgeTown_PokemonCenter_1F_EventScript_Woman": [
      { cmd: "msgbox", args: ["LavaridgeTown_PokemonCenter_1F_Text_TrainersPokemonSpendTimeTogether", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LavaridgeTown_PokemonCenter_1F_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["LavaridgeTown_PokemonCenter_1F_Text_TrainersShouldRestToo", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LavaridgeTown_PokemonCenter_1F_Text_TrainersPokemonSpendTimeTogether": "I think POKéMON get closer to their\\nTRAINERS if they spend time together.\\pThe longer the better.\\nThat's what I think.",
    "LavaridgeTown_PokemonCenter_1F_Text_HotSpringCanInvigorate": "It's sort of magical how just sitting\\nin a hot-spring pool can invigorate.\\pI wish I could let my POKéMON\\nsoak, too.",
    "LavaridgeTown_PokemonCenter_1F_Text_TrainersShouldRestToo": "Hohoho! Hey, kid, you can reach\\nthe hot springs from here.\\pIf POKéMON are getting rest, so too\\nshould their TRAINERS.",
  },
};

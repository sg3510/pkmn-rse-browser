// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "SootopolisCity_Mart_EventScript_Clerk": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["SootopolisCity_Mart_Pokemart"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_Mart_Pokemart": [
      { cmd: "pokemartlistend" },
    ],
    "SootopolisCity_Mart_EventScript_FatMan": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_ge", args: ["VAR_SKY_PILLAR_STATE", 2, "SootopolisCity_Mart_EventScript_FatManNoLegendaries"] },
      { cmd: "goto_if_unset", args: ["FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN", "SootopolisCity_Mart_EventScript_FatManNoLegendaries"] },
      { cmd: "msgbox", args: ["SootopolisCity_Mart_Text_TooScaryOutside", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_Mart_EventScript_FatManNoLegendaries": [
      { cmd: "msgbox", args: ["SootopolisCity_Mart_Text_PPUpIsGreat", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_Mart_EventScript_Gentleman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_ge", args: ["VAR_SKY_PILLAR_STATE", 2, "SootopolisCity_Mart_EventScript_GentlemanNoLegendaries"] },
      { cmd: "goto_if_unset", args: ["FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN", "SootopolisCity_Mart_EventScript_GentlemanNoLegendaries"] },
      { cmd: "msgbox", args: ["SootopolisCity_Mart_Text_DidSomethingAwaken", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "SootopolisCity_Mart_EventScript_GentlemanNoLegendaries": [
      { cmd: "msgbox", args: ["SootopolisCity_Mart_Text_FullRestoreItemOfDreams", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "SootopolisCity_Mart_Text_PPUpIsGreat": "PP UP is great!\\pIt raises the POWER POINTS, the PP,\\nof a POKéMON move.",
    "SootopolisCity_Mart_Text_TooScaryOutside": "What…\\nWhat is happening?\\pI really want to know, but it's too\\nscary to go outside.",
    "SootopolisCity_Mart_Text_FullRestoreItemOfDreams": "Do you know FULL RESTORE?\\pFull restoration of HP!\\nEradication of all status problems!\\pIt's truly an item of your dreams!",
    "SootopolisCity_Mart_Text_DidSomethingAwaken": "This weather…\\nDid something awaken?",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MossdeepCity_House3_EventScript_SuperRodFisherman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_SUPER_ROD", "MossdeepCity_House3_EventScript_ReceivedSuperRod"] },
      { cmd: "msgbox", args: ["MossdeepCity_House3_Text_YouWantSuperRod", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "MossdeepCity_House3_EventScript_DeclineSuperRod"] },
      { cmd: "msgbox", args: ["MossdeepCity_House3_Text_SuperRodIsSuper", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_SUPER_ROD"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_SUPER_ROD"] },
      { cmd: "msgbox", args: ["MossdeepCity_House3_Text_TryDroppingRodInWater", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House3_EventScript_ReceivedSuperRod": [
      { cmd: "msgbox", args: ["MossdeepCity_House3_Text_GoAfterSeafloorPokemon", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House3_EventScript_DeclineSuperRod": [
      { cmd: "msgbox", args: ["MossdeepCity_House3_Text_DontYouLikeToFish", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MossdeepCity_House3_Text_YouWantSuperRod": "Hey there, TRAINER!\\nA SUPER ROD really is super!\\pSay all you want, but this baby can\\ncatch POKéMON off the seafloor!\\pWhat do you think?\\nYou want it, don't you?",
    "MossdeepCity_House3_Text_SuperRodIsSuper": "You bet, you bet!\\nAfter all, a SUPER ROD is really super!",
    "MossdeepCity_House3_Text_TryDroppingRodInWater": "If there's any water, try dropping in\\nyour ROD and see what bites!",
    "MossdeepCity_House3_Text_DontYouLikeToFish": "Hunh?\\nDon't you like to fish?",
    "MossdeepCity_House3_Text_GoAfterSeafloorPokemon": "Go after the seafloor POKéMON with\\nyour SUPER ROD.",
  },
};

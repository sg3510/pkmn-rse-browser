// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MauvilleCity_House1_EventScript_RockSmashDude": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RECEIVED_HM_ROCK_SMASH", "MauvilleCity_House1_EventScript_ReceivedRockSmash"] },
      { cmd: "msgbox", args: ["MauvilleCity_House1_Text_ImRockSmashDudeTakeThis", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_HM_ROCK_SMASH"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_HM_ROCK_SMASH"] },
      { cmd: "setflag", args: ["FLAG_HIDE_ROUTE_111_ROCK_SMASH_TIP_GUY"] },
      { cmd: "msgbox", args: ["MauvilleCity_House1_Text_ExplainRockSmash", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MauvilleCity_House1_EventScript_ReceivedRockSmash": [
      { cmd: "msgbox", args: ["MauvilleCity_House1_Text_MonCanFlyOutOfSmashedRock", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MauvilleCity_House1_Text_ImRockSmashDudeTakeThis": "Woohoo!\\pI hear people call me the ROCK SMASH\\nGUY, but I find that sort of degrading.\\pI think I deserve a bit more respect,\\nlike maybe the ROCK SMASH DUDE.\\pWoohoo!\\pAnyways, your POKéMON look pretty\\nstrong.\\pI like that!\\nHere, take this HIDDEN MACHINE!",
    "MauvilleCity_House1_Text_ExplainRockSmash": "That HM contains ROCK SMASH.\\pIf you come across large boulders\\nthat block your path…\\pWell, use that HM move and smash\\nthem right out of your way!\\pYes, sir! Smash rocks aside, I say!\\nWoohoo!",
    "MauvilleCity_House1_Text_MonCanFlyOutOfSmashedRock": "Oh, yes, if you smash a rock, a POKéMON\\ncould come flying out of hiding.\\pWoohoo!",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "Route104_PrettyPetalFlowerShop_OnTransition",
  },
  scripts: {
    "Route104_PrettyPetalFlowerShop_OnTransition": [
      { cmd: "setflag", args: ["FLAG_LANDMARK_FLOWER_SHOP"] },
      { cmd: "goto_if_unset", args: ["FLAG_MET_PRETTY_PETAL_SHOP_OWNER", "Route104_PrettyPetalFlowerShop_EventScript_MoveShopOwner"] },
      { cmd: "goto_if_unset", args: ["FLAG_BADGE03_GET", "Route104_PrettyPetalFlowerShop_EventScript_MoveShopOwner"] },
      { cmd: "setflag", args: ["FLAG_TEMP_1"] },
      { cmd: "end" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_MoveShopOwner": [
      { cmd: "setobjectxyperm", args: ["LOCALID_FLOWER_SHOP_OWNER", 4, 6] },
      { cmd: "end" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_ShopOwner": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_TEMP_1", "Route104_PrettyPetalFlowerShop_EventScript_SellDecorations"] },
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_ThisIsPrettyPetalFlowerShop", "MSGBOX_DEFAULT"] },
      { cmd: "goto_if_set", args: ["FLAG_MET_PRETTY_PETAL_SHOP_OWNER", "Route104_PrettyPetalFlowerShop_EventScript_AlreadyMet"] },
      { cmd: "setflag", args: ["FLAG_MET_PRETTY_PETAL_SHOP_OWNER"] },
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_IntroLearnAboutBerries", "MSGBOX_YESNO"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "YES", "Route104_PrettyPetalFlowerShop_EventScript_ExplainBerries"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "NO", "Route104_PrettyPetalFlowerShop_EventScript_DontExplainBerries"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_AlreadyMet": [
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_LearnAboutBerries", "MSGBOX_YESNO"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "YES", "Route104_PrettyPetalFlowerShop_EventScript_ExplainBerries"] },
      { cmd: "call_if_eq", args: ["VAR_RESULT", "NO", "Route104_PrettyPetalFlowerShop_EventScript_DontExplainBerries"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_ExplainBerries": [
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_BerriesExplanation", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_DontExplainBerries": [
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_FlowersBringHappiness", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_SellDecorations": [
      { cmd: "message", args: ["gText_PlayerWhatCanIDoForYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemartdecoration2", args: ["Route104_PrettyPetalFlowerShop_Pokemart_Plants"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route104_PrettyPetalFlowerShop_Pokemart_Plants": [
      { cmd: "pokemartlistend" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_WailmerPailGirl": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_unset", args: ["FLAG_RECEIVED_WAILMER_PAIL", "Route104_PrettyPetalFlowerShop_EventScript_GiveWailmerPail"] },
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_WailmerPailExplanation", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_GiveWailmerPail": [
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_YouCanHaveThis", "MSGBOX_DEFAULT"] },
      { cmd: "giveitem", args: ["ITEM_WAILMER_PAIL"] },
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_WailmerPailExplanation", "MSGBOX_DEFAULT"] },
      { cmd: "setflag", args: ["FLAG_RECEIVED_WAILMER_PAIL"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_RandomBerryGirl": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "dotimebasedevents" },
      { cmd: "goto_if_set", args: ["FLAG_DAILY_FLOWER_SHOP_RECEIVED_BERRY", "Route104_PrettyPetalFlowerShop_EventScript_AlreadyReceivedBerry"] },
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_ImGrowingFlowers", "MSGBOX_DEFAULT"] },
      { cmd: "random", args: [8] },
      { cmd: "addvar", args: ["VAR_RESULT", "FIRST_BERRY_INDEX"] },
      { cmd: "giveitem", args: ["VAR_RESULT"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 0, "Common_EventScript_ShowBagIsFull"] },
      { cmd: "setflag", args: ["FLAG_DAILY_FLOWER_SHOP_RECEIVED_BERRY"] },
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_MachineMixesBerries", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "Route104_PrettyPetalFlowerShop_EventScript_AlreadyReceivedBerry": [
      { cmd: "msgbox", args: ["Route104_PrettyPetalFlowerShop_Text_MachineMixesBerries", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

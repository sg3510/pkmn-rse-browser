// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "AbandonedShip_CaptainsOffice_EventScript_CaptSternAide": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_EXCHANGED_SCANNER", "AbandonedShip_CaptainsOffice_EventScript_ThisIsSSCactus"] },
      { cmd: "checkitem", args: ["ITEM_SCANNER"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "AbandonedShip_CaptainsOffice_EventScript_CanYouDeliverScanner"] },
      { cmd: "goto_if_set", args: ["FLAG_ITEM_ABANDONED_SHIP_HIDDEN_FLOOR_ROOM_2_SCANNER", "AbandonedShip_CaptainsOffice_EventScript_ThisIsSSCactus"] },
      { cmd: "msgbox", args: ["AbandonedShip_CaptainsOffice_Text_NoSuccessFindingScanner", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AbandonedShip_CaptainsOffice_EventScript_CanYouDeliverScanner": [
      { cmd: "msgbox", args: ["AbandonedShip_CaptainsOffice_Text_OhCanYouDeliverScanner", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "AbandonedShip_CaptainsOffice_EventScript_ThisIsSSCactus": [
      { cmd: "msgbox", args: ["AbandonedShip_CaptainsOffice_Text_ThisIsSSCactus", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "AbandonedShip_CaptainsOffice_Text_NoSuccessFindingScanner": "I'm investigating this ship on behalf\\nof CAPT. STERN.\\pHe also asked me to find a SCANNER,\\nbut I haven't had any success…",
    "AbandonedShip_CaptainsOffice_Text_OhCanYouDeliverScanner": "Oh! That's a SCANNER!\\pListen, can I get you to deliver that\\nto CAPT. STERN?\\pI want to investigate this ship a\\nlittle more.",
    "AbandonedShip_CaptainsOffice_Text_ThisIsSSCactus": "This ship is called S.S. CACTUS.\\nIt seems to be from an earlier era.",
  },
};

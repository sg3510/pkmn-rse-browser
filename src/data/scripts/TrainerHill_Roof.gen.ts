// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onResume: "TrainerHill_OnResume",
    onFrame: [
      { var: "VAR_TEMP_2", value: 0, script: "TrainerHill_1F_EventScript_DummyWarpToEntranceCounter" },
      { var: "VAR_TEMP_1", value: 1, script: "TrainerHill_EventScript_WarpToEntranceCounter" },
    ],
  },
  scripts: {
    "TrainerHill_Roof_EventScript_Owner": [
      { cmd: "trainerhill_settrainerflags" },
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "trainerhill_getownerstate" },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [0, "TrainerHill_Roof_EventScript_Arrived"] },
      { cmd: "case", args: [1, "TrainerHill_Roof_EventScript_GivePrize"] },
      { cmd: "case", args: [2, "TrainerHill_Roof_EventScript_AlreadyReceivedPrize"] },
    ],
    "TrainerHill_Roof_EventScript_Arrived": [
      { cmd: "msgbox", args: ["TrainerHill_Roof_Text_YouFinallyCameBravo", "MSGBOX_DEFAULT"] },
    ],
    "TrainerHill_Roof_EventScript_GivePrize": [
      { cmd: "trainerhill_giveprize" },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [0, "TrainerHill_Roof_EventScript_ReceivePrize"] },
      { cmd: "case", args: [1, "TrainerHill_Roof_EventScript_NoRoomForPrize"] },
      { cmd: "case", args: [2, "TrainerHill_Roof_EventScript_CheckFinalTime"] },
    ],
    "TrainerHill_Roof_EventScript_ReceivePrize": [
      { cmd: "msgbox", args: ["TrainerHill_Roof_Text_HaveTheMostMarvelousGift", "MSGBOX_DEFAULT"] },
      { cmd: "playfanfare", args: ["MUS_LEVEL_UP"] },
      { cmd: "message", args: ["gText_ObtainedTheItem"] },
      { cmd: "waitfanfare" },
      { cmd: "waitmessage" },
      { cmd: "goto", args: ["TrainerHill_Roof_EventScript_CheckFinalTime"] },
    ],
    "TrainerHill_Roof_EventScript_NoRoomForPrize": [
      { cmd: "msgbox", args: ["TrainerHill_Roof_Text_HaveTheMostMarvelousGift", "MSGBOX_DEFAULT"] },
      { cmd: "msgbox", args: ["gText_TheBagIsFull", "MSGBOX_DEFAULT"] },
      { cmd: "msgbox", args: ["TrainerHill_Roof_Text_FullUpBeBackLaterForThis", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["TrainerHill_Roof_EventScript_CheckFinalTime"] },
    ],
    "TrainerHill_Roof_EventScript_CheckFinalTime": [
      { cmd: "trainerhill_finaltime" },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: [0, "TrainerHill_Roof_EventScript_NewRecord"] },
      { cmd: "case", args: [1, "TrainerHill_Roof_EventScript_NoNewRecord"] },
      { cmd: "case", args: [2, "TrainerHill_Roof_EventScript_EndSpeakToOwner"] },
    ],
    "TrainerHill_Roof_EventScript_NewRecord": [
      { cmd: "msgbox", args: ["TrainerHill_Roof_Text_GotHereMarvelouslyQuickly", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["TrainerHill_Roof_EventScript_EndSpeakToOwner"] },
      { cmd: "end" },
    ],
    "TrainerHill_Roof_EventScript_NoNewRecord": [
      { cmd: "msgbox", args: ["TrainerHill_Roof_Text_YouWerentVeryQuick", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["TrainerHill_Roof_EventScript_EndSpeakToOwner"] },
      { cmd: "end" },
    ],
    "TrainerHill_Roof_EventScript_EndSpeakToOwner": [
      { cmd: "msgbox", args: ["TrainerHill_Roof_Text_ArriveZippierNextTime", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "TrainerHill_Roof_EventScript_AlreadyReceivedPrize": [
      { cmd: "msgbox", args: ["TrainerHill_Roof_Text_ArriveZippierNextTime", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

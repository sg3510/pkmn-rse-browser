// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MossdeepCity_House4_EventScript_Woman": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_SYS_GAME_CLEAR", "MossdeepCity_House4_EventScript_CanBattleAtSecretBases"] },
      { cmd: "msgbox", args: ["MossdeepCity_House4_Text_BrotherLikesToFindBases", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House4_EventScript_CanBattleAtSecretBases": [
      { cmd: "msgbox", args: ["MossdeepCity_House4_Text_BrotherLikesToVisitBasesAndBattle", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House4_EventScript_NinjaBoy": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "special", args: ["CheckPlayerHasSecretBase"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "MossdeepCity_House4_EventScript_NoSecretBase"] },
      { cmd: "special", args: ["GetSecretBaseNearbyMapName"] },
      { cmd: "msgbox", args: ["MossdeepCity_House4_Text_YouMadeSecretBaseNearX", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House4_EventScript_NoSecretBase": [
      { cmd: "msgbox", args: ["MossdeepCity_House4_Text_MakeSecretBase", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House4_EventScript_Skitty": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_SKITTY", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["MossdeepCity_House4_Text_Skitty", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MossdeepCity_House4_Text_BrotherLikesToFindBases": "My little brother says he likes to go\\nfind people's SECRET BASES.",
    "MossdeepCity_House4_Text_BrotherLikesToVisitBasesAndBattle": "My little brother says he likes to\\nvisit people's SECRET BASES and have\\lPOKéMON battles.",
    "MossdeepCity_House4_Text_YouMadeSecretBaseNearX": "Was it you who made a SECRET BASE\\nnear {STR_VAR_1}?",
    "MossdeepCity_House4_Text_MakeSecretBase": "You should make a SECRET BASE\\nsomewhere. I'll go find it!",
    "MossdeepCity_House4_Text_Skitty": "SKITTY: Miyaan?",
  },
};

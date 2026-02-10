// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LilycoveCity_CoveLilyMotel_2F_EventScript_GameDesigner": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "call_if_unset", args: ["FLAG_TEMP_2", "LilycoveCity_CoveLilyMotel_2F_EventScript_ShowMeCompletedDex"] },
      { cmd: "call_if_set", args: ["FLAG_TEMP_2", "LilycoveCity_CoveLilyMotel_2F_EventScript_ShowDiploma"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "HasAllHoennMons"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "LilycoveCity_CoveLilyMotel_2F_EventScript_AllHoennMonsFanfare"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_ShowMeCompletedDex": [
      { cmd: "msgbox", args: ["LilycoveCity_CoveLilyMotel_2F_Text_ShowMeCompletedDex", "MSGBOX_DEFAULT"] },
      { cmd: "return" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_AllHoennMonsFanfare": [
      { cmd: "setflag", args: ["FLAG_TEMP_2"] },
      { cmd: "playfanfare", args: ["MUS_OBTAIN_ITEM"] },
      { cmd: "waitfanfare" },
      { cmd: "goto", args: ["LilycoveCity_CoveLilyMotel_2F_EventScript_ShowDiploma"] },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_ShowDiploma": [
      { cmd: "message", args: ["LilycoveCity_CoveLilyMotel_2F_Text_FilledPokedexGiveYouThis"] },
      { cmd: "waitmessage" },
      { cmd: "call", args: ["Common_EventScript_PlayGymBadgeFanfare"] },
      { cmd: "special", args: ["Special_ShowDiploma"] },
      { cmd: "waitstate" },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_Programmer": [
      { cmd: "msgbox", args: ["LilycoveCity_CoveLilyMotel_2F_Text_ImTheProgrammer", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_GraphicArtist": [
      { cmd: "msgbox", args: ["LilycoveCity_CoveLilyMotel_2F_Text_ImTheGraphicArtist", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_FatMan": [
      { cmd: "msgbox", args: ["LilycoveCity_CoveLilyMotel_2F_Text_GirlsAreCute", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_Woman": [
      { cmd: "msgbox", args: ["LilycoveCity_CoveLilyMotel_2F_Text_SeaBreezeTicklesHeart", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_GameBoyKid": [
      { cmd: "msgbox", args: ["LilycoveCity_CoveLilyMotel_2F_Text_NeverLeaveWithoutGameBoy", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_Scott": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_MET_SCOTT_IN_LILYCOVE", "LilycoveCity_CoveLilyMotel_2F_EventScript_MetScott"] },
      { cmd: "msgbox", args: ["LilycoveCity_CoveLilyMotel_2F_Text_SnoozingPreferBattles", "MSGBOX_DEFAULT"] },
      { cmd: "addvar", args: ["VAR_SCOTT_STATE", 1] },
      { cmd: "setflag", args: ["FLAG_MET_SCOTT_IN_LILYCOVE"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_CoveLilyMotel_2F_EventScript_MetScott": [
      { cmd: "msgbox", args: ["LilycoveCity_CoveLilyMotel_2F_Text_ContestsDoTakeStrategy", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_CoveLilyMotel_2F_Text_ShowMeCompletedDex": "I'm the GAME DESIGNER.\\pOh, is that right?\\nYou're working on a POKéDEX?\\pIt's tough trying to complete it,\\nbut don't give up.\\pIf you do complete it, please come\\nshow me.",
    "LilycoveCity_CoveLilyMotel_2F_Text_FilledPokedexGiveYouThis": "Wow! That's awesome!\\nYep, it's totally awesome!\\pThis POKéDEX is completely filled!\\nYou really must love POKéMON!\\pI'm so impressed!\\pLet me give you something in\\nrecognition of your feat!",
    "LilycoveCity_CoveLilyMotel_2F_Text_ImTheProgrammer": "Me? You're talking to me?\\nI'm the PROGRAMMER.\\pI wonder what the SLOTS are\\nlike here.",
    "LilycoveCity_CoveLilyMotel_2F_Text_ImTheGraphicArtist": "I'm the GRAPHIC ARTIST! Aren't the\\nPOKéMON of HOENN interesting?",
    "LilycoveCity_CoveLilyMotel_2F_Text_GirlsAreCute": "The girl TUBERS, they're cute, hey?\\nTo battle against a cute TUBER…\\pWhoop, it's so awesome!\\pAnd the TWINS! Aren't they cute?\\nA 2-on-2 battle with TWINS…\\pWhoop, it's unbearably fun!",
    "LilycoveCity_CoveLilyMotel_2F_Text_SeaBreezeTicklesHeart": "The sea breeze tickles my heart.\\nIt feels wonderful here!",
    "LilycoveCity_CoveLilyMotel_2F_Text_NeverLeaveWithoutGameBoy": "You never know when and where\\npeople will challenge you.\\pThat's why I never leave home without\\nmy GAME BOY ADVANCE.",
    "LilycoveCity_CoveLilyMotel_2F_Text_SnoozingPreferBattles": "SCOTT: … … … … …\\n… … … … … Zzz…\\p… … … … … Huh?!\\nOh, sorry, sorry! I was snoozing!\\pI came to check out this POKéMON\\nCONTEST thing.\\pI have to admit, it does look quite\\nentertaining, but…\\pConsider me a purist--I prefer\\nbattles and tough TRAINERS.\\pBut that's just me.\\p{PLAYER}{KUN}, I hope you'll enjoy everything\\nlike the GYMS, CONTESTS, BATTLE TENT,\\lthe whole works!",
    "LilycoveCity_CoveLilyMotel_2F_Text_ContestsDoTakeStrategy": "SCOTT: I think it does take strategy\\nto win a CONTEST.\\pDevising CONTEST strategies is one way\\nof becoming a better TRAINER, I'd say.",
  },
};

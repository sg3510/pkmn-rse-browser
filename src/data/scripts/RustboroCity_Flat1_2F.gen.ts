// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "RustboroCity_Flat1_2F_EventScript_WaldasDad": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "specialvar", args: ["VAR_RESULT", "TryBufferWaldaPhrase"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "RustboroCity_Flat1_2F_EventScript_WaldasDadFirstPhrase"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "RustboroCity_Flat1_2F_EventScript_WaldasDadNewPhrase"] },
    ],
    "RustboroCity_Flat1_2F_EventScript_GivePhrase": [
      { cmd: "special", args: ["DoWaldaNamingScreen"] },
      { cmd: "waitstate" },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", 1, "RustboroCity_Flat1_2F_EventScript_CancelGivePhrase"] },
      { cmd: "goto_if_eq", args: ["VAR_0x8004", 2, "RustboroCity_Flat1_2F_EventScript_CancelGiveFirstPhrase"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "TryGetWallpaperWithWaldaPhrase"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "TRUE", "RustboroCity_Flat1_2F_EventScript_WaldaLikesPhrase"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "FALSE", "RustboroCity_Flat1_2F_EventScript_WaldaDoesntLikePhrase"] },
      { cmd: "end" },
    ],
    "RustboroCity_Flat1_2F_EventScript_WaldasDadFirstPhrase": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_HelloDoYouKnowFunnyPhrase", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "RustboroCity_Flat1_2F_EventScript_DeclineGivePhrase"] },
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_WonderfulLetsHearSuggestion", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["RustboroCity_Flat1_2F_EventScript_GivePhrase"] },
    ],
    "RustboroCity_Flat1_2F_EventScript_WaldasDadNewPhrase": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_BeenSayingXDoYouKnowBetterPhrase", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "RustboroCity_Flat1_2F_EventScript_DeclineGivePhrase"] },
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_WonderfulLetsHearSuggestion", "MSGBOX_DEFAULT"] },
      { cmd: "goto", args: ["RustboroCity_Flat1_2F_EventScript_GivePhrase"] },
    ],
    "RustboroCity_Flat1_2F_EventScript_DeclineGivePhrase": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_OhIsThatRight", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_Flat1_2F_EventScript_CancelGivePhrase": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_OhYouDontKnowAny", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_Flat1_2F_EventScript_CancelGiveFirstPhrase": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_ThinkOfMyOwnPhrase", "MSGBOX_DEFAULT"] },
      { cmd: "call", args: ["RustboroCity_Flat1_2F_EventScript_WaldasDadFaceWalda"] },
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_ShesNotSmilingAtAll2", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_Flat1_2F_EventScript_WaldaLikesPhrase": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_LetsGiveItATry2", "MSGBOX_DEFAULT"] },
      { cmd: "call", args: ["RustboroCity_Flat1_2F_EventScript_WaldasDadFaceWalda"] },
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_OhShesLaughing", "MSGBOX_DEFAULT"] },
      { cmd: "applymovement", args: ["LOCALID_WALDAS_DAD", "Common_Movement_FacePlayer"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_ThankYouIllGiveYouWallpaper", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_Flat1_2F_EventScript_WaldaDoesntLikePhrase": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_LetsGiveItATry", "MSGBOX_DEFAULT"] },
      { cmd: "call", args: ["RustboroCity_Flat1_2F_EventScript_WaldasDadFaceWalda"] },
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_ShesNotSmilingAtAll", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "RustboroCity_Flat1_2F_EventScript_WaldasDadFaceWalda": [
      { cmd: "turnobject", args: ["LOCALID_WALDAS_DAD", "DIR_EAST"] },
      { cmd: "return" },
    ],
    "RustboroCity_Flat1_2F_EventScript_WaldasMom": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_ComingUpWithMealsIsHard", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "RustboroCity_Flat1_2F_EventScript_PokeDoll": [
      { cmd: "msgbox", args: ["RustboroCity_Flat1_2F_Text_ItsAPokemonPlushDoll", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "RustboroCity_Flat1_2F_Text_ComingUpWithMealsIsHard": "Oh, it's so hard every day…\\pWhat's hard?\\nYou need to ask?\\pIt's trying to figure out what to\\nmake for meals every day.\\pIt really isn't easy coming up with\\nmeals every day.",
    "RustboroCity_Flat1_2F_Text_HelloDoYouKnowFunnyPhrase": "Oh, hello!\\nWelcome to the PEPPER household.\\pI have a question for you.\\nHave you ever baby-sat?\\pYou see, I'm a new father, so raising\\na child is all new to me.\\pAnd I have a problem. My daughter\\nWALDA doesn't laugh enough.\\pI think she'd laugh for me if I told\\nher something funny.\\pDo you know of a funny word or\\nphrase you can tell me?",
    "RustboroCity_Flat1_2F_Text_BeenSayingXDoYouKnowBetterPhrase": "I've been saying “{STR_VAR_1}”\\nto amuse her lately.\\pDo you know of a better word or\\na phrase that might work?",
    "RustboroCity_Flat1_2F_Text_WonderfulLetsHearSuggestion": "Oh, that's wonderful.\\nSo, let's hear it, your suggestion.",
    "RustboroCity_Flat1_2F_Text_OhIsThatRight": "Oh, is that right?\\pWell, if you come up with a good\\nsuggestion, I'm all ears.",
    "RustboroCity_Flat1_2F_Text_LetsGiveItATry2": "Ah, I see.\\nWell, let's give it a try, shall we?",
    "RustboroCity_Flat1_2F_Text_OhShesLaughing": "{STR_VAR_1}.\\n{STR_VAR_1}.\\pOh, yes! She's laughing!\\nOh, I am as delighted as she!",
    "RustboroCity_Flat1_2F_Text_LetsGiveItATry": "Ah, I see.\\nWell, let's give it a try, shall we?",
    "RustboroCity_Flat1_2F_Text_ShesNotSmilingAtAll": "{STR_VAR_1}.\\n{STR_VAR_1}.\\pHmmm… She's not smiling at all.\\nMaybe WALDA is one serious child…",
    "RustboroCity_Flat1_2F_Text_ThinkOfMyOwnPhrase": "Oh, so you don't know any good words.\\nI'd better think for myself, then.\\pHmm…\\nHow about “{STR_VAR_1}”?\\lLet's see if that will work.",
    "RustboroCity_Flat1_2F_Text_ShesNotSmilingAtAll2": "{STR_VAR_1}.\\n{STR_VAR_1}.\\pHmmm… She's not smiling at all.\\nMaybe WALDA is one serious child…",
    "RustboroCity_Flat1_2F_Text_OhYouDontKnowAny": "Oh, so you don't know any good words.\\nI guess I'll try to amuse her with\\lthe saying I used before.\\pAnyways, if you have a good suggestion,\\ndon't hesitate in telling me, okay?",
    "RustboroCity_Flat1_2F_Text_ThankYouIllGiveYouWallpaper": "Thank you!\\pThanks to you, my darling WALDA\\nlaughed for me!\\pActually, I may not look all that\\nspecial, but I'm one of DEVON\\lCORPORATION's top researchers.\\pSo, how about I do something in return\\nfor you?\\pI know, I'll add some new wallpaper\\npatterns for the BOXES in the PC\\lPOKéMON Storage System.\\pIn the wallpaper pattern menu,\\nselect “FRIENDS.”\\pThat will give you access to the new\\nwallpaper patterns.",
    "RustboroCity_Flat1_2F_Text_ItsAPokemonPlushDoll": "It's a POKéMON plush DOLL!",
  },
};

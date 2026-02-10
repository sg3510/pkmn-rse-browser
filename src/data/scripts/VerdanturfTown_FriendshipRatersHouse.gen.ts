// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "VerdanturfTown_FriendshipRatersHouse_EventScript_FriendshipRater": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_SeeHowMuchPokemonLikesYou", "MSGBOX_DEFAULT"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetLeadMonFriendshipScore"] },
      { cmd: "switch", args: ["VAR_RESULT"] },
      { cmd: "case", args: ["FRIENDSHIP_NONE", "VerdanturfTown_FriendshipRatersHouse_EventScript_DetestsYou"] },
      { cmd: "case", args: ["FRIENDSHIP_1_TO_49", "VerdanturfTown_FriendshipRatersHouse_EventScript_VeryWary"] },
      { cmd: "case", args: ["FRIENDSHIP_50_TO_99", "VerdanturfTown_FriendshipRatersHouse_EventScript_NotUsedToYou"] },
      { cmd: "case", args: ["FRIENDSHIP_100_TO_149", "VerdanturfTown_FriendshipRatersHouse_EventScript_GettingUsedToYou"] },
      { cmd: "case", args: ["FRIENDSHIP_150_TO_199", "VerdanturfTown_FriendshipRatersHouse_EventScript_LikesYouQuiteALot"] },
      { cmd: "case", args: ["FRIENDSHIP_200_TO_254", "VerdanturfTown_FriendshipRatersHouse_EventScript_VeryHappy"] },
      { cmd: "case", args: ["FRIENDSHIP_MAX", "VerdanturfTown_FriendshipRatersHouse_EventScript_AdoresYou"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_FriendshipRatersHouse_EventScript_DetestsYou": [
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_DetestsYou", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_FriendshipRatersHouse_EventScript_VeryWary": [
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_VeryWary", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_FriendshipRatersHouse_EventScript_NotUsedToYou": [
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_NotUsedToYou", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_FriendshipRatersHouse_EventScript_GettingUsedToYou": [
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_GettingUsedToYou", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_FriendshipRatersHouse_EventScript_LikesYouQuiteALot": [
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_LikesYouQuiteALot", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_FriendshipRatersHouse_EventScript_VeryHappy": [
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_VeryHappy", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_FriendshipRatersHouse_EventScript_AdoresYou": [
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_AdoresYou", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_FriendshipRatersHouse_EventScript_Pikachu": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "waitse" },
      { cmd: "playmoncry", args: ["SPECIES_PIKACHU", "CRY_MODE_NORMAL"] },
      { cmd: "msgbox", args: ["VerdanturfTown_FriendshipRatersHouse_Text_Pikachu", "MSGBOX_DEFAULT"] },
      { cmd: "waitmoncry" },
      { cmd: "release" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "VerdanturfTown_FriendshipRatersHouse_Text_SeeHowMuchPokemonLikesYou": "Let me see your POKéMON.\\nI'll check to see how much it likes you.\\pOh.\\nYour POKéMON…",
    "VerdanturfTown_FriendshipRatersHouse_Text_AdoresYou": "It adores you.\\nIt can't possibly love you any more.\\lI even feel happy seeing it.",
    "VerdanturfTown_FriendshipRatersHouse_Text_VeryHappy": "It seems to be very happy.\\nIt obviously likes you a whole lot.",
    "VerdanturfTown_FriendshipRatersHouse_Text_LikesYouQuiteALot": "It likes you quite a lot.\\nIt seems to want to be babied a little.",
    "VerdanturfTown_FriendshipRatersHouse_Text_GettingUsedToYou": "It's getting used to you.\\nIt seems to believe in you.",
    "VerdanturfTown_FriendshipRatersHouse_Text_NotUsedToYou": "It's not very used to you yet.\\nIt neither loves nor hates you.",
    "VerdanturfTown_FriendshipRatersHouse_Text_VeryWary": "It's very wary.\\nIt has scary viciousness in its eyes.\\lIt doesn't like you much at all.",
    "VerdanturfTown_FriendshipRatersHouse_Text_DetestsYou": "This is a little hard for me to say…\\pYour POKéMON simply detests you.\\nDoesn't that make you uncomfortable?",
    "VerdanturfTown_FriendshipRatersHouse_Text_Pikachu": "PIKACHU: Pika pika!",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LilycoveCity_LilycoveMuseum_1F_EventScript_Greeter": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_WelcomeToLilycoveMuseum", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_Curator": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_MUSEUM_1F_CURATOR", "Common_Movement_FacePlayer"] },
      { cmd: "message", args: ["LilycoveCity_LilycoveMuseum_1F_Text_ImCuratorHaveYouViewedOurPaintings"] },
      { cmd: "waitmessage" },
      { cmd: "multichoice", args: [20, 8, "MULTI_VIEWED_PAINTINGS", "TRUE"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 0, "LilycoveCity_LilycoveMuseum_1F_EventScript_SawPaintings"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 1, "LilycoveCity_LilycoveMuseum_1F_EventScript_NotYet"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_NotYet": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_NotDisturbYouTakeYourTime", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_SawPaintings": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_HaveYouAnInterestInPaintings", "MSGBOX_YESNO"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "NO", "LilycoveCity_LilycoveMuseum_1F_EventScript_NotInterested"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", "YES", "LilycoveCity_LilycoveMuseum_1F_EventScript_InterestedInPaintings"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_NotInterested": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_HonoredYoudVisitInSpiteOfThat", "MSGBOX_SIGN"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_InterestedInPaintings": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_ExcellentCanYouComeWithMe", "MSGBOX_SIGN"] },
      { cmd: "applymovement", args: ["LOCALID_MUSEUM_1F_CURATOR", "LilycoveCity_LilycoveMuseum_1F_Movement_CuratorEnterStairs"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "removeobject", args: ["LOCALID_MUSEUM_1F_CURATOR"] },
      { cmd: "switch", args: ["VAR_FACING"] },
      { cmd: "case", args: ["DIR_NORTH", "LilycoveCity_LilycoveMuseum_1F_EventScript_FollowCuratorNorth"] },
      { cmd: "case", args: ["DIR_WEST", "LilycoveCity_LilycoveMuseum_1F_EventScript_FollowCuratorWest"] },
      { cmd: "case", args: ["DIR_EAST", "LilycoveCity_LilycoveMuseum_1F_EventScript_FollowCuratorEast"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_FollowCuratorNorth": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "LilycoveCity_LilycoveMuseum_1F_Movement_FollowCuratorNorth"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "warp", args: ["MAP_LILYCOVE_CITY_LILYCOVE_MUSEUM_2F", 11, 8] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_FollowCuratorWest": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "LilycoveCity_LilycoveMuseum_1F_Movement_FollowCuratorWest"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "warp", args: ["MAP_LILYCOVE_CITY_LILYCOVE_MUSEUM_2F", 11, 8] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_FollowCuratorEast": [
      { cmd: "lockall" },
      { cmd: "applymovement", args: ["LOCALID_PLAYER", "LilycoveCity_LilycoveMuseum_1F_Movement_FollowCuratorEast"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "warp", args: ["MAP_LILYCOVE_CITY_LILYCOVE_MUSEUM_2F", 11, 8] },
      { cmd: "waitstate" },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_OldPainting": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_VeryOldPainting", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_FantasyPainting": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_OddLandscapeFantasticScenery", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_WomanPainting": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_PaintingOfBeautifulWoman", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_LegendaryPokemonPainting": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_PaintingOfLegendaryPokemon", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_GrassPokemonPainting": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_PaintingOfGrassPokemon", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_BerryPainting": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_PaintingOfBerries", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_EventScript_BirdSculpture": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_Text_BirdPokemonSculptureReplica", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_PokeBallSculpture": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_BigPokeBallCarvedFromStone", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_StoneTablet": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_StoneTabletWithAncientText", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_SchoolKidM": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_MustntForgetLoveForFineArts", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_Artist1": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_ThisMuseumIsInspiration", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_NinjaBoy": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_ThisLadyIsPretty", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_Woman1": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_ThisPokemonIsAdorable", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_Woman2": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_HeardMuseumGotNewPaintings", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_PsychicM": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_CuratorHasBeenCheerful", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_Artist2": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_AimToSeeGreatPaintings", "MSGBOX_DEFAULT"] },
      { cmd: "closemessage" },
      { cmd: "applymovement", args: ["LOCALID_MUSEUM_1F_ARTIST_2", "Common_Movement_FaceOriginalDirection"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_LilycoveMuseum_1F_EventScript_FatMan": [
      { cmd: "msgbox", args: ["LilycoveCity_LilycoveMuseum_1F_Text_MuseumTouristDestination", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
    "LilycoveCity_LilycoveMuseum_1F_Movement_CuratorEnterStairs": ["walk_up"],
    "LilycoveCity_LilycoveMuseum_1F_Movement_FollowCuratorWest": ["walk_left", "walk_up"],
    "LilycoveCity_LilycoveMuseum_1F_Movement_FollowCuratorEast": ["walk_right", "walk_up"],
    "LilycoveCity_LilycoveMuseum_1F_Movement_FollowCuratorNorth": ["walk_up", "walk_up"],
  },
  text: {
    "LilycoveCity_LilycoveMuseum_1F_Text_WelcomeToLilycoveMuseum": "Welcome to LILYCOVE MUSEUM.\\pPlease take the time to enjoy our\\ncollection of fantastic artwork\\lfeaturing POKéMON.",
    "LilycoveCity_LilycoveMuseum_1F_Text_ImCuratorHaveYouViewedOurPaintings": "I'm the CURATOR of this MUSEUM of\\nfine arts.\\pIt's heartening to see someone so\\nyoung as you in our MUSEUM.\\pHave you viewed our collection of\\npaintings already?",
    "LilycoveCity_LilycoveMuseum_1F_Text_NotDisturbYouTakeYourTime": "Ah, then let me not disturb you.\\nPlease, do take your time.",
    "LilycoveCity_LilycoveMuseum_1F_Text_HaveYouAnInterestInPaintings": "Oh? I do believe that you seem to\\nbe a POKéMON TRAINER.\\pHave you an interest in paintings,\\ntoo?",
    "LilycoveCity_LilycoveMuseum_1F_Text_HonoredYoudVisitInSpiteOfThat": "I see…\\pI'm honored that you would visit\\nus in spite of that.",
    "LilycoveCity_LilycoveMuseum_1F_Text_ExcellentCanYouComeWithMe": "Ah, excellent!\\nYou do like paintings!\\pThen, may I ask you to come with me?",
    "LilycoveCity_LilycoveMuseum_1F_Text_VeryOldPainting": "It's a very old painting.\\nThe paint is peeling here and there.",
    "LilycoveCity_LilycoveMuseum_1F_Text_OddLandscapeFantasticScenery": "It's an odd landscape with bizarre\\nand fantastic scenery.",
    "LilycoveCity_LilycoveMuseum_1F_Text_PaintingOfBeautifulWoman": "It's a painting of a beautiful, smiling\\nwoman with a POKéMON on her lap.",
    "LilycoveCity_LilycoveMuseum_1F_Text_PaintingOfLegendaryPokemon": "It's a painting of a legendary POKéMON\\nfrom long ago.\\pThe artist painted this from\\nimagination.",
    "LilycoveCity_LilycoveMuseum_1F_Text_PaintingOfGrassPokemon": "It's a painting of GRASS POKéMON\\nswaying in a breeze.\\pThey appear to be enjoying the wind's\\ngentle caress.",
    "LilycoveCity_LilycoveMuseum_1F_Text_PaintingOfBerries": "It's a delicious-looking painting\\nof BERRIES.\\pThis painting could make you hungry!",
    "LilycoveCity_LilycoveMuseum_Text_BirdPokemonSculptureReplica": "It's a replica of a famous sculpture.\\pIt depicts an ancient BIRD POKéMON.",
    "LilycoveCity_LilycoveMuseum_1F_Text_BigPokeBallCarvedFromStone": "It's a big POKé BALL carved from\\na black stone.\\pIt was apparently used in festivals\\nin the olden days.",
    "LilycoveCity_LilycoveMuseum_1F_Text_StoneTabletWithAncientText": "It's a huge stone tablet inscribed\\nwith POKéMON and dense text in the\\lsmall characters of an ancient,\\lunreadable language.",
    "LilycoveCity_LilycoveMuseum_1F_Text_WorksOfMagnificence": "Hmmm…\\nWhat works of great magnificence…",
    "LilycoveCity_LilycoveMuseum_1F_Text_MustntForgetLoveForFineArts": "Battling with POKéMON is fun,\\nI'll grant you that.\\pBut one mustn't forget our love for\\nthe fine arts.",
    "LilycoveCity_LilycoveMuseum_1F_Text_ThisMuseumIsInspiration": "This ART MUSEUM… Well, you could\\nsee many fantastic paintings.\\pAnd the CURATOR is a wonderful person.\\pAmong artists like myself, this MUSEUM\\nis an inspiration.",
    "LilycoveCity_LilycoveMuseum_1F_Text_ThisLadyIsPretty": "This lady is pretty!\\nShe's like Mommy!",
    "LilycoveCity_LilycoveMuseum_1F_Text_ThisPokemonIsAdorable": "This POKéMON is adorable!\\nJust like our little boy!",
    "LilycoveCity_LilycoveMuseum_1F_Text_HeardMuseumGotNewPaintings": "I'd heard that this ART MUSEUM got\\nin some new paintings.\\pSo, naturally I hurried over.\\pAre the new paintings up on\\nthe second floor?",
    "LilycoveCity_LilycoveMuseum_1F_Text_CuratorHasBeenCheerful": "Lately, the CURATOR has been\\nunusually cheerful.\\pI bet something good happened for him.\\nDefinitely.",
    "LilycoveCity_LilycoveMuseum_1F_Text_AimToSeeGreatPaintings": "I aim to see many great paintings\\nhere and learn from them.\\pI have this dream of one day having\\nmy artwork exhibited here.",
    "LilycoveCity_LilycoveMuseum_1F_Text_MuseumTouristDestination": "The ART MUSEUM has become a favorite\\ntourist destination.\\pIt's great for LILYCOVE…\\nNo, great for the HOENN region!\\pThis is what I've heard--a lone TRAINER\\nprocured all the paintings upstairs.",
  },
};

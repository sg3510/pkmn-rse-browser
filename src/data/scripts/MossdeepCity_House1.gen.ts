// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "MossdeepCity_House1_EventScript_BlackBelt": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "bufferleadmonspeciesname", args: ["STR_VAR_1"] },
      { cmd: "msgbox", args: ["MossdeepCity_House1_Text_HmmYourPokemon", "MSGBOX_DEFAULT"] },
      { cmd: "specialvar", args: ["VAR_RESULT", "GetPokeblockNameByMonNature"] },
      { cmd: "goto_if_eq", args: ["VAR_RESULT", 0, "MossdeepCity_House1_EventScript_NeutralNature"] },
      { cmd: "msgbox", args: ["MossdeepCity_House1_Text_ItLikesXPokeblocks", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House1_EventScript_NeutralNature": [
      { cmd: "msgbox", args: ["MossdeepCity_House1_Text_DoesntLikeOrDislikePokeblocks", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "MossdeepCity_House1_EventScript_Woman": [
      { cmd: "msgbox", args: ["MossdeepCity_House1_Text_HusbandCanTellPokeblockMonLikes", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "MossdeepCity_House1_Text_HmmYourPokemon": "Hmm!\\nYour {STR_VAR_1}…",
    "MossdeepCity_House1_Text_ItLikesXPokeblocks": "It likes {STR_VAR_1}S,\\ndoesn't it?\\pNo, I'm positive of it! It definitely\\nlikes {STR_VAR_1}S!",
    "MossdeepCity_House1_Text_DoesntLikeOrDislikePokeblocks": "It doesn't appear to like or dislike\\nany {POKEBLOCK}S.",
    "MossdeepCity_House1_Text_HusbandCanTellPokeblockMonLikes": "My husband can tell what kind of\\n{POKEBLOCK}S a POKéMON likes at a glance.",
  },
};

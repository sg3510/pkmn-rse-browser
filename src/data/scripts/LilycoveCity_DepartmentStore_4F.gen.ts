// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
  },
  scripts: {
    "LilycoveCity_DepartmentStore_4F_EventScript_Gentleman": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_4F_Text_AttackOrDefenseTM", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_4F_EventScript_Woman": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_4F_Text_FiftyDifferentTMs", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_4F_EventScript_Youngster": [
      { cmd: "msgbox", args: ["LilycoveCity_DepartmentStore_4F_Text_PokemonOnlyHaveFourMoves", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_4F_EventScript_ClerkLeft": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["LilycoveCity_DepartmentStore_4F_Pokemart_AttackTMs"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_4F_Pokemart_AttackTMs": [
      { cmd: "pokemartlistend" },
    ],
    "LilycoveCity_DepartmentStore_4F_EventScript_ClerkRight": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "message", args: ["gText_HowMayIServeYou"] },
      { cmd: "waitmessage" },
      { cmd: "pokemart", args: ["LilycoveCity_DepartmentStore_4F_Pokemart_DefenseTMs"] },
      { cmd: "msgbox", args: ["gText_PleaseComeAgain", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "LilycoveCity_DepartmentStore_4F_Pokemart_DefenseTMs": [
      { cmd: "pokemartlistend" },
    ],
  },
  movements: {
  },
  text: {
    "LilycoveCity_DepartmentStore_4F_Text_AttackOrDefenseTM": "Hmm…\\pAn attacking move…\\nOr a defensive move…\\pIt's no easy matter to decide which TM\\nmoves should be taught to POKéMON…",
    "LilycoveCity_DepartmentStore_4F_Text_FiftyDifferentTMs": "There are so many different kinds of\\nTM moves.\\pA catalog I read said there are fifty\\ndifferent kinds.",
    "LilycoveCity_DepartmentStore_4F_Text_PokemonOnlyHaveFourMoves": "I'd like to get all the different TMs,\\nbut a POKéMON learns only four moves.",
  },
};

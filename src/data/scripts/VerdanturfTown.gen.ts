// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onTransition: "VerdanturfTown_OnTransition",
  },
  scripts: {
    "VerdanturfTown_OnTransition": [
      { cmd: "setflag", args: ["FLAG_VISITED_VERDANTURF_TOWN"] },
      { cmd: "setvar", args: ["VAR_CONTEST_HALL_STATE", 0] },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_Twin": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RUSTURF_TUNNEL_OPENED", "VerdanturfTown_EventScript_TwinTunnelOpen"] },
      { cmd: "msgbox", args: ["VerdanturfTown_Text_ManTryingToDigTunnel", "MSGBOX_DEFAULT"] },
      { cmd: "applymovement", args: ["LOCALID_VERDANTURF_TWIN", "Common_Movement_FaceOriginalDirection"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_TwinTunnelOpen": [
      { cmd: "msgbox", args: ["VerdanturfTown_Text_ManDugTunnelForLove", "MSGBOX_DEFAULT"] },
      { cmd: "applymovement", args: ["LOCALID_VERDANTURF_TWIN", "Common_Movement_FaceOriginalDirection"] },
      { cmd: "waitmovement", args: [0] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_Man": [
      { cmd: "msgbox", args: ["VerdanturfTown_Text_AirCleanHere", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_Camper": [
      { cmd: "msgbox", args: ["VerdanturfTown_Text_MakeBattleTentDebut", "MSGBOX_NPC"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_Boy": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "goto_if_set", args: ["FLAG_RUSTURF_TUNNEL_OPENED", "VerdanturfTown_EventScript_BoyTunnelOpen"] },
      { cmd: "msgbox", args: ["VerdanturfTown_Text_GuyTryingToBustThroughCave", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_BoyTunnelOpen": [
      { cmd: "msgbox", args: ["VerdanturfTown_Text_EasyToGetToRustboroNow", "MSGBOX_DEFAULT"] },
      { cmd: "release" },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_TownSign": [
      { cmd: "msgbox", args: ["VerdanturfTown_Text_TownSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_WandasHouseSign": [
      { cmd: "msgbox", args: ["VerdanturfTown_Text_WandasHouse", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_BattleTentSign": [
      { cmd: "msgbox", args: ["VerdanturfTown_Text_BattleTentSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
    "VerdanturfTown_EventScript_RusturfTunnelSign": [
      { cmd: "msgbox", args: ["VerdanturfTown_Text_RusturfTunnelSign", "MSGBOX_SIGN"] },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
    "VerdanturfTown_Text_ManTryingToDigTunnel": "My papa told me.\\pHe says this tunnel is full of\\ntimid POKéMON.\\pThey get all scared of loud noise and\\nmake a big uproar.\\pSo they had to stop the big tunnel\\nproject.\\pBut there's one man. He's trying to dig\\nthe tunnel by himself!",
    "VerdanturfTown_Text_ManDugTunnelForLove": "There was a man who dug a tunnel for\\na lady he loved.\\pI don't really get it, but hey!",
    "VerdanturfTown_Text_AirCleanHere": "The way the winds blow, volcanic ash\\nis never blown in this direction.\\pThe air is clean and delicious here.\\nLiving here should do wonders for even\\lfrail and sickly people.",
    "VerdanturfTown_Text_MakeBattleTentDebut": "My POKéMON and I, we've been riding\\na hot winning streak.\\pSo I decided to make my BATTLE TENT\\ndebut in this town.",
    "VerdanturfTown_Text_GuyTryingToBustThroughCave": "Did you see the cave next to the\\nPOKéMON MART?\\pThere's a guy in there who's trying to\\nbust up boulders so he can bust out\\lthrough to the other side.\\pIt'd be great if we could go through…\\nIt'll make it easy to visit RUSTBORO.",
    "VerdanturfTown_Text_EasyToGetToRustboroNow": "That cave next to the POKéMON MART\\nis now a tunnel to the other side.\\pIt's great--it's easy to go shop for\\nnew DEVON products in RUSTBORO now.",
    "VerdanturfTown_Text_TownSign": "VERDANTURF TOWN\\p“The windswept highlands with the\\nsweet fragrance of grass.”",
    "VerdanturfTown_Text_WandasHouse": "WANDA'S HOUSE",
    "VerdanturfTown_Text_BattleTentSign": "BATTLE TENT VERDANTURF SITE\\n“Feast Your Eyes on Battles!”",
    "VerdanturfTown_Text_RusturfTunnelSign": "RUSTURF TUNNEL\\n“Linking RUSTBORO and VERDANTURF\\p“The tunnel project has been\\ncanceled.”",
  },
};

// Auto-generated from pokeemerald source. DO NOT EDIT.
// Regenerate with: npm run generate:scripts
import type { MapScriptData } from './types';

export const data: MapScriptData = {
  mapScripts: {
    onDive: "Underwater_SealedChamber_OnDive",
  },
  scripts: {
    "Underwater_SealedChamber_OnDive": [
      { cmd: "getplayerxy", args: ["VAR_0x8004", "VAR_0x8005"] },
      { cmd: "goto_if_ne", args: ["VAR_0x8004", 12, "Underwater_SealedChamber_EventScript_SurfaceRoute134"] },
      { cmd: "goto_if_ne", args: ["VAR_0x8005", 44, "Underwater_SealedChamber_EventScript_SurfaceRoute134"] },
      { cmd: "goto", args: ["Underwater_SealedChamber_EventScript_SurfaceSealedChamber"] },
    ],
    "Underwater_SealedChamber_EventScript_SurfaceRoute134": [
      { cmd: "setdivewarp", args: ["MAP_ROUTE134", 60, 31] },
      { cmd: "end" },
    ],
    "Underwater_SealedChamber_EventScript_SurfaceSealedChamber": [
      { cmd: "setdivewarp", args: ["MAP_SEALED_CHAMBER_OUTER_ROOM", 10, 19] },
      { cmd: "end" },
    ],
    "Underwater_SealedChamber_EventScript_Braille": [
      { cmd: "lockall" },
      { cmd: "braillemsgbox", args: ["Underwater_SealedChamber_Braille_GoUpHere"] },
      { cmd: "releaseall" },
      { cmd: "end" },
    ],
  },
  movements: {
  },
  text: {
  },
};

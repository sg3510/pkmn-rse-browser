// Auto-generated — do not edit
// Source: public/pokeemerald/src/data/wild_encounters.json
// Regenerate: node scripts/generate-wild-encounters.cjs

export type WildEncounterType = 'land' | 'water' | 'rockSmash' | 'fishing';

export interface WildEncounterSlot {
  species: number;
  minLevel: number;
  maxLevel: number;
}

export interface WildEncounterTable {
  encounterRate: number;
  slots: WildEncounterSlot[];
}

export interface MapWildEncounterData {
  mapId: string;
  land?: WildEncounterTable;
  water?: WildEncounterTable;
  rockSmash?: WildEncounterTable;
  fishing?: WildEncounterTable;
}

export interface FishingSlotGroups {
  oldRod: number[];
  goodRod: number[];
  superRod: number[];
}

/** Slot-rate distributions (percent weights) from wild_encounters.json fields. */
export const WILD_ENCOUNTER_SLOT_RATES = {
  land: [
    20,
    20,
    10,
    10,
    10,
    10,
    5,
    5,
    4,
    4,
    1,
    1
  ],
  water: [
    60,
    30,
    5,
    4,
    1
  ],
  rockSmash: [
    60,
    30,
    5,
    4,
    1
  ],
  fishing: [
    70,
    30,
    60,
    20,
    20,
    40,
    40,
    15,
    4,
    1
  ]
} as const;

/** Fishing rod to slot-index groups from wild_encounters.json fields. */
export const WILD_FISHING_SLOT_GROUPS: FishingSlotGroups = {
  oldRod: [
    0,
    1
  ],
  goodRod: [
    2,
    3,
    4
  ],
  superRod: [
    5,
    6,
    7,
    8,
    9
  ]
};

/** Wild encounter tables indexed by map ID. */
export const MAP_WILD_ENCOUNTERS: Record<string, MapWildEncounterData> = {
  "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS": {
    mapId: "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 73,
          minLevel: 30,
          maxLevel: 35
        }
      ]
    },
    fishing: {
      encounterRate: 20,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 73,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 73,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 73,
          minLevel: 20,
          maxLevel: 25
        }
      ]
    }
  },
  "MAP_ABANDONED_SHIP_ROOMS_B1F": {
    mapId: "MAP_ABANDONED_SHIP_ROOMS_B1F",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 73,
          minLevel: 30,
          maxLevel: 35
        }
      ]
    },
    fishing: {
      encounterRate: 20,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 73,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 73,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 73,
          minLevel: 20,
          maxLevel: 25
        }
      ]
    }
  },
  "MAP_ALTERING_CAVE": {
    mapId: "MAP_ALTERING_CAVE",
    land: {
      encounterRate: 7,
      slots: [
        {
          species: 235,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 235,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 235,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 235,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 235,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 235,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 235,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 235,
          minLevel: 18,
          maxLevel: 18
        },
        {
          species: 235,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 235,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 235,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 235,
          minLevel: 26,
          maxLevel: 26
        }
      ]
    }
  },
  "MAP_ARTISAN_CAVE_1F": {
    mapId: "MAP_ARTISAN_CAVE_1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 235,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 235,
          minLevel: 41,
          maxLevel: 41
        },
        {
          species: 235,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 235,
          minLevel: 43,
          maxLevel: 43
        },
        {
          species: 235,
          minLevel: 44,
          maxLevel: 44
        },
        {
          species: 235,
          minLevel: 45,
          maxLevel: 45
        },
        {
          species: 235,
          minLevel: 46,
          maxLevel: 46
        },
        {
          species: 235,
          minLevel: 47,
          maxLevel: 47
        },
        {
          species: 235,
          minLevel: 48,
          maxLevel: 48
        },
        {
          species: 235,
          minLevel: 49,
          maxLevel: 49
        },
        {
          species: 235,
          minLevel: 50,
          maxLevel: 50
        },
        {
          species: 235,
          minLevel: 50,
          maxLevel: 50
        }
      ]
    }
  },
  "MAP_ARTISAN_CAVE_B1F": {
    mapId: "MAP_ARTISAN_CAVE_B1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 235,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 235,
          minLevel: 41,
          maxLevel: 41
        },
        {
          species: 235,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 235,
          minLevel: 43,
          maxLevel: 43
        },
        {
          species: 235,
          minLevel: 44,
          maxLevel: 44
        },
        {
          species: 235,
          minLevel: 45,
          maxLevel: 45
        },
        {
          species: 235,
          minLevel: 46,
          maxLevel: 46
        },
        {
          species: 235,
          minLevel: 47,
          maxLevel: 47
        },
        {
          species: 235,
          minLevel: 48,
          maxLevel: 48
        },
        {
          species: 235,
          minLevel: 49,
          maxLevel: 49
        },
        {
          species: 235,
          minLevel: 50,
          maxLevel: 50
        },
        {
          species: 235,
          minLevel: 50,
          maxLevel: 50
        }
      ]
    }
  },
  "MAP_CAVE_OF_ORIGIN_1F": {
    mapId: "MAP_CAVE_OF_ORIGIN_1F",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 322,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 322,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 322,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_CAVE_OF_ORIGIN_ENTRANCE": {
    mapId: "MAP_CAVE_OF_ORIGIN_ENTRANCE",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_CAVE_OF_ORIGIN_UNUSED_RUBY_SAPPHIRE_MAP1": {
    mapId: "MAP_CAVE_OF_ORIGIN_UNUSED_RUBY_SAPPHIRE_MAP1",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 322,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 322,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 322,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_CAVE_OF_ORIGIN_UNUSED_RUBY_SAPPHIRE_MAP2": {
    mapId: "MAP_CAVE_OF_ORIGIN_UNUSED_RUBY_SAPPHIRE_MAP2",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 322,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 322,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 322,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_CAVE_OF_ORIGIN_UNUSED_RUBY_SAPPHIRE_MAP3": {
    mapId: "MAP_CAVE_OF_ORIGIN_UNUSED_RUBY_SAPPHIRE_MAP3",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 322,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 322,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 322,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_DESERT_UNDERPASS": {
    mapId: "MAP_DESERT_UNDERPASS",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 132,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 370,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 132,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 371,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 132,
          minLevel: 41,
          maxLevel: 41
        },
        {
          species: 370,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 371,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 132,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 370,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 132,
          minLevel: 43,
          maxLevel: 43
        },
        {
          species: 371,
          minLevel: 44,
          maxLevel: 44
        },
        {
          species: 132,
          minLevel: 45,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_DEWFORD_TOWN": {
    mapId: "MAP_DEWFORD_TOWN",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_EVER_GRANDE_CITY": {
    mapId: "MAP_EVER_GRANDE_CITY",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 325,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 325,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 222,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_FIERY_PATH": {
    mapId: "MAP_FIERY_PATH",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 339,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 109,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 339,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 66,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 321,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 218,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 109,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 66,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 321,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 321,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 88,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 88,
          minLevel: 14,
          maxLevel: 14
        }
      ]
    }
  },
  "MAP_GRANITE_CAVE_1F": {
    mapId: "MAP_GRANITE_CAVE_1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 335,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 335,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 41,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 335,
          minLevel: 9,
          maxLevel: 9
        },
        {
          species: 63,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 335,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 335,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 74,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 74,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 74,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 74,
          minLevel: 9,
          maxLevel: 9
        }
      ]
    }
  },
  "MAP_GRANITE_CAVE_B1F": {
    mapId: "MAP_GRANITE_CAVE_B1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 9,
          maxLevel: 9
        },
        {
          species: 382,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 382,
          minLevel: 9,
          maxLevel: 9
        },
        {
          species: 382,
          minLevel: 11,
          maxLevel: 11
        },
        {
          species: 41,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 63,
          minLevel: 9,
          maxLevel: 9
        },
        {
          species: 335,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 335,
          minLevel: 11,
          maxLevel: 11
        },
        {
          species: 322,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 322,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 322,
          minLevel: 9,
          maxLevel: 9
        },
        {
          species: 322,
          minLevel: 11,
          maxLevel: 11
        }
      ]
    }
  },
  "MAP_GRANITE_CAVE_B2F": {
    mapId: "MAP_GRANITE_CAVE_B2F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 382,
          minLevel: 11,
          maxLevel: 11
        },
        {
          species: 382,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 41,
          minLevel: 11,
          maxLevel: 11
        },
        {
          species: 382,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 63,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 322,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 322,
          minLevel: 11,
          maxLevel: 11
        },
        {
          species: 322,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 322,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 322,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 322,
          minLevel: 10,
          maxLevel: 10
        }
      ]
    },
    rockSmash: {
      encounterRate: 20,
      slots: [
        {
          species: 74,
          minLevel: 10,
          maxLevel: 15
        },
        {
          species: 320,
          minLevel: 10,
          maxLevel: 20
        },
        {
          species: 74,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        }
      ]
    }
  },
  "MAP_GRANITE_CAVE_STEVENS_ROOM": {
    mapId: "MAP_GRANITE_CAVE_STEVENS_ROOM",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 335,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 335,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 41,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 335,
          minLevel: 9,
          maxLevel: 9
        },
        {
          species: 63,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 335,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 335,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 382,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 382,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 382,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 382,
          minLevel: 8,
          maxLevel: 8
        }
      ]
    }
  },
  "MAP_JAGGED_PASS": {
    mapId: "MAP_JAGGED_PASS",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 339,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 339,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 66,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 339,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 351,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 66,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 351,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 66,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 339,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 351,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 339,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 351,
          minLevel: 22,
          maxLevel: 22
        }
      ]
    }
  },
  "MAP_LILYCOVE_CITY": {
    mapId: "MAP_LILYCOVE_CITY",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 120,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_MAGMA_HIDEOUT_1F": {
    mapId: "MAP_MAGMA_HIDEOUT_1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 74,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 321,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 74,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 321,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 75,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 75,
          minLevel: 33,
          maxLevel: 33
        }
      ]
    }
  },
  "MAP_MAGMA_HIDEOUT_2F_1R": {
    mapId: "MAP_MAGMA_HIDEOUT_2F_1R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 74,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 321,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 74,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 321,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 75,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 75,
          minLevel: 33,
          maxLevel: 33
        }
      ]
    }
  },
  "MAP_MAGMA_HIDEOUT_2F_2R": {
    mapId: "MAP_MAGMA_HIDEOUT_2F_2R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 74,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 321,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 74,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 321,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 75,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 75,
          minLevel: 33,
          maxLevel: 33
        }
      ]
    }
  },
  "MAP_MAGMA_HIDEOUT_2F_3R": {
    mapId: "MAP_MAGMA_HIDEOUT_2F_3R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 74,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 321,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 74,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 321,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 75,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 75,
          minLevel: 33,
          maxLevel: 33
        }
      ]
    }
  },
  "MAP_MAGMA_HIDEOUT_3F_1R": {
    mapId: "MAP_MAGMA_HIDEOUT_3F_1R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 74,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 321,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 74,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 321,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 75,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 75,
          minLevel: 33,
          maxLevel: 33
        }
      ]
    }
  },
  "MAP_MAGMA_HIDEOUT_3F_2R": {
    mapId: "MAP_MAGMA_HIDEOUT_3F_2R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 74,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 321,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 74,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 321,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 75,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 75,
          minLevel: 33,
          maxLevel: 33
        }
      ]
    }
  },
  "MAP_MAGMA_HIDEOUT_3F_3R": {
    mapId: "MAP_MAGMA_HIDEOUT_3F_3R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 74,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 321,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 74,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 321,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 75,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 75,
          minLevel: 33,
          maxLevel: 33
        }
      ]
    }
  },
  "MAP_MAGMA_HIDEOUT_4F": {
    mapId: "MAP_MAGMA_HIDEOUT_4F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 74,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 321,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 74,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 321,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 75,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 75,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 75,
          minLevel: 33,
          maxLevel: 33
        }
      ]
    }
  },
  "MAP_METEOR_FALLS_1F_1R": {
    mapId: "MAP_METEOR_FALLS_1F_1R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 41,
          minLevel: 17,
          maxLevel: 17
        },
        {
          species: 41,
          minLevel: 18,
          maxLevel: 18
        },
        {
          species: 41,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 41,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 349,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 349,
          minLevel: 18,
          maxLevel: 18
        },
        {
          species: 349,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 41,
          minLevel: 19,
          maxLevel: 19
        },
        {
          species: 41,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 41,
          minLevel: 19,
          maxLevel: 19
        },
        {
          species: 41,
          minLevel: 20,
          maxLevel: 20
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 25,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 349,
          minLevel: 5,
          maxLevel: 15
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 323,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 323,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 323,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_METEOR_FALLS_1F_2R": {
    mapId: "MAP_METEOR_FALLS_1F_2R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 349,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 349,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 39,
          maxLevel: 39
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 25,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 349,
          minLevel: 5,
          maxLevel: 15
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 324,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 324,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 324,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_METEOR_FALLS_B1F_1R": {
    mapId: "MAP_METEOR_FALLS_B1F_1R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 349,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 349,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 39,
          maxLevel: 39
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 25,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 349,
          minLevel: 5,
          maxLevel: 15
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 324,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 324,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 324,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_METEOR_FALLS_B1F_2R": {
    mapId: "MAP_METEOR_FALLS_B1F_2R",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 395,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 349,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 395,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 395,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 349,
          minLevel: 39,
          maxLevel: 39
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 25,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 349,
          minLevel: 5,
          maxLevel: 15
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 324,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 324,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 324,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_METEOR_FALLS_STEVENS_CAVE": {
    mapId: "MAP_METEOR_FALLS_STEVENS_CAVE",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 349,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 349,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 349,
          minLevel: 39,
          maxLevel: 39
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        }
      ]
    }
  },
  "MAP_MIRAGE_TOWER_1F": {
    mapId: "MAP_MIRAGE_TOWER_1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 27,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 332,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 332,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 27,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 332,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 27,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 332,
          minLevel: 24,
          maxLevel: 24
        }
      ]
    }
  },
  "MAP_MIRAGE_TOWER_2F": {
    mapId: "MAP_MIRAGE_TOWER_2F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 27,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 332,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 332,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 27,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 332,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 27,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 332,
          minLevel: 24,
          maxLevel: 24
        }
      ]
    }
  },
  "MAP_MIRAGE_TOWER_3F": {
    mapId: "MAP_MIRAGE_TOWER_3F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 27,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 332,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 332,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 27,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 332,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 27,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 332,
          minLevel: 24,
          maxLevel: 24
        }
      ]
    }
  },
  "MAP_MIRAGE_TOWER_4F": {
    mapId: "MAP_MIRAGE_TOWER_4F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 27,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 332,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 332,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 27,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 332,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 27,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 332,
          minLevel: 24,
          maxLevel: 24
        }
      ]
    }
  },
  "MAP_MOSSDEEP_CITY": {
    mapId: "MAP_MOSSDEEP_CITY",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_MT_PYRE_1F": {
    mapId: "MAP_MT_PYRE_1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 377,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        }
      ]
    }
  },
  "MAP_MT_PYRE_2F": {
    mapId: "MAP_MT_PYRE_2F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 377,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        }
      ]
    }
  },
  "MAP_MT_PYRE_3F": {
    mapId: "MAP_MT_PYRE_3F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 377,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        }
      ]
    }
  },
  "MAP_MT_PYRE_4F": {
    mapId: "MAP_MT_PYRE_4F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 377,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 361,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 361,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 361,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 361,
          minLevel: 29,
          maxLevel: 29
        }
      ]
    }
  },
  "MAP_MT_PYRE_5F": {
    mapId: "MAP_MT_PYRE_5F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 377,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 361,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 361,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 361,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 361,
          minLevel: 29,
          maxLevel: 29
        }
      ]
    }
  },
  "MAP_MT_PYRE_6F": {
    mapId: "MAP_MT_PYRE_6F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 377,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 377,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 361,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 361,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 361,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 361,
          minLevel: 29,
          maxLevel: 29
        }
      ]
    }
  },
  "MAP_MT_PYRE_EXTERIOR": {
    mapId: "MAP_MT_PYRE_EXTERIOR",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 37,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 37,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 37,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 37,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 309,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 309,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 309,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 309,
          minLevel: 28,
          maxLevel: 28
        }
      ]
    }
  },
  "MAP_MT_PYRE_SUMMIT": {
    mapId: "MAP_MT_PYRE_SUMMIT",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 377,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 377,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 377,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 377,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 361,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 361,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 361,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 411,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 411,
          minLevel: 28,
          maxLevel: 28
        }
      ]
    }
  },
  "MAP_NEW_MAUVILLE_ENTRANCE": {
    mapId: "MAP_NEW_MAUVILLE_ENTRANCE",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 100,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 81,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 100,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 81,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 100,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 81,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 100,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 81,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 100,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 81,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 100,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 81,
          minLevel: 22,
          maxLevel: 22
        }
      ]
    }
  },
  "MAP_NEW_MAUVILLE_INSIDE": {
    mapId: "MAP_NEW_MAUVILLE_INSIDE",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 100,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 81,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 100,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 81,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 100,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 81,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 100,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 81,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 100,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 81,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 101,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 82,
          minLevel: 26,
          maxLevel: 26
        }
      ]
    }
  },
  "MAP_PACIFIDLOG_TOWN": {
    mapId: "MAP_PACIFIDLOG_TOWN",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_PETALBURG_CITY": {
    mapId: "MAP_PETALBURG_CITY",
    water: {
      encounterRate: 1,
      slots: [
        {
          species: 183,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 10,
          maxLevel: 20
        },
        {
          species: 183,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 183,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 183,
          minLevel: 5,
          maxLevel: 10
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 326,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 326,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 326,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_PETALBURG_WOODS": {
    mapId: "MAP_PETALBURG_WOODS",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 290,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 306,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 286,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 291,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 293,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 290,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 306,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 304,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 364,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 304,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 364,
          minLevel: 6,
          maxLevel: 6
        }
      ]
    }
  },
  "MAP_ROUTE101": {
    mapId: "MAP_ROUTE101",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 290,
          minLevel: 2,
          maxLevel: 2
        },
        {
          species: 286,
          minLevel: 2,
          maxLevel: 2
        },
        {
          species: 290,
          minLevel: 2,
          maxLevel: 2
        },
        {
          species: 290,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 286,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 286,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 290,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 286,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 288,
          minLevel: 2,
          maxLevel: 2
        },
        {
          species: 288,
          minLevel: 2,
          maxLevel: 2
        },
        {
          species: 288,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 288,
          minLevel: 3,
          maxLevel: 3
        }
      ]
    }
  },
  "MAP_ROUTE102": {
    mapId: "MAP_ROUTE102",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 290,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 286,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 290,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 295,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 295,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 288,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 288,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 288,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 392,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 288,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 298,
          minLevel: 3,
          maxLevel: 3
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 183,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 10,
          maxLevel: 20
        },
        {
          species: 183,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 183,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 20,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 326,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 326,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 326,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE103": {
    mapId: "MAP_ROUTE103",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 2,
          maxLevel: 2
        },
        {
          species: 286,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 286,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 286,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 309,
          minLevel: 2,
          maxLevel: 2
        },
        {
          species: 288,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 288,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 288,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 309,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 309,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 309,
          minLevel: 2,
          maxLevel: 2
        },
        {
          species: 309,
          minLevel: 4,
          maxLevel: 4
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE104": {
    mapId: "MAP_ROUTE104",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 290,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 286,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 183,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 183,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 286,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 304,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 304,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 309,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 309,
          minLevel: 4,
          maxLevel: 4
        },
        {
          species: 309,
          minLevel: 3,
          maxLevel: 3
        },
        {
          species: 309,
          minLevel: 5,
          maxLevel: 5
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 129,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 129,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 129,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE105": {
    mapId: "MAP_ROUTE105",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE106": {
    mapId: "MAP_ROUTE106",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE107": {
    mapId: "MAP_ROUTE107",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE108": {
    mapId: "MAP_ROUTE108",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE109": {
    mapId: "MAP_ROUTE109",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE110": {
    mapId: "MAP_ROUTE110",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 337,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 367,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 337,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 354,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 43,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 354,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 367,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 309,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 309,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 353,
          minLevel: 12,
          maxLevel: 12
        },
        {
          species: 353,
          minLevel: 13,
          maxLevel: 13
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE111": {
    mapId: "MAP_ROUTE111",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 27,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 332,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 27,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 332,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 318,
          minLevel: 19,
          maxLevel: 19
        },
        {
          species: 318,
          minLevel: 21,
          maxLevel: 21
        },
        {
          species: 27,
          minLevel: 19,
          maxLevel: 19
        },
        {
          species: 332,
          minLevel: 19,
          maxLevel: 19
        },
        {
          species: 318,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 344,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 344,
          minLevel: 22,
          maxLevel: 22
        },
        {
          species: 344,
          minLevel: 22,
          maxLevel: 22
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 183,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 10,
          maxLevel: 20
        },
        {
          species: 183,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 183,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 20,
          maxLevel: 30
        }
      ]
    },
    rockSmash: {
      encounterRate: 20,
      slots: [
        {
          species: 74,
          minLevel: 10,
          maxLevel: 15
        },
        {
          species: 74,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 323,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 323,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 323,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE112": {
    mapId: "MAP_ROUTE112",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 339,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 339,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 183,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 339,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 339,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 183,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 339,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 183,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 339,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 339,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 339,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 339,
          minLevel: 16,
          maxLevel: 16
        }
      ]
    }
  },
  "MAP_ROUTE113": {
    mapId: "MAP_ROUTE113",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 308,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 308,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 218,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 308,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 308,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 218,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 308,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 218,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 308,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 227,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 308,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 227,
          minLevel: 16,
          maxLevel: 16
        }
      ]
    }
  },
  "MAP_ROUTE114": {
    mapId: "MAP_ROUTE114",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 358,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 295,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 358,
          minLevel: 17,
          maxLevel: 17
        },
        {
          species: 358,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 295,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 296,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 296,
          minLevel: 16,
          maxLevel: 16
        },
        {
          species: 296,
          minLevel: 18,
          maxLevel: 18
        },
        {
          species: 379,
          minLevel: 17,
          maxLevel: 17
        },
        {
          species: 379,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 379,
          minLevel: 17,
          maxLevel: 17
        },
        {
          species: 299,
          minLevel: 15,
          maxLevel: 15
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 183,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 10,
          maxLevel: 20
        },
        {
          species: 183,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 183,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 20,
          maxLevel: 30
        }
      ]
    },
    rockSmash: {
      encounterRate: 20,
      slots: [
        {
          species: 74,
          minLevel: 10,
          maxLevel: 15
        },
        {
          species: 74,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 323,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 323,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 323,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE115": {
    mapId: "MAP_ROUTE115",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 358,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 304,
          minLevel: 23,
          maxLevel: 23
        },
        {
          species: 358,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 304,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 304,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 305,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 39,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 39,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 309,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 309,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 309,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 309,
          minLevel: 25,
          maxLevel: 25
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE116": {
    mapId: "MAP_ROUTE116",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 370,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 301,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 63,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 301,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 304,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 304,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 304,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 286,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 286,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 315,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 315,
          minLevel: 8,
          maxLevel: 8
        }
      ]
    }
  },
  "MAP_ROUTE117": {
    mapId: "MAP_ROUTE117",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 43,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 286,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 43,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 183,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 43,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 387,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 387,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 387,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 387,
          minLevel: 14,
          maxLevel: 14
        },
        {
          species: 386,
          minLevel: 13,
          maxLevel: 13
        },
        {
          species: 298,
          minLevel: 13,
          maxLevel: 13
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 183,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 10,
          maxLevel: 20
        },
        {
          species: 183,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 183,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 20,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 326,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 326,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 326,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 326,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE118": {
    mapId: "MAP_ROUTE118",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 288,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 337,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 288,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 337,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 289,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 338,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 309,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 309,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 309,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 309,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 309,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 317,
          minLevel: 25,
          maxLevel: 25
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 330,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 330,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 330,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 330,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 330,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE119": {
    mapId: "MAP_ROUTE119",
    land: {
      encounterRate: 15,
      slots: [
        {
          species: 288,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 289,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 288,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 43,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 289,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 43,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 43,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 43,
          minLevel: 24,
          maxLevel: 24
        },
        {
          species: 369,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 369,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 369,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 317,
          minLevel: 25,
          maxLevel: 25
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 330,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 330,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 330,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 330,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 330,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 330,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE120": {
    mapId: "MAP_ROUTE120",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 287,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 287,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 43,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 183,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 43,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 43,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 183,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 376,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 376,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 317,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 298,
          minLevel: 25,
          maxLevel: 25
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 183,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 10,
          maxLevel: 20
        },
        {
          species: 183,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 183,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 20,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 323,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 323,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 323,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE121": {
    mapId: "MAP_ROUTE121",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 287,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 287,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 43,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 43,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 44,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 309,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 309,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 309,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 317,
          minLevel: 25,
          maxLevel: 25
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE122": {
    mapId: "MAP_ROUTE122",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE123": {
    mapId: "MAP_ROUTE123",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 286,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 287,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 377,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 287,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 43,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 43,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 44,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 309,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 309,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 309,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 317,
          minLevel: 25,
          maxLevel: 25
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE124": {
    mapId: "MAP_ROUTE124",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE125": {
    mapId: "MAP_ROUTE125",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE126": {
    mapId: "MAP_ROUTE126",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE127": {
    mapId: "MAP_ROUTE127",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE128": {
    mapId: "MAP_ROUTE128",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 325,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 325,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 222,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE129": {
    mapId: "MAP_ROUTE129",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 314,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE130": {
    mapId: "MAP_ROUTE130",
    land: {
      encounterRate: 20,
      slots: [
        {
          species: 360,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 360,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 360,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 360,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 360,
          minLevel: 20,
          maxLevel: 20
        },
        {
          species: 360,
          minLevel: 45,
          maxLevel: 45
        },
        {
          species: 360,
          minLevel: 15,
          maxLevel: 15
        },
        {
          species: 360,
          minLevel: 50,
          maxLevel: 50
        },
        {
          species: 360,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 360,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 360,
          minLevel: 10,
          maxLevel: 10
        },
        {
          species: 360,
          minLevel: 5,
          maxLevel: 5
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE131": {
    mapId: "MAP_ROUTE131",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE132": {
    mapId: "MAP_ROUTE132",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 116,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE133": {
    mapId: "MAP_ROUTE133",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 116,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_ROUTE134": {
    mapId: "MAP_ROUTE134",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 331,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 116,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_RUSTURF_TUNNEL": {
    mapId: "MAP_RUSTURF_TUNNEL",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 370,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 370,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 370,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 370,
          minLevel: 6,
          maxLevel: 6
        },
        {
          species: 370,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 370,
          minLevel: 7,
          maxLevel: 7
        },
        {
          species: 370,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 370,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 370,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 370,
          minLevel: 8,
          maxLevel: 8
        },
        {
          species: 370,
          minLevel: 5,
          maxLevel: 5
        },
        {
          species: 370,
          minLevel: 8,
          maxLevel: 8
        }
      ]
    }
  },
  "MAP_SAFARI_ZONE_NORTH": {
    mapId: "MAP_SAFARI_ZONE_NORTH",
    land: {
      encounterRate: 25,
      slots: [
        {
          species: 231,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 43,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 231,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 43,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 177,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 44,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 44,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 177,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 178,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 214,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 178,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 214,
          minLevel: 29,
          maxLevel: 29
        }
      ]
    },
    rockSmash: {
      encounterRate: 25,
      slots: [
        {
          species: 74,
          minLevel: 10,
          maxLevel: 15
        },
        {
          species: 74,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 74,
          minLevel: 15,
          maxLevel: 20
        },
        {
          species: 74,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 74,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    }
  },
  "MAP_SAFARI_ZONE_NORTHEAST": {
    mapId: "MAP_SAFARI_ZONE_NORTHEAST",
    land: {
      encounterRate: 25,
      slots: [
        {
          species: 190,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 216,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 190,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 216,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 191,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 165,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 163,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 204,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 228,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 241,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 228,
          minLevel: 39,
          maxLevel: 39
        },
        {
          species: 241,
          minLevel: 40,
          maxLevel: 40
        }
      ]
    },
    rockSmash: {
      encounterRate: 25,
      slots: [
        {
          species: 213,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 213,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 213,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 213,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 213,
          minLevel: 35,
          maxLevel: 40
        }
      ]
    }
  },
  "MAP_SAFARI_ZONE_NORTHWEST": {
    mapId: "MAP_SAFARI_ZONE_NORTHWEST",
    land: {
      encounterRate: 25,
      slots: [
        {
          species: 111,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 43,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 111,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 43,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 84,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 44,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 44,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 84,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 85,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 127,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 85,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 127,
          minLevel: 29,
          maxLevel: 29
        }
      ]
    },
    water: {
      encounterRate: 9,
      slots: [
        {
          species: 54,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 54,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 54,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 55,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 55,
          minLevel: 25,
          maxLevel: 40
        }
      ]
    },
    fishing: {
      encounterRate: 35,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 25
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 119,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 119,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 119,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    }
  },
  "MAP_SAFARI_ZONE_SOUTH": {
    mapId: "MAP_SAFARI_ZONE_SOUTH",
    land: {
      encounterRate: 25,
      slots: [
        {
          species: 43,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 43,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 203,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 203,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 177,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 84,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 44,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 202,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 25,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 202,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 25,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 202,
          minLevel: 29,
          maxLevel: 29
        }
      ]
    }
  },
  "MAP_SAFARI_ZONE_SOUTHEAST": {
    mapId: "MAP_SAFARI_ZONE_SOUTHEAST",
    land: {
      encounterRate: 25,
      slots: [
        {
          species: 191,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 179,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 191,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 179,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 190,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 167,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 163,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 209,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 234,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 207,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 234,
          minLevel: 39,
          maxLevel: 39
        },
        {
          species: 207,
          minLevel: 40,
          maxLevel: 40
        }
      ]
    },
    water: {
      encounterRate: 9,
      slots: [
        {
          species: 194,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 183,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 195,
          minLevel: 35,
          maxLevel: 40
        }
      ]
    },
    fishing: {
      encounterRate: 35,
      slots: [
        {
          species: 129,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 223,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 118,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 223,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 223,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 223,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 224,
          minLevel: 35,
          maxLevel: 40
        }
      ]
    }
  },
  "MAP_SAFARI_ZONE_SOUTHWEST": {
    mapId: "MAP_SAFARI_ZONE_SOUTHWEST",
    land: {
      encounterRate: 25,
      slots: [
        {
          species: 43,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 43,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 203,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 203,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 177,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 84,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 44,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 202,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 25,
          minLevel: 25,
          maxLevel: 25
        },
        {
          species: 202,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 25,
          minLevel: 27,
          maxLevel: 27
        },
        {
          species: 202,
          minLevel: 29,
          maxLevel: 29
        }
      ]
    },
    water: {
      encounterRate: 9,
      slots: [
        {
          species: 54,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 54,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 54,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 54,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 54,
          minLevel: 30,
          maxLevel: 35
        }
      ]
    },
    fishing: {
      encounterRate: 35,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 25
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 119,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 119,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 119,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ENTRANCE": {
    mapId: "MAP_SEAFLOOR_CAVERN_ENTRANCE",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ROOM1": {
    mapId: "MAP_SEAFLOOR_CAVERN_ROOM1",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ROOM2": {
    mapId: "MAP_SEAFLOOR_CAVERN_ROOM2",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ROOM3": {
    mapId: "MAP_SEAFLOOR_CAVERN_ROOM3",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ROOM4": {
    mapId: "MAP_SEAFLOOR_CAVERN_ROOM4",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ROOM5": {
    mapId: "MAP_SEAFLOOR_CAVERN_ROOM5",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ROOM6": {
    mapId: "MAP_SEAFLOOR_CAVERN_ROOM6",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ROOM7": {
    mapId: "MAP_SEAFLOOR_CAVERN_ROOM7",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_SEAFLOOR_CAVERN_ROOM8": {
    mapId: "MAP_SEAFLOOR_CAVERN_ROOM8",
    land: {
      encounterRate: 4,
      slots: [
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 31,
          maxLevel: 31
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 41,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 29,
          maxLevel: 29
        },
        {
          species: 41,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 41,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_SHOAL_CAVE_LOW_TIDE_ENTRANCE_ROOM": {
    mapId: "MAP_SHOAL_CAVE_LOW_TIDE_ENTRANCE_ROOM",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 341,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 341,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 341,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 25,
          maxLevel: 35
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_SHOAL_CAVE_LOW_TIDE_ICE_ROOM": {
    mapId: "MAP_SHOAL_CAVE_LOW_TIDE_ICE_ROOM",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 341,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 341,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 346,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 346,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 346,
          minLevel: 30,
          maxLevel: 30
        }
      ]
    }
  },
  "MAP_SHOAL_CAVE_LOW_TIDE_INNER_ROOM": {
    mapId: "MAP_SHOAL_CAVE_LOW_TIDE_INNER_ROOM",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 341,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 341,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 41,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 341,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 25,
          maxLevel: 35
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_SHOAL_CAVE_LOW_TIDE_LOWER_ROOM": {
    mapId: "MAP_SHOAL_CAVE_LOW_TIDE_LOWER_ROOM",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 341,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 341,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        }
      ]
    }
  },
  "MAP_SHOAL_CAVE_LOW_TIDE_STAIRS_ROOM": {
    mapId: "MAP_SHOAL_CAVE_LOW_TIDE_STAIRS_ROOM",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 41,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 341,
          minLevel: 26,
          maxLevel: 26
        },
        {
          species: 41,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 341,
          minLevel: 28,
          maxLevel: 28
        },
        {
          species: 41,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 341,
          minLevel: 30,
          maxLevel: 30
        },
        {
          species: 41,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 42,
          minLevel: 32,
          maxLevel: 32
        },
        {
          species: 341,
          minLevel: 32,
          maxLevel: 32
        }
      ]
    }
  },
  "MAP_SKY_PILLAR_1F": {
    mapId: "MAP_SKY_PILLAR_1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 322,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 322,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 319,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 378,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 378,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 319,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 319,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 319,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 319,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 319,
          minLevel: 38,
          maxLevel: 38
        }
      ]
    }
  },
  "MAP_SKY_PILLAR_3F": {
    mapId: "MAP_SKY_PILLAR_3F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 322,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 322,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 319,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 378,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 378,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 319,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 319,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 319,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 319,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 319,
          minLevel: 38,
          maxLevel: 38
        }
      ]
    }
  },
  "MAP_SKY_PILLAR_5F": {
    mapId: "MAP_SKY_PILLAR_5F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 322,
          minLevel: 33,
          maxLevel: 33
        },
        {
          species: 42,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 35
        },
        {
          species: 322,
          minLevel: 34,
          maxLevel: 34
        },
        {
          species: 319,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 378,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 378,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 319,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 319,
          minLevel: 37,
          maxLevel: 37
        },
        {
          species: 359,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 359,
          minLevel: 39,
          maxLevel: 39
        },
        {
          species: 359,
          minLevel: 39,
          maxLevel: 39
        }
      ]
    }
  },
  "MAP_SLATEPORT_CITY": {
    mapId: "MAP_SLATEPORT_CITY",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 72,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 309,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 309,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 310,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 72,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 313,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 313,
          minLevel: 20,
          maxLevel: 25
        },
        {
          species: 313,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 313,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_SOOTOPOLIS_CITY": {
    mapId: "MAP_SOOTOPOLIS_CITY",
    water: {
      encounterRate: 1,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 35
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 15,
          maxLevel: 25
        },
        {
          species: 129,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 25,
          maxLevel: 30
        }
      ]
    },
    fishing: {
      encounterRate: 10,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 72,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 129,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 129,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 130,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 130,
          minLevel: 35,
          maxLevel: 45
        },
        {
          species: 130,
          minLevel: 5,
          maxLevel: 45
        }
      ]
    }
  },
  "MAP_UNDERWATER_ROUTE124": {
    mapId: "MAP_UNDERWATER_ROUTE124",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 373,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 170,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 373,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 381,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 381,
          minLevel: 30,
          maxLevel: 35
        }
      ]
    }
  },
  "MAP_UNDERWATER_ROUTE126": {
    mapId: "MAP_UNDERWATER_ROUTE126",
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 373,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 170,
          minLevel: 20,
          maxLevel: 30
        },
        {
          species: 373,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 381,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 381,
          minLevel: 30,
          maxLevel: 35
        }
      ]
    }
  },
  "MAP_VICTORY_ROAD_1F": {
    mapId: "MAP_VICTORY_ROAD_1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 336,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 383,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 371,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 41,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 335,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 336,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 382,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 370,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 382,
          minLevel: 36,
          maxLevel: 36
        },
        {
          species: 370,
          minLevel: 36,
          maxLevel: 36
        }
      ]
    }
  },
  "MAP_VICTORY_ROAD_B1F": {
    mapId: "MAP_VICTORY_ROAD_B1F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 336,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 383,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 383,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 42,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 336,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 42,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 336,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 383,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 355,
          minLevel: 38,
          maxLevel: 38
        },
        {
          species: 383,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 355,
          minLevel: 38,
          maxLevel: 38
        }
      ]
    },
    rockSmash: {
      encounterRate: 20,
      slots: [
        {
          species: 75,
          minLevel: 30,
          maxLevel: 40
        },
        {
          species: 74,
          minLevel: 30,
          maxLevel: 40
        },
        {
          species: 75,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 75,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 75,
          minLevel: 35,
          maxLevel: 40
        }
      ]
    }
  },
  "MAP_VICTORY_ROAD_B2F": {
    mapId: "MAP_VICTORY_ROAD_B2F",
    land: {
      encounterRate: 10,
      slots: [
        {
          species: 42,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 322,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 383,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 383,
          minLevel: 40,
          maxLevel: 40
        },
        {
          species: 42,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 322,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 42,
          minLevel: 44,
          maxLevel: 44
        },
        {
          species: 322,
          minLevel: 44,
          maxLevel: 44
        },
        {
          species: 383,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 355,
          minLevel: 42,
          maxLevel: 42
        },
        {
          species: 383,
          minLevel: 44,
          maxLevel: 44
        },
        {
          species: 355,
          minLevel: 44,
          maxLevel: 44
        }
      ]
    },
    water: {
      encounterRate: 4,
      slots: [
        {
          species: 42,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 42,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 42,
          minLevel: 35,
          maxLevel: 40
        }
      ]
    },
    fishing: {
      encounterRate: 30,
      slots: [
        {
          species: 129,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 118,
          minLevel: 5,
          maxLevel: 10
        },
        {
          species: 129,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 118,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 10,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 25,
          maxLevel: 30
        },
        {
          species: 323,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 324,
          minLevel: 30,
          maxLevel: 35
        },
        {
          species: 324,
          minLevel: 35,
          maxLevel: 40
        },
        {
          species: 324,
          minLevel: 40,
          maxLevel: 45
        }
      ]
    }
  },
};

export function getMapWildEncounterData(mapId: string): MapWildEncounterData | undefined {
  return MAP_WILD_ENCOUNTERS[mapId];
}

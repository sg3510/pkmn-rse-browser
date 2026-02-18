// Auto-generated from pokeemerald C data. DO NOT EDIT.
// Source refs:
// - public/pokeemerald/src/data/battle_frontier/trainer_hill.h
// - public/pokeemerald/src/battle_tower.c

export interface TrainerHillTrainerData {
  name: string;
  facilityClass: string;
  graphicsId: string;
}

export interface TrainerHillFloorData {
  trainerNums: [number, number];
  trainers: [TrainerHillTrainerData, TrainerHillTrainerData];
  map: {
    trainerCoords: [[number, number], [number, number]];
    trainerDirections: [string, string];
    trainerRanges: [number, number];
  };
}

export interface TrainerHillModeData {
  name: string;
  numTrainers: number;
  numFloors: number;
  floors: TrainerHillFloorData[];
}

export const TRAINER_HILL_MODES: Record<number, TrainerHillModeData> = {
  "0": {
    "name": "Normal",
    "numTrainers": 8,
    "numFloors": 4,
    "floors": [
      {
        "trainerNums": [
          17,
          18
        ],
        "trainers": [
          {
            "name": "ALAINA",
            "facilityClass": "FACILITY_CLASS_HEX_MANIAC",
            "graphicsId": "OBJ_EVENT_GFX_HEX_MANIAC"
          },
          {
            "name": "ALFONSO",
            "facilityClass": "FACILITY_CLASS_CYCLING_TRIATHLETE_M",
            "graphicsId": "OBJ_EVENT_GFX_CYCLING_TRIATHLETE_M"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              11,
              1
            ],
            [
              13,
              2
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_NORTH"
          ],
          "trainerRanges": [
            2,
            1
          ]
        }
      },
      {
        "trainerNums": [
          19,
          20
        ],
        "trainers": [
          {
            "name": "THEODORE",
            "facilityClass": "FACILITY_CLASS_BLACK_BELT",
            "graphicsId": "OBJ_EVENT_GFX_BLACK_BELT"
          },
          {
            "name": "JAYDEN",
            "facilityClass": "FACILITY_CLASS_PKMN_BREEDER_F",
            "graphicsId": "OBJ_EVENT_GFX_WOMAN_2"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              4,
              11
            ],
            [
              9,
              14
            ]
          ],
          "trainerDirections": [
            "DIR_SOUTH",
            "DIR_EAST"
          ],
          "trainerRanges": [
            3,
            5
          ]
        }
      },
      {
        "trainerNums": [
          21,
          22
        ],
        "trainers": [
          {
            "name": "SALVADORE",
            "facilityClass": "FACILITY_CLASS_PKMN_BREEDER_M",
            "graphicsId": "OBJ_EVENT_GFX_MAN_4"
          },
          {
            "name": "VERONICA",
            "facilityClass": "FACILITY_CLASS_PKMN_BREEDER_F",
            "graphicsId": "OBJ_EVENT_GFX_WOMAN_2"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              5,
              2
            ],
            [
              9,
              2
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      },
      {
        "trainerNums": [
          23,
          24
        ],
        "trainers": [
          {
            "name": "KEENAN",
            "facilityClass": "FACILITY_CLASS_PSYCHIC_M",
            "graphicsId": "OBJ_EVENT_GFX_PSYCHIC_M"
          },
          {
            "name": "KRISTINA",
            "facilityClass": "FACILITY_CLASS_AROMA_LADY",
            "graphicsId": "OBJ_EVENT_GFX_WOMAN_2"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              7,
              4
            ],
            [
              7,
              10
            ]
          ],
          "trainerDirections": [
            "DIR_SOUTH",
            "DIR_NORTH"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      }
    ]
  },
  "1": {
    "name": "Variety",
    "numTrainers": 8,
    "numFloors": 4,
    "floors": [
      {
        "trainerNums": [
          41,
          42
        ],
        "trainers": [
          {
            "name": "TERRANCE",
            "facilityClass": "FACILITY_CLASS_GENTLEMAN",
            "graphicsId": "OBJ_EVENT_GFX_GENTLEMAN"
          },
          {
            "name": "ELIZABETH",
            "facilityClass": "FACILITY_CLASS_LADY",
            "graphicsId": "OBJ_EVENT_GFX_WOMAN_2"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              5,
              8
            ],
            [
              9,
              8
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      },
      {
        "trainerNums": [
          43,
          44
        ],
        "trainers": [
          {
            "name": "ANNABELL",
            "facilityClass": "FACILITY_CLASS_PARASOL_LADY",
            "graphicsId": "OBJ_EVENT_GFX_WOMAN_5"
          },
          {
            "name": "COLEMAN",
            "facilityClass": "FACILITY_CLASS_COLLECTOR",
            "graphicsId": "OBJ_EVENT_GFX_MANIAC"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              3,
              8
            ],
            [
              11,
              8
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            7,
            7
          ]
        }
      },
      {
        "trainerNums": [
          45,
          46
        ],
        "trainers": [
          {
            "name": "ENRIQUE",
            "facilityClass": "FACILITY_CLASS_RICH_BOY",
            "graphicsId": "OBJ_EVENT_GFX_RICH_BOY"
          },
          {
            "name": "COLLEEN",
            "facilityClass": "FACILITY_CLASS_LADY",
            "graphicsId": "OBJ_EVENT_GFX_WOMAN_2"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              9,
              1
            ],
            [
              14,
              1
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            4,
            4
          ]
        }
      },
      {
        "trainerNums": [
          47,
          48
        ],
        "trainers": [
          {
            "name": "KIMBERLY",
            "facilityClass": "FACILITY_CLASS_POKEFAN_F",
            "graphicsId": "OBJ_EVENT_GFX_POKEFAN_F"
          },
          {
            "name": "FRANCISCO",
            "facilityClass": "FACILITY_CLASS_POKEFAN_M",
            "graphicsId": "OBJ_EVENT_GFX_POKEFAN_M"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              10,
              2
            ],
            [
              14,
              2
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      }
    ]
  },
  "2": {
    "name": "Unique",
    "numTrainers": 8,
    "numFloors": 4,
    "floors": [
      {
        "trainerNums": [
          49,
          50
        ],
        "trainers": [
          {
            "name": "MEREDITH",
            "facilityClass": "FACILITY_CLASS_PKMN_RANGER_F",
            "graphicsId": "OBJ_EVENT_GFX_PICNICKER"
          },
          {
            "name": "BERNARD",
            "facilityClass": "FACILITY_CLASS_KINDLER",
            "graphicsId": "OBJ_EVENT_GFX_MAN_5"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              4,
              3
            ],
            [
              7,
              3
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            2,
            2
          ]
        }
      },
      {
        "trainerNums": [
          51,
          52
        ],
        "trainers": [
          {
            "name": "ABRAHAM",
            "facilityClass": "FACILITY_CLASS_RUIN_MANIAC",
            "graphicsId": "OBJ_EVENT_GFX_HIKER"
          },
          {
            "name": "LUC",
            "facilityClass": "FACILITY_CLASS_TUBER_M",
            "graphicsId": "OBJ_EVENT_GFX_TUBER_M"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              9,
              6
            ],
            [
              13,
              6
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      },
      {
        "trainerNums": [
          53,
          54
        ],
        "trainers": [
          {
            "name": "BREYDEN",
            "facilityClass": "FACILITY_CLASS_YOUNGSTER",
            "graphicsId": "OBJ_EVENT_GFX_YOUNGSTER"
          },
          {
            "name": "ANIYA",
            "facilityClass": "FACILITY_CLASS_TUBER_F",
            "graphicsId": "OBJ_EVENT_GFX_TUBER_F"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              6,
              9
            ],
            [
              8,
              9
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            1,
            1
          ]
        }
      },
      {
        "trainerNums": [
          56,
          55
        ],
        "trainers": [
          {
            "name": "DANE",
            "facilityClass": "FACILITY_CLASS_BIRD_KEEPER",
            "graphicsId": "OBJ_EVENT_GFX_MAN_5"
          },
          {
            "name": "STEPHANIE",
            "facilityClass": "FACILITY_CLASS_SWIMMING_TRIATHLETE_F",
            "graphicsId": "OBJ_EVENT_GFX_RUNNING_TRIATHLETE_F"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              8,
              2
            ],
            [
              11,
              5
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_NORTH"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      }
    ]
  },
  "3": {
    "name": "Expert",
    "numTrainers": 8,
    "numFloors": 4,
    "floors": [
      {
        "trainerNums": [
          57,
          58
        ],
        "trainers": [
          {
            "name": "ALFRED",
            "facilityClass": "FACILITY_CLASS_COOLTRAINER_M",
            "graphicsId": "OBJ_EVENT_GFX_MAN_3"
          },
          {
            "name": "EDIE",
            "facilityClass": "FACILITY_CLASS_PSYCHIC_F",
            "graphicsId": "OBJ_EVENT_GFX_LASS"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              4,
              7
            ],
            [
              10,
              7
            ]
          ],
          "trainerDirections": [
            "DIR_WEST",
            "DIR_EAST"
          ],
          "trainerRanges": [
            5,
            5
          ]
        }
      },
      {
        "trainerNums": [
          59,
          60
        ],
        "trainers": [
          {
            "name": "RODERICK",
            "facilityClass": "FACILITY_CLASS_COOLTRAINER_M",
            "graphicsId": "OBJ_EVENT_GFX_MAN_3"
          },
          {
            "name": "ALICIA",
            "facilityClass": "FACILITY_CLASS_COOLTRAINER_F",
            "graphicsId": "OBJ_EVENT_GFX_WOMAN_5"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              7,
              10
            ],
            [
              7,
              14
            ]
          ],
          "trainerDirections": [
            "DIR_SOUTH",
            "DIR_NORTH"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      },
      {
        "trainerNums": [
          61,
          62
        ],
        "trainers": [
          {
            "name": "TERRENCE",
            "facilityClass": "FACILITY_CLASS_EXPERT_M",
            "graphicsId": "OBJ_EVENT_GFX_EXPERT_M"
          },
          {
            "name": "CARLOTTA",
            "facilityClass": "FACILITY_CLASS_EXPERT_F",
            "graphicsId": "OBJ_EVENT_GFX_EXPERT_F"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              7,
              6
            ],
            [
              7,
              10
            ]
          ],
          "trainerDirections": [
            "DIR_SOUTH",
            "DIR_NORTH"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      },
      {
        "trainerNums": [
          63,
          64
        ],
        "trainers": [
          {
            "name": "NORA",
            "facilityClass": "FACILITY_CLASS_PKMN_RANGER_F",
            "graphicsId": "OBJ_EVENT_GFX_PICNICKER"
          },
          {
            "name": "GAV",
            "facilityClass": "FACILITY_CLASS_PKMN_RANGER_M",
            "graphicsId": "OBJ_EVENT_GFX_CAMPER"
          }
        ],
        "map": {
          "trainerCoords": [
            [
              7,
              6
            ],
            [
              7,
              10
            ]
          ],
          "trainerDirections": [
            "DIR_SOUTH",
            "DIR_NORTH"
          ],
          "trainerRanges": [
            3,
            3
          ]
        }
      }
    ]
  }
} as Record<number, TrainerHillModeData>;

export const TRAINER_HILL_MODE_NAME_TO_ID: Record<string, number> = {
  Normal: 0,
  Variety: 1,
  Unique: 2,
  Expert: 3,
};

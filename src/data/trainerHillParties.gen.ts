// Auto-generated from pokeemerald C data. DO NOT EDIT.
// Source ref: public/pokeemerald/src/data/battle_frontier/trainer_hill.h

export interface TrainerHillMonTemplate {
  species: string;
  heldItem: string;
  moves: [string, string, string, string];
}

export type TrainerHillTrainerPartyTemplate = [
  TrainerHillMonTemplate,
  TrainerHillMonTemplate,
  TrainerHillMonTemplate
];

export type TrainerHillFloorPartyTemplate = [
  TrainerHillTrainerPartyTemplate,
  TrainerHillTrainerPartyTemplate
];

export const TRAINER_HILL_PARTIES: Record<number, TrainerHillFloorPartyTemplate[]> = {
  "0": [
    [
      [
        {
          "species": "SPECIES_MISDREAVUS",
          "heldItem": "ITEM_BRIGHT_POWDER",
          "moves": [
            "MOVE_SHADOW_BALL",
            "MOVE_PSYCHIC",
            "MOVE_THUNDERBOLT",
            "MOVE_CONFUSE_RAY"
          ]
        },
        {
          "species": "SPECIES_SOLROCK",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_PSYCHIC",
            "MOVE_FLAMETHROWER",
            "MOVE_ROCK_SLIDE",
            "MOVE_CALM_MIND"
          ]
        },
        {
          "species": "SPECIES_CLAYDOL",
          "heldItem": "ITEM_SHELL_BELL",
          "moves": [
            "MOVE_EARTHQUAKE",
            "MOVE_PSYCHIC",
            "MOVE_SHADOW_BALL",
            "MOVE_ICE_BEAM"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_FLAREON",
          "heldItem": "ITEM_CHARCOAL",
          "moves": [
            "MOVE_FIRE_BLAST",
            "MOVE_BITE",
            "MOVE_QUICK_ATTACK",
            "MOVE_SAND_ATTACK"
          ]
        },
        {
          "species": "SPECIES_MAGNETON",
          "heldItem": "ITEM_MAGNET",
          "moves": [
            "MOVE_ZAP_CANNON",
            "MOVE_THUNDER_WAVE",
            "MOVE_SCREECH",
            "MOVE_METAL_SOUND"
          ]
        },
        {
          "species": "SPECIES_PINSIR",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_GUILLOTINE",
            "MOVE_BRICK_BREAK",
            "MOVE_SWAGGER",
            "MOVE_FAINT_ATTACK"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_MEDITITE",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_FOCUS_PUNCH",
            "MOVE_PROTECT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_HERACROSS",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_FOCUS_PUNCH",
            "MOVE_PROTECT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_HITMONTOP",
          "heldItem": "ITEM_SHELL_BELL",
          "moves": [
            "MOVE_FOCUS_PUNCH",
            "MOVE_PROTECT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_MR_MIME",
          "heldItem": "ITEM_SITRUS_BERRY",
          "moves": [
            "MOVE_SAFEGUARD",
            "MOVE_REFLECT",
            "MOVE_LIGHT_SCREEN",
            "MOVE_PSYCHIC"
          ]
        },
        {
          "species": "SPECIES_PLUSLE",
          "heldItem": "ITEM_SITRUS_BERRY",
          "moves": [
            "MOVE_RAIN_DANCE",
            "MOVE_LIGHT_SCREEN",
            "MOVE_HELPING_HAND",
            "MOVE_THUNDER"
          ]
        },
        {
          "species": "SPECIES_TOGEPI",
          "heldItem": "ITEM_SITRUS_BERRY",
          "moves": [
            "MOVE_LIGHT_SCREEN",
            "MOVE_REFLECT",
            "MOVE_FOLLOW_ME",
            "MOVE_METRONOME"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_VAPOREON",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_HAZE",
            "MOVE_HELPING_HAND",
            "MOVE_TICKLE",
            "MOVE_WATER_PULSE"
          ]
        },
        {
          "species": "SPECIES_DODRIO",
          "heldItem": "ITEM_KINGS_ROCK",
          "moves": [
            "MOVE_HAZE",
            "MOVE_TRI_ATTACK",
            "MOVE_TAUNT",
            "MOVE_TORMENT"
          ]
        },
        {
          "species": "SPECIES_OMASTAR",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_HAZE",
            "MOVE_HYDRO_PUMP",
            "MOVE_TICKLE",
            "MOVE_ATTRACT"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_NIDOQUEEN",
          "heldItem": "ITEM_SALAC_BERRY",
          "moves": [
            "MOVE_SUPERPOWER",
            "MOVE_BITE",
            "MOVE_CHARM",
            "MOVE_FLATTER"
          ]
        },
        {
          "species": "SPECIES_NINETALES",
          "heldItem": "ITEM_SALAC_BERRY",
          "moves": [
            "MOVE_OVERHEAT",
            "MOVE_QUICK_ATTACK",
            "MOVE_SPITE",
            "MOVE_TAIL_WHIP"
          ]
        },
        {
          "species": "SPECIES_CHARIZARD",
          "heldItem": "ITEM_SALAC_BERRY",
          "moves": [
            "MOVE_OVERHEAT",
            "MOVE_BEAT_UP",
            "MOVE_SCARY_FACE",
            "MOVE_GROWL"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_ALAKAZAM",
          "heldItem": "ITEM_PETAYA_BERRY",
          "moves": [
            "MOVE_SKILL_SWAP",
            "MOVE_FIRE_PUNCH",
            "MOVE_ICE_PUNCH",
            "MOVE_REFLECT"
          ]
        },
        {
          "species": "SPECIES_BLISSEY",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_SKILL_SWAP",
            "MOVE_EGG_BOMB",
            "MOVE_THUNDERBOLT",
            "MOVE_SING"
          ]
        },
        {
          "species": "SPECIES_GRUMPIG",
          "heldItem": "ITEM_TWISTED_SPOON",
          "moves": [
            "MOVE_SKILL_SWAP",
            "MOVE_PSYCHIC",
            "MOVE_CONFUSE_RAY",
            "MOVE_REST"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_TROPIUS",
          "heldItem": "ITEM_WHITE_HERB",
          "moves": [
            "MOVE_SUNNY_DAY",
            "MOVE_SOLAR_BEAM",
            "MOVE_SWEET_SCENT",
            "MOVE_AERIAL_ACE"
          ]
        },
        {
          "species": "SPECIES_BELLOSSOM",
          "heldItem": "ITEM_MENTAL_HERB",
          "moves": [
            "MOVE_SWEET_SCENT",
            "MOVE_PETAL_DANCE",
            "MOVE_STUN_SPORE",
            "MOVE_SLUDGE_BOMB"
          ]
        },
        {
          "species": "SPECIES_MEGANIUM",
          "heldItem": "ITEM_MIRACLE_SEED",
          "moves": [
            "MOVE_RAZOR_LEAF",
            "MOVE_BODY_SLAM",
            "MOVE_LEECH_SEED",
            "MOVE_SYNTHESIS"
          ]
        }
      ]
    ]
  ],
  "1": [
    [
      [
        {
          "species": "SPECIES_DELIBIRD",
          "heldItem": "ITEM_SITRUS_BERRY",
          "moves": [
            "MOVE_PRESENT",
            "MOVE_SPLASH",
            "MOVE_HAIL",
            "MOVE_PROTECT"
          ]
        },
        {
          "species": "SPECIES_CLEFAIRY",
          "heldItem": "ITEM_SITRUS_BERRY",
          "moves": [
            "MOVE_PRESENT",
            "MOVE_COSMIC_POWER",
            "MOVE_LIGHT_SCREEN",
            "MOVE_MOONLIGHT"
          ]
        },
        {
          "species": "SPECIES_PIKACHU",
          "heldItem": "ITEM_SITRUS_BERRY",
          "moves": [
            "MOVE_PRESENT",
            "MOVE_GROWL",
            "MOVE_TAIL_WHIP",
            "MOVE_AGILITY"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_CORSOLA",
          "heldItem": "ITEM_SILK_SCARF",
          "moves": [
            "MOVE_BUBBLE_BEAM",
            "MOVE_ROCK_BLAST",
            "MOVE_REFLECT",
            "MOVE_LIGHT_SCREEN"
          ]
        },
        {
          "species": "SPECIES_CLAMPERL",
          "heldItem": "ITEM_SILK_SCARF",
          "moves": [
            "MOVE_WHIRLPOOL",
            "MOVE_IRON_DEFENSE",
            "MOVE_ENDURE",
            "MOVE_CONFUSE_RAY"
          ]
        },
        {
          "species": "SPECIES_STARMIE",
          "heldItem": "ITEM_SILK_SCARF",
          "moves": [
            "MOVE_DIVE",
            "MOVE_ICY_WIND",
            "MOVE_SWIFT",
            "MOVE_SKILL_SWAP"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_JIGGLYPUFF",
          "heldItem": "ITEM_BRIGHT_POWDER",
          "moves": [
            "MOVE_SING",
            "MOVE_HYPER_VOICE",
            "MOVE_ATTRACT",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_JYNX",
          "heldItem": "ITEM_BRIGHT_POWDER",
          "moves": [
            "MOVE_PERISH_SONG",
            "MOVE_FAKE_TEARS",
            "MOVE_ATTRACT",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_EXPLOUD",
          "heldItem": "ITEM_BRIGHT_POWDER",
          "moves": [
            "MOVE_HOWL",
            "MOVE_HYPER_VOICE",
            "MOVE_ATTRACT",
            "MOVE_NONE"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_ILLUMISE",
          "heldItem": "ITEM_BRIGHT_POWDER",
          "moves": [
            "MOVE_ENCORE",
            "MOVE_ATTRACT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_SPHEAL",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_ENCORE",
            "MOVE_ATTRACT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_VIGOROTH",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_ENCORE",
            "MOVE_ATTRACT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_WOOPER",
          "heldItem": "ITEM_FIGY_BERRY",
          "moves": [
            "MOVE_RAIN_DANCE",
            "MOVE_YAWN",
            "MOVE_SURF",
            "MOVE_HAZE"
          ]
        },
        {
          "species": "SPECIES_POLIWAG",
          "heldItem": "ITEM_WIKI_BERRY",
          "moves": [
            "MOVE_SURF",
            "MOVE_ICE_BEAM",
            "MOVE_MIST",
            "MOVE_HYPNOSIS"
          ]
        },
        {
          "species": "SPECIES_PSYDUCK",
          "heldItem": "ITEM_AGUAV_BERRY",
          "moves": [
            "MOVE_HYPNOSIS",
            "MOVE_SURF",
            "MOVE_DISABLE",
            "MOVE_SEISMIC_TOSS"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_BALTOY",
          "heldItem": "ITEM_SILK_SCARF",
          "moves": [
            "MOVE_EXPLOSION",
            "MOVE_SELF_DESTRUCT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_PINECO",
          "heldItem": "ITEM_SILK_SCARF",
          "moves": [
            "MOVE_EXPLOSION",
            "MOVE_SELF_DESTRUCT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_VOLTORB",
          "heldItem": "ITEM_SILK_SCARF",
          "moves": [
            "MOVE_EXPLOSION",
            "MOVE_SELF_DESTRUCT",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_UNOWN",
          "heldItem": "ITEM_MIRACLE_SEED",
          "moves": [
            "MOVE_HIDDEN_POWER",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_UNOWN",
          "heldItem": "ITEM_MYSTIC_WATER",
          "moves": [
            "MOVE_HIDDEN_POWER",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_UNOWN",
          "heldItem": "ITEM_BLACK_BELT",
          "moves": [
            "MOVE_HIDDEN_POWER",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_UNOWN",
          "heldItem": "ITEM_CHARCOAL",
          "moves": [
            "MOVE_HIDDEN_POWER",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_UNOWN",
          "heldItem": "ITEM_SOFT_SAND",
          "moves": [
            "MOVE_HIDDEN_POWER",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_UNOWN",
          "heldItem": "ITEM_TWISTED_SPOON",
          "moves": [
            "MOVE_HIDDEN_POWER",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        }
      ]
    ]
  ],
  "2": [
    [
      [
        {
          "species": "SPECIES_SUNFLORA",
          "heldItem": "ITEM_PERSIM_BERRY",
          "moves": [
            "MOVE_PETAL_DANCE",
            "MOVE_GRASS_WHISTLE",
            "MOVE_LIGHT_SCREEN",
            "MOVE_SUNNY_DAY"
          ]
        },
        {
          "species": "SPECIES_TANGELA",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_GIGA_DRAIN",
            "MOVE_SLEEP_POWDER",
            "MOVE_AMNESIA",
            "MOVE_SUNNY_DAY"
          ]
        },
        {
          "species": "SPECIES_VENUSAUR",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_SOLAR_BEAM",
            "MOVE_EARTHQUAKE",
            "MOVE_SYNTHESIS",
            "MOVE_SUNNY_DAY"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_MAGCARGO",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_HEAT_WAVE",
            "MOVE_ROCK_SLIDE",
            "MOVE_PROTECT",
            "MOVE_SUNNY_DAY"
          ]
        },
        {
          "species": "SPECIES_RAPIDASH",
          "heldItem": "ITEM_KINGS_ROCK",
          "moves": [
            "MOVE_FIRE_BLAST",
            "MOVE_BOUNCE",
            "MOVE_QUICK_ATTACK",
            "MOVE_SUNNY_DAY"
          ]
        },
        {
          "species": "SPECIES_MOLTRES",
          "heldItem": "ITEM_BRIGHT_POWDER",
          "moves": [
            "MOVE_SKY_ATTACK",
            "MOVE_AERIAL_ACE",
            "MOVE_ROAR",
            "MOVE_SUNNY_DAY"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_SMEARGLE",
          "heldItem": "ITEM_SCOPE_LENS",
          "moves": [
            "MOVE_EARTHQUAKE",
            "MOVE_SHADOW_BALL",
            "MOVE_AERIAL_ACE",
            "MOVE_IMPRISON"
          ]
        },
        {
          "species": "SPECIES_SMEARGLE",
          "heldItem": "ITEM_CHESTO_BERRY",
          "moves": [
            "MOVE_REST",
            "MOVE_THUNDER_WAVE",
            "MOVE_FLAMETHROWER",
            "MOVE_IMPRISON"
          ]
        },
        {
          "species": "SPECIES_SMEARGLE",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_TEETER_DANCE",
            "MOVE_LOCK_ON",
            "MOVE_SHEER_COLD",
            "MOVE_EXPLOSION"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_CUBONE",
          "heldItem": "ITEM_THICK_CLUB",
          "moves": [
            "MOVE_BONEMERANG",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_BEEDRILL",
          "heldItem": "ITEM_SHELL_BELL",
          "moves": [
            "MOVE_TWINEEDLE",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        },
        {
          "species": "SPECIES_RATICATE",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_SUPER_FANG",
            "MOVE_NONE",
            "MOVE_NONE",
            "MOVE_NONE"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_CHARMELEON",
          "heldItem": "ITEM_CHARCOAL",
          "moves": [
            "MOVE_FIRE_SPIN",
            "MOVE_DRAGON_RAGE",
            "MOVE_FLAMETHROWER",
            "MOVE_SLASH"
          ]
        },
        {
          "species": "SPECIES_WARTORTLE",
          "heldItem": "ITEM_MYSTIC_WATER",
          "moves": [
            "MOVE_HYDRO_PUMP",
            "MOVE_SKULL_BASH",
            "MOVE_RAIN_DANCE",
            "MOVE_PROTECT"
          ]
        },
        {
          "species": "SPECIES_IVYSAUR",
          "heldItem": "ITEM_MIRACLE_SEED",
          "moves": [
            "MOVE_SOLAR_BEAM",
            "MOVE_SYNTHESIS",
            "MOVE_GROWTH",
            "MOVE_SWEET_SCENT"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_CLEFFA",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_MEGA_KICK",
            "MOVE_SWEET_KISS",
            "MOVE_SING",
            "MOVE_METRONOME"
          ]
        },
        {
          "species": "SPECIES_WYNAUT",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_ENCORE",
            "MOVE_COUNTER",
            "MOVE_MIRROR_COAT",
            "MOVE_DESTINY_BOND"
          ]
        },
        {
          "species": "SPECIES_MAGBY",
          "heldItem": "ITEM_SCOPE_LENS",
          "moves": [
            "MOVE_FIRE_BLAST",
            "MOVE_CONFUSE_RAY",
            "MOVE_THUNDER_PUNCH",
            "MOVE_BARRIER"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_SUDOWOODO",
          "heldItem": "ITEM_SITRUS_BERRY",
          "moves": [
            "MOVE_ROCK_SLIDE",
            "MOVE_BLOCK",
            "MOVE_TOXIC",
            "MOVE_EXPLOSION"
          ]
        },
        {
          "species": "SPECIES_SLOWKING",
          "heldItem": "ITEM_SCOPE_LENS",
          "moves": [
            "MOVE_SURF",
            "MOVE_PSYCHIC",
            "MOVE_BLIZZARD",
            "MOVE_DISABLE"
          ]
        },
        {
          "species": "SPECIES_ENTEI",
          "heldItem": "ITEM_PETAYA_BERRY",
          "moves": [
            "MOVE_FLAMETHROWER",
            "MOVE_CALM_MIND",
            "MOVE_FIRE_SPIN",
            "MOVE_ROAR"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_HOUNDOOM",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_FLAMETHROWER",
            "MOVE_CRUNCH",
            "MOVE_ROAR",
            "MOVE_WILL_O_WISP"
          ]
        },
        {
          "species": "SPECIES_STANTLER",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_CONFUSE_RAY",
            "MOVE_SWAGGER",
            "MOVE_PSYCH_UP",
            "MOVE_TAKE_DOWN"
          ]
        },
        {
          "species": "SPECIES_ARTICUNO",
          "heldItem": "ITEM_NEVER_MELT_ICE",
          "moves": [
            "MOVE_BLIZZARD",
            "MOVE_SHEER_COLD",
            "MOVE_MIST",
            "MOVE_AERIAL_ACE"
          ]
        }
      ]
    ]
  ],
  "3": [
    [
      [
        {
          "species": "SPECIES_SNORLAX",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_MEGA_KICK",
            "MOVE_SHADOW_BALL",
            "MOVE_BRICK_BREAK",
            "MOVE_EARTHQUAKE"
          ]
        },
        {
          "species": "SPECIES_MILTANK",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_DOUBLE_EDGE",
            "MOVE_SHADOW_BALL",
            "MOVE_ATTRACT",
            "MOVE_MILK_DRINK"
          ]
        },
        {
          "species": "SPECIES_URSARING",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_DOUBLE_EDGE",
            "MOVE_CRUNCH",
            "MOVE_BRICK_BREAK",
            "MOVE_AERIAL_ACE"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_GENGAR",
          "heldItem": "ITEM_LUM_BERRY",
          "moves": [
            "MOVE_PSYCHIC",
            "MOVE_THUNDERBOLT",
            "MOVE_FIRE_PUNCH",
            "MOVE_ICE_PUNCH"
          ]
        },
        {
          "species": "SPECIES_GARDEVOIR",
          "heldItem": "ITEM_SALAC_BERRY",
          "moves": [
            "MOVE_PSYCHIC",
            "MOVE_THUNDERBOLT",
            "MOVE_MAGICAL_LEAF",
            "MOVE_DESTINY_BOND"
          ]
        },
        {
          "species": "SPECIES_ALAKAZAM",
          "heldItem": "ITEM_LUM_BERRY",
          "moves": [
            "MOVE_PSYCHIC",
            "MOVE_RECOVER",
            "MOVE_THUNDER_WAVE",
            "MOVE_ATTRACT"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_SWELLOW",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_AERIAL_ACE",
            "MOVE_AGILITY",
            "MOVE_FACADE",
            "MOVE_ATTRACT"
          ]
        },
        {
          "species": "SPECIES_MACHAMP",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_LOW_KICK",
            "MOVE_ROCK_SLIDE",
            "MOVE_FACADE",
            "MOVE_ATTRACT"
          ]
        },
        {
          "species": "SPECIES_URSARING",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_PROTECT",
            "MOVE_ROCK_SLIDE",
            "MOVE_FACADE",
            "MOVE_ATTRACT"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_DUSCLOPS",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_PURSUIT",
            "MOVE_PROTECT",
            "MOVE_ATTRACT",
            "MOVE_WILL_O_WISP"
          ]
        },
        {
          "species": "SPECIES_NINETALES",
          "heldItem": "ITEM_WHITE_HERB",
          "moves": [
            "MOVE_OVERHEAT",
            "MOVE_CONFUSE_RAY",
            "MOVE_WILL_O_WISP",
            "MOVE_ATTRACT"
          ]
        },
        {
          "species": "SPECIES_BANETTE",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_SHADOW_BALL",
            "MOVE_FAINT_ATTACK",
            "MOVE_ATTRACT",
            "MOVE_WILL_O_WISP"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_WOBBUFFET",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_MIRROR_COAT",
            "MOVE_COUNTER",
            "MOVE_SAFEGUARD",
            "MOVE_ENCORE"
          ]
        },
        {
          "species": "SPECIES_EXPLOUD",
          "heldItem": "ITEM_CHESTO_BERRY",
          "moves": [
            "MOVE_HYPER_VOICE",
            "MOVE_COUNTER",
            "MOVE_REST",
            "MOVE_ROCK_SLIDE"
          ]
        },
        {
          "species": "SPECIES_CROBAT",
          "heldItem": "ITEM_KINGS_ROCK",
          "moves": [
            "MOVE_MEAN_LOOK",
            "MOVE_CONFUSE_RAY",
            "MOVE_AERIAL_ACE",
            "MOVE_TOXIC"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_DEWGONG",
          "heldItem": "ITEM_CHESTO_BERRY",
          "moves": [
            "MOVE_ICE_BEAM",
            "MOVE_SIGNAL_BEAM",
            "MOVE_REST",
            "MOVE_PERISH_SONG"
          ]
        },
        {
          "species": "SPECIES_POLITOED",
          "heldItem": "ITEM_BRIGHT_POWDER",
          "moves": [
            "MOVE_HYDRO_PUMP",
            "MOVE_BLIZZARD",
            "MOVE_MIND_READER",
            "MOVE_PERISH_SONG"
          ]
        },
        {
          "species": "SPECIES_MAROWAK",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_PERISH_SONG",
            "MOVE_EARTHQUAKE",
            "MOVE_COUNTER",
            "MOVE_PROTECT"
          ]
        }
      ]
    ],
    [
      [
        {
          "species": "SPECIES_FORRETRESS",
          "heldItem": "ITEM_QUICK_CLAW",
          "moves": [
            "MOVE_EXPLOSION",
            "MOVE_EARTHQUAKE",
            "MOVE_ATTRACT",
            "MOVE_SPIKES"
          ]
        },
        {
          "species": "SPECIES_ELECTRODE",
          "heldItem": "ITEM_SALAC_BERRY",
          "moves": [
            "MOVE_EXPLOSION",
            "MOVE_THUNDERBOLT",
            "MOVE_SWIFT",
            "MOVE_LIGHT_SCREEN"
          ]
        },
        {
          "species": "SPECIES_EXEGGUTOR",
          "heldItem": "ITEM_SHELL_BELL",
          "moves": [
            "MOVE_EXPLOSION",
            "MOVE_HYPNOSIS",
            "MOVE_PSYCHIC",
            "MOVE_SOLAR_BEAM"
          ]
        }
      ],
      [
        {
          "species": "SPECIES_GENGAR",
          "heldItem": "ITEM_SALAC_BERRY",
          "moves": [
            "MOVE_EXPLOSION",
            "MOVE_MEAN_LOOK",
            "MOVE_SHADOW_BALL",
            "MOVE_CONFUSE_RAY"
          ]
        },
        {
          "species": "SPECIES_DUSCLOPS",
          "heldItem": "ITEM_LEFTOVERS",
          "moves": [
            "MOVE_MEAN_LOOK",
            "MOVE_CONFUSE_RAY",
            "MOVE_WILL_O_WISP",
            "MOVE_SHADOW_BALL"
          ]
        },
        {
          "species": "SPECIES_MISDREAVUS",
          "heldItem": "ITEM_FOCUS_BAND",
          "moves": [
            "MOVE_MEAN_LOOK",
            "MOVE_CONFUSE_RAY",
            "MOVE_PERISH_SONG",
            "MOVE_SHADOW_BALL"
          ]
        }
      ]
    ]
  ]
} as Record<number, TrainerHillFloorPartyTemplate[]>;

// ⚠️  AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from pokeemerald field effect C source.
// Run 'npm run generate:field-effects' to regenerate

export interface FieldEffectAnimationFrame {
  frame: number;
  duration: number;
  hFlip?: boolean;
  vFlip?: boolean;
}

export interface FieldEffectMetadata {
  id: string;
  imagePath: string;
  width: number;
  height: number;
  animation: FieldEffectAnimationFrame[];
}

export const FIELD_EFFECT_REGISTRY: Record<string, FieldEffectMetadata> = {
  "SHADOW_S": {
    "id": "FLDEFFOBJ_SHADOW_S",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/shadow_small.png",
    "width": 8,
    "height": 8,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SHADOW_M": {
    "id": "FLDEFFOBJ_SHADOW_M",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/shadow_medium.png",
    "width": 16,
    "height": 8,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SHADOW_L": {
    "id": "FLDEFFOBJ_SHADOW_L",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/shadow_large.png",
    "width": 32,
    "height": 8,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SHADOW_XL": {
    "id": "FLDEFFOBJ_SHADOW_XL",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/shadow_extra_large.png",
    "width": 64,
    "height": 32,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "TALL_GRASS": {
    "id": "FLDEFFOBJ_TALL_GRASS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/tall_grass.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 1,
        "duration": 10,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 10,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 10,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 10,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 0,
        "duration": 10,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "RIPPLE": {
    "id": "FLDEFFOBJ_RIPPLE",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/ripple.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 12,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 9,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 9,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 9,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 0,
        "duration": 9,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 9,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 11,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 11,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "ASH": {
    "id": "FLDEFFOBJ_ASH",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/ash.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 12,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 12,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 12,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 12,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SURF_BLOB": {
    "id": "FLDEFFOBJ_SURF_BLOB",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/surf_blob.png",
    "width": 32,
    "height": 32,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "ARROW": {
    "id": "FLDEFFOBJ_ARROW",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/arrow.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 3,
        "duration": 32,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 7,
        "duration": 32,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "GROUND_IMPACT_DUST": {
    "id": "FLDEFFOBJ_GROUND_IMPACT_DUST",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/ground_impact_dust.png",
    "width": 16,
    "height": 8,
    "animation": [
      {
        "frame": 0,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "JUMP_TALL_GRASS": {
    "id": "FLDEFFOBJ_JUMP_TALL_GRASS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/jump_tall_grass.png",
    "width": 16,
    "height": 8,
    "animation": [
      {
        "frame": 0,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SAND_FOOTPRINTS": {
    "id": "FLDEFFOBJ_SAND_FOOTPRINTS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/sand_footprints.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": true
      }
    ]
  },
  "JUMP_BIG_SPLASH": {
    "id": "FLDEFFOBJ_JUMP_BIG_SPLASH",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/jump_big_splash.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SPLASH": {
    "id": "FLDEFFOBJ_SPLASH",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/splash.png",
    "width": 16,
    "height": 8,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "JUMP_SMALL_SPLASH": {
    "id": "FLDEFFOBJ_JUMP_SMALL_SPLASH",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/jump_small_splash.png",
    "width": 16,
    "height": 8,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "LONG_GRASS": {
    "id": "FLDEFFOBJ_LONG_GRASS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/long_grass.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 1,
        "duration": 3,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 3,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "JUMP_LONG_GRASS": {
    "id": "FLDEFFOBJ_JUMP_LONG_GRASS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/jump_long_grass.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 5,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "UNUSED_GRASS": {
    "id": "FLDEFFOBJ_UNUSED_GRASS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/jump_long_grass.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 10,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 5,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 6,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 7,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 8,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "UNUSED_GRASS_2": {
    "id": "FLDEFFOBJ_UNUSED_GRASS_2",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/unused_grass_2.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "UNUSED_SAND": {
    "id": "FLDEFFOBJ_UNUSED_SAND",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/unused_sand.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "WATER_SURFACING": {
    "id": "FLDEFFOBJ_WATER_SURFACING",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/water_surfacing.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SPARKLE": {
    "id": "FLDEFFOBJ_SPARKLE",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/sparkle.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 5,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 5,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 0,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 5,
        "duration": 8,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "DEEP_SAND_FOOTPRINTS": {
    "id": "FLDEFFOBJ_DEEP_SAND_FOOTPRINTS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/deep_sand_footprints.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": true
      }
    ]
  },
  "TREE_DISGUISE": {
    "id": "FLDEFFOBJ_TREE_DISGUISE",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/tree_disguise.png",
    "width": 16,
    "height": 32,
    "animation": [
      {
        "frame": 0,
        "duration": 16,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "MOUNTAIN_DISGUISE": {
    "id": "FLDEFFOBJ_MOUNTAIN_DISGUISE",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/mountain_disguise.png",
    "width": 16,
    "height": 32,
    "animation": [
      {
        "frame": 0,
        "duration": 16,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "BIRD": {
    "id": "FLDEFFOBJ_BIRD",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/bird.png",
    "width": 32,
    "height": 32,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "BIKE_TIRE_TRACKS": {
    "id": "FLDEFFOBJ_BIKE_TIRE_TRACKS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/bike_tire_tracks.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 2,
        "duration": 1,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SAND_DISGUISE": {
    "id": "FLDEFFOBJ_SAND_DISGUISE",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/sand_disguise_placeholder.png",
    "width": 16,
    "height": 32,
    "animation": [
      {
        "frame": 0,
        "duration": 16,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SAND_PILE": {
    "id": "FLDEFFOBJ_SAND_PILE",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/sand_pile.png",
    "width": 16,
    "height": 8,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SHORT_GRASS": {
    "id": "FLDEFFOBJ_SHORT_GRASS",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/short_grass.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "HOT_SPRINGS_WATER": {
    "id": "FLDEFFOBJ_HOT_SPRINGS_WATER",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/hot_springs_water.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "ASH_PUFF": {
    "id": "FLDEFFOBJ_ASH_PUFF",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/ash_puff.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "ASH_LAUNCH": {
    "id": "FLDEFFOBJ_ASH_LAUNCH",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/ash_launch.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "BUBBLES": {
    "id": "FLDEFFOBJ_BUBBLES",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/bubbles.png",
    "width": 16,
    "height": 32,
    "animation": [
      {
        "frame": 0,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 2,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 3,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 4,
        "duration": 6,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 5,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 6,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 7,
        "duration": 4,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "SMALL_SPARKLE": {
    "id": "FLDEFFOBJ_SMALL_SPARKLE",
    "imagePath": "/pokeemerald/graphics/field_effects/pics/small_sparkle.png",
    "width": 16,
    "height": 16,
    "animation": [
      {
        "frame": 0,
        "duration": 3,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 1,
        "duration": 5,
        "hFlip": false,
        "vFlip": false
      },
      {
        "frame": 0,
        "duration": 5,
        "hFlip": false,
        "vFlip": false
      }
    ]
  },
  "RAYQUAZA": {
    "id": "FLDEFFOBJ_RAYQUAZA",
    "imagePath": "/pokeemerald/graphics/object_events/pics/pokemon/rayquaza.png",
    "width": 32,
    "height": 32,
    "animation": [
      {
        "frame": 0,
        "duration": 1,
        "hFlip": false,
        "vFlip": false
      }
    ]
  }
};

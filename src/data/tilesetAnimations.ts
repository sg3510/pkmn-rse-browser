export type TilesetKind = 'primary' | 'secondary';

export interface AnimationDestination {
  destStart: number;
  phase?: number; // sequence offset applied before modulo
}

export interface TilesetAnimationDefinition {
  id: string; // unique id across all tilesets
  tileset: TilesetKind;
  frames: string[];
  sequence?: number[];
  interval: number; // in game frames
  destinations: AnimationDestination[];
  altSequence?: number[];
  altSequenceThreshold?: number; // switch to alt when (cycle + phase) >= threshold
}

const NUM_PRIMARY_TILES = 512;

// TODO: Generate this map automatically by parsing public/pokeemerald/src/tileset_anims.c
// and tileset headers, instead of maintaining it manually.
export const TILESET_ANIMATION_CONFIGS: Record<string, TilesetAnimationDefinition[]> = {
  gTileset_General: [
    {
      id: 'gTileset_General:flower',
      tileset: 'primary',
      frames: [
        'data/tilesets/primary/general/anim/flower/0.png',
        'data/tilesets/primary/general/anim/flower/1.png',
        'data/tilesets/primary/general/anim/flower/2.png',
      ],
      sequence: [0, 1, 0, 2],
      interval: 16,
      destinations: [{ destStart: 508 }],
    },
    {
      id: 'gTileset_General:water',
      tileset: 'primary',
      frames: Array.from({ length: 8 }, (_, i) => `data/tilesets/primary/general/anim/water/${i}.png`),
      interval: 16,
      destinations: [{ destStart: 432 }],
    },
    {
      id: 'gTileset_General:sand-water-edge',
      tileset: 'primary',
      frames: Array.from({ length: 7 }, (_, i) => `data/tilesets/primary/general/anim/sand_water_edge/${i}.png`),
      sequence: [0, 1, 2, 3, 4, 5, 6, 0],
      interval: 16,
      destinations: [{ destStart: 464 }],
    },
    {
      id: 'gTileset_General:land-water-edge',
      tileset: 'primary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/primary/general/anim/land_water_edge/${i}.png`),
      interval: 16,
      destinations: [{ destStart: 480 }],
    },
    {
      id: 'gTileset_General:waterfall',
      tileset: 'primary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/primary/general/anim/waterfall/${i}.png`),
      interval: 16,
      destinations: [{ destStart: 496 }],
    },
  ],
  gTileset_InsideBuilding: [
    {
      id: 'gTileset_InsideBuilding:tv',
      tileset: 'primary',
      frames: [
        'data/tilesets/primary/building/anim/tv_turned_on/0.png',
        'data/tilesets/primary/building/anim/tv_turned_on/1.png',
      ],
      interval: 8,
      destinations: [{ destStart: 496 }],
    },
  ],
  gTileset_Rustboro: [
    {
      id: 'gTileset_Rustboro:windy_water',
      tileset: 'secondary',
      frames: Array.from({ length: 8 }, (_, i) => `data/tilesets/secondary/rustboro/anim/windy_water/${i}.png`),
      interval: 8,
      destinations: Array.from({ length: 8 }, (_, i) => ({
        destStart: NUM_PRIMARY_TILES + 128 + i * 4,
        phase: -i,
      })),
    },
    {
      id: 'gTileset_Rustboro:fountain',
      tileset: 'secondary',
      frames: [
        'data/tilesets/secondary/rustboro/anim/fountain/0.png',
        'data/tilesets/secondary/rustboro/anim/fountain/1.png',
      ],
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 448 }],
    },
  ],
  gTileset_Dewford: [
    {
      id: 'gTileset_Dewford:flag',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/dewford/anim/flag/${i}.png`),
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 170 }],
    },
  ],
  gTileset_Slateport: [
    {
      id: 'gTileset_Slateport:balloons',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/slateport/anim/balloons/${i}.png`),
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 224 }],
    },
  ],
  gTileset_Mauville: [
    {
      id: 'gTileset_Mauville:flower_1',
      tileset: 'secondary',
      frames: Array.from({ length: 5 }, (_, i) => `data/tilesets/secondary/mauville/anim/flower_1/${i}.png`),
      sequence: [0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 2, 1],
      altSequence: [0, 0, 4, 4],
      altSequenceThreshold: 12,
      interval: 8,
      destinations: Array.from({ length: 8 }, (_, i) => ({
        destStart: NUM_PRIMARY_TILES + 96 + i * 4,
        phase: -i,
      })),
    },
    {
      id: 'gTileset_Mauville:flower_2',
      tileset: 'secondary',
      frames: Array.from({ length: 5 }, (_, i) => `data/tilesets/secondary/mauville/anim/flower_2/${i}.png`),
      sequence: [0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 2, 1],
      altSequence: [0, 0, 4, 4],
      altSequenceThreshold: 12,
      interval: 8,
      destinations: Array.from({ length: 8 }, (_, i) => ({
        destStart: NUM_PRIMARY_TILES + 128 + i * 4,
        phase: -i,
      })),
    },
  ],
  gTileset_Lavaridge: [
    {
      id: 'gTileset_Lavaridge:steam_left',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/lavaridge/anim/steam/${i}.png`),
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 288 }],
    },
    {
      id: 'gTileset_Lavaridge:steam_right',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/lavaridge/anim/steam/${i}.png`),
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 292, phase: 2 }],
    },
    {
      id: 'gTileset_Lavaridge:lava',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/cave/anim/lava/${i}.png`),
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 160 }],
    },
  ],
  gTileset_EverGrande: [
    {
      id: 'gTileset_EverGrande:flowers',
      tileset: 'secondary',
      frames: Array.from({ length: 8 }, (_, i) => `data/tilesets/secondary/ever_grande/anim/flowers/${i}.png`),
      interval: 8,
      destinations: Array.from({ length: 8 }, (_, i) => ({
        destStart: NUM_PRIMARY_TILES + 224 + i * 4,
        phase: -i,
      })),
    },
  ],
  gTileset_Pacifidlog: [
    {
      id: 'gTileset_Pacifidlog:log_bridges',
      tileset: 'secondary',
      frames: Array.from({ length: 3 }, (_, i) => `data/tilesets/secondary/pacifidlog/anim/log_bridges/${i}.png`),
      sequence: [0, 1, 2, 1],
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 464 }],
    },
    {
      id: 'gTileset_Pacifidlog:water_currents',
      tileset: 'secondary',
      frames: Array.from({ length: 8 }, (_, i) => `data/tilesets/secondary/pacifidlog/anim/water_currents/${i}.png`),
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 496 }],
    },
  ],
  gTileset_Sootopolis: [
    {
      id: 'gTileset_Sootopolis:stormy_water',
      tileset: 'secondary',
      frames: Array.from({ length: 8 }, (_, i) => `data/tilesets/secondary/sootopolis/anim/stormy_water/${i}_kyogre.png`),
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 240 }],
    },
  ],
  gTileset_Underwater: [
    {
      id: 'gTileset_Underwater:seaweed',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/underwater/anim/seaweed/${i}.png`),
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 496 }],
    },
  ],
  gTileset_Cave: [
    {
      id: 'gTileset_Cave:lava',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/cave/anim/lava/${i}.png`),
      interval: 16,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 416 }],
    },
  ],
  gTileset_BattleFrontierOutsideWest: [
    {
      id: 'gTileset_BattleFrontierOutsideWest:flag',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/battle_frontier_outside_west/anim/flag/${i}.png`),
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 218 }],
    },
  ],
  gTileset_BattleFrontierOutsideEast: [
    {
      id: 'gTileset_BattleFrontierOutsideEast:flag',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/battle_frontier_outside_east/anim/flag/${i}.png`),
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 218 }],
    },
  ],
  gTileset_MauvilleGym: [
    {
      id: 'gTileset_MauvilleGym:electric_gates',
      tileset: 'secondary',
      frames: Array.from({ length: 2 }, (_, i) => `data/tilesets/secondary/mauville_gym/anim/electric_gates/${i}.png`),
      interval: 2,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 144 }],
    },
  ],
  gTileset_SootopolisGym: [
    {
      id: 'gTileset_SootopolisGym:side_waterfall',
      tileset: 'secondary',
      frames: Array.from({ length: 3 }, (_, i) => `data/tilesets/secondary/sootopolis_gym/anim/side_waterfall/${i}.png`),
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 496 }],
    },
    {
      id: 'gTileset_SootopolisGym:front_waterfall',
      tileset: 'secondary',
      frames: Array.from({ length: 3 }, (_, i) => `data/tilesets/secondary/sootopolis_gym/anim/front_waterfall/${i}.png`),
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 464 }],
    },
  ],
  gTileset_EliteFour: [
    {
      id: 'gTileset_EliteFour:floor_light',
      tileset: 'secondary',
      frames: Array.from({ length: 2 }, (_, i) => `data/tilesets/secondary/elite_four/anim/floor_light/${i}.png`),
      interval: 64,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 480 }],
    },
    {
      id: 'gTileset_EliteFour:wall_lights',
      tileset: 'secondary',
      frames: Array.from({ length: 4 }, (_, i) => `data/tilesets/secondary/elite_four/anim/wall_lights/${i}.png`),
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 504 }],
    },
  ],
  gTileset_BikeShop: [
    {
      id: 'gTileset_BikeShop:blinking_lights',
      tileset: 'secondary',
      frames: Array.from({ length: 2 }, (_, i) => `data/tilesets/secondary/bike_shop/anim/blinking_lights/${i}.png`),
      interval: 4,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 496 }],
    },
  ],
  gTileset_BattlePyramid: [
    {
      id: 'gTileset_BattlePyramid:torch',
      tileset: 'secondary',
      frames: Array.from({ length: 3 }, (_, i) => `data/tilesets/secondary/battle_pyramid/anim/torch/${i}.png`),
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 151 }],
    },
    {
      id: 'gTileset_BattlePyramid:statue_shadow',
      tileset: 'secondary',
      frames: Array.from({ length: 3 }, (_, i) => `data/tilesets/secondary/battle_pyramid/anim/statue_shadow/${i}.png`),
      interval: 8,
      destinations: [{ destStart: NUM_PRIMARY_TILES + 135 }],
    },
  ],
};

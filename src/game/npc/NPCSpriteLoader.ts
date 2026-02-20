/**
 * NPCSpriteLoader - Loads and caches NPC sprites from pokeemerald graphics
 *
 * Maps graphics IDs (OBJ_EVENT_GFX_*) to sprite sheet paths and handles
 * loading/caching of sprite images.
 *
 * Uses auto-generated metadata from pokeemerald C source files.
 * To regenerate: npx tsx scripts/parse-sprite-metadata.ts
 *
 * Sprite layouts vary by character:
 * - Standard NPCs: 144x32 (9 frames of 16x32) or 48x32 (3 frames of 16x32)
 * - Small characters: 144x16 (9 frames of 16x16) or 48x16 (3 frames of 16x16)
 * - Pokemon: Usually 48x16 (3 frames of 16x16)
 *
 * Frame order (when 9 frames):
 *   Frame 0: Face down (south)
 *   Frame 1: Face up (north)
 *   Frame 2: Face left (west) - horizontally flipped for right
 *   Frame 3: Walk down frame 1
 *   Frame 4: Walk up frame 1
 *   Frame 5: Walk left frame 1
 *   Frame 6: Walk left frame 2
 *   Frames 7-8: Extra frames
 *
 * Frame order (when 3 frames):
 *   Frame 0: Face down
 *   Frame 1: Face up
 *   Frame 2: Face left/right
 */

import {
  getSpriteDimensions as getMetadataSpriteDimensions,
  getSpritePath as getMetadataSpritePath,
  getFrameCount as getMetadataFrameCount,
  getSpriteInfo,
  getStaticFrameIndex,
} from '../../data/spriteMetadata';
import { loadImageCanvasAsset } from '../../utils/assetLoader';

/** Base path for object event graphics */
const SPRITE_BASE_PATH = '/pokeemerald/graphics/object_events/pics';

/**
 * Frame dimensions (width x height in pixels) for each graphics ID
 * Parsed from pokeemerald/src/data/object_events/object_event_graphics_info.h
 *
 * Most NPCs are 16x32, small characters and Pokemon are 16x16,
 * some special sprites (bikes, legendaries) are 32x32 or 64x64
 */
const GRAPHICS_FRAME_DIMENSIONS: Record<string, { width: number; height: number }> = {
  // Standard 16x32 NPCs (most common)
  OBJ_EVENT_GFX_BOY_1: { width: 16, height: 32 },
  OBJ_EVENT_GFX_BOY_2: { width: 16, height: 32 },
  OBJ_EVENT_GFX_BOY_3: { width: 16, height: 32 },
  OBJ_EVENT_GFX_GIRL_1: { width: 16, height: 32 },
  OBJ_EVENT_GFX_GIRL_2: { width: 16, height: 32 },
  OBJ_EVENT_GFX_GIRL_3: { width: 16, height: 32 },
  OBJ_EVENT_GFX_TWIN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_FAT_MAN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_WOMAN_1: { width: 16, height: 32 },
  OBJ_EVENT_GFX_WOMAN_2: { width: 16, height: 32 },
  OBJ_EVENT_GFX_WOMAN_3: { width: 16, height: 32 },
  OBJ_EVENT_GFX_OLD_MAN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_OLD_WOMAN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAN_1: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAN_2: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAN_3: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAN_4: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAN_5: { width: 16, height: 32 },
  OBJ_EVENT_GFX_RICH_BOY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_LADY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_POKEFAN_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_POKEFAN_F: { width: 16, height: 32 },
  OBJ_EVENT_GFX_EXPERT_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_EXPERT_F: { width: 16, height: 32 },
  OBJ_EVENT_GFX_COOK: { width: 16, height: 32 },
  OBJ_EVENT_GFX_LINK_RECEPTIONIST: { width: 16, height: 32 },
  OBJ_EVENT_GFX_CAMPER: { width: 16, height: 32 },
  OBJ_EVENT_GFX_PICNICKER: { width: 16, height: 32 },
  OBJ_EVENT_GFX_YOUNGSTER: { width: 16, height: 32 },
  OBJ_EVENT_GFX_BUG_CATCHER: { width: 16, height: 32 },
  OBJ_EVENT_GFX_PSYCHIC_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_PSYCHIC_F: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SCHOOL_KID_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SCHOOL_KID_F: { width: 16, height: 32 },
  OBJ_EVENT_GFX_HEX_MANIAC: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SWIMMER_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SWIMMER_F: { width: 16, height: 32 },
  OBJ_EVENT_GFX_BLACK_BELT: { width: 16, height: 32 },
  OBJ_EVENT_GFX_BEAUTY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SCIENTIST_1: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SCIENTIST_2: { width: 16, height: 32 },
  OBJ_EVENT_GFX_LASS: { width: 16, height: 32 },
  OBJ_EVENT_GFX_GENTLEMAN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SAILOR: { width: 16, height: 32 },
  OBJ_EVENT_GFX_FISHERMAN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_RUNNING_TRIATHLETE_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_RUNNING_TRIATHLETE_F: { width: 16, height: 32 },
  OBJ_EVENT_GFX_HIKER: { width: 16, height: 32 },
  OBJ_EVENT_GFX_NURSE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_PROF_BIRCH: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MOM: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MART_EMPLOYEE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_CLERK: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MR_BRINEY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SCOTT: { width: 16, height: 32 },
  OBJ_EVENT_GFX_WALLY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_ARCHIE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAXIE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_STEVEN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_LANETTE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_RYDEL: { width: 16, height: 32 },
  OBJ_EVENT_GFX_GUITARIST: { width: 16, height: 32 },
  OBJ_EVENT_GFX_ARTIST: { width: 16, height: 32 },
  OBJ_EVENT_GFX_REPORTER_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_REPORTER_F: { width: 16, height: 32 },
  OBJ_EVENT_GFX_CAMERAMAN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_GAMEBOY_KID: { width: 16, height: 32 },
  OBJ_EVENT_GFX_CONTEST_JUDGE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_DEVON_EMPLOYEE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_HOT_SPRINGS_OLD_WOMAN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_AQUA_MEMBER_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_AQUA_MEMBER_F: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAGMA_MEMBER_M: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAGMA_MEMBER_F: { width: 16, height: 32 },

  // Gym Leaders
  OBJ_EVENT_GFX_ROXANNE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_BRAWLY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_WATTSON: { width: 16, height: 32 },
  OBJ_EVENT_GFX_FLANNERY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_NORMAN: { width: 16, height: 32 },
  OBJ_EVENT_GFX_WINONA: { width: 16, height: 32 },
  OBJ_EVENT_GFX_TATE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_LIZA: { width: 16, height: 32 },
  OBJ_EVENT_GFX_JUAN: { width: 16, height: 32 },

  // Elite Four
  OBJ_EVENT_GFX_SIDNEY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_PHOEBE: { width: 16, height: 32 },
  OBJ_EVENT_GFX_GLACIA: { width: 16, height: 32 },
  OBJ_EVENT_GFX_DRAKE: { width: 16, height: 32 },

  // Frontier Brains
  OBJ_EVENT_GFX_ANABEL: { width: 16, height: 32 },
  OBJ_EVENT_GFX_BRANDON: { width: 16, height: 32 },
  OBJ_EVENT_GFX_GRETA: { width: 16, height: 32 },
  OBJ_EVENT_GFX_LUCY: { width: 16, height: 32 },
  OBJ_EVENT_GFX_NOLAND: { width: 16, height: 32 },
  OBJ_EVENT_GFX_SPENSER: { width: 16, height: 32 },
  OBJ_EVENT_GFX_TUCKER: { width: 16, height: 32 },

  OBJ_EVENT_GFX_BRENDAN_NORMAL: { width: 16, height: 32 },
  OBJ_EVENT_GFX_MAY_NORMAL: { width: 16, height: 32 },
  OBJ_EVENT_GFX_RIVAL_BRENDAN_NORMAL: { width: 16, height: 32 },
  OBJ_EVENT_GFX_RIVAL_MAY_NORMAL: { width: 16, height: 32 },

  // Small 16x16 characters
  OBJ_EVENT_GFX_LITTLE_BOY: { width: 16, height: 16 },
  OBJ_EVENT_GFX_LITTLE_GIRL: { width: 16, height: 16 },
  OBJ_EVENT_GFX_NINJA_BOY: { width: 16, height: 16 },
  OBJ_EVENT_GFX_TUBER_M: { width: 16, height: 16 },
  OBJ_EVENT_GFX_TUBER_F: { width: 16, height: 16 },

  // 32x32 sprites (bikes, special)
  OBJ_EVENT_GFX_CYCLING_TRIATHLETE_M: { width: 32, height: 32 },
  OBJ_EVENT_GFX_CYCLING_TRIATHLETE_F: { width: 32, height: 32 },

  // Pokemon (16x16)
  OBJ_EVENT_GFX_PIKACHU: { width: 16, height: 16 },
  OBJ_EVENT_GFX_KECLEON: { width: 16, height: 16 },
  // C parity: OBJ_EVENT_GFX_ZIGZAGOON_1 points to EnemyZigzagoon (32x32),
  // while OBJ_EVENT_GFX_ZIGZAGOON_2 points to the normal 16x16 Zigzagoon.
  OBJ_EVENT_GFX_ZIGZAGOON_1: { width: 32, height: 32 },
  OBJ_EVENT_GFX_ZIGZAGOON_2: { width: 16, height: 16 },
  OBJ_EVENT_GFX_POOCHYENA: { width: 16, height: 16 },
  OBJ_EVENT_GFX_WINGULL: { width: 16, height: 16 },
  OBJ_EVENT_GFX_AZURILL: { width: 16, height: 16 },
  OBJ_EVENT_GFX_SKITTY: { width: 16, height: 16 },
  OBJ_EVENT_GFX_MEW: { width: 16, height: 32 },

  // Special intro Pokemon sprites
  OBJ_EVENT_GFX_VIGOROTH_CARRYING_BOX: { width: 32, height: 32 },
  OBJ_EVENT_GFX_VIGOROTH_FACING_AWAY: { width: 32, height: 32 },

  // Larger Pokemon (32x32)
  OBJ_EVENT_GFX_LATIAS: { width: 32, height: 32 },
  OBJ_EVENT_GFX_LATIOS: { width: 32, height: 32 },
  OBJ_EVENT_GFX_HO_OH: { width: 32, height: 32 },
  OBJ_EVENT_GFX_LUGIA: { width: 32, height: 32 },
  OBJ_EVENT_GFX_DEOXYS: { width: 32, height: 32 },
  OBJ_EVENT_GFX_SUDOWOODO: { width: 16, height: 32 },

  // Legendary Pokemon (64x64)
  OBJ_EVENT_GFX_KYOGRE: { width: 64, height: 64 },
  OBJ_EVENT_GFX_GROUDON: { width: 64, height: 64 },
  OBJ_EVENT_GFX_RAYQUAZA: { width: 64, height: 64 },
};

/**
 * Get the expected frame dimensions for a graphics ID
 * Uses auto-generated metadata, falls back to hardcoded then 16x32 default
 */
function getExpectedFrameDimensions(graphicsId: string): { width: number; height: number } {
  // First try auto-generated metadata
  const metaDims = getMetadataSpriteDimensions(graphicsId);
  if (metaDims.width !== 16 || metaDims.height !== 32) {
    // Non-default value found in metadata
    return metaDims;
  }

  // Fall back to hardcoded dimensions (for any edge cases)
  return GRAPHICS_FRAME_DIMENSIONS[graphicsId] ?? metaDims;
}

/**
 * Maps graphics IDs to sprite file paths (relative to SPRITE_BASE_PATH)
 * This is a subset of the most common NPCs; expand as needed.
 */
const GRAPHICS_ID_TO_PATH: Record<string, string> = {
  // Generic people
  OBJ_EVENT_GFX_BOY_1: '/people/boy_1.png',
  OBJ_EVENT_GFX_BOY_2: '/people/boy_2.png',
  OBJ_EVENT_GFX_BOY_3: '/people/boy_3.png',
  OBJ_EVENT_GFX_GIRL_1: '/people/girl_1.png',
  OBJ_EVENT_GFX_GIRL_2: '/people/girl_2.png',
  OBJ_EVENT_GFX_GIRL_3: '/people/girl_3.png',
  OBJ_EVENT_GFX_LITTLE_BOY: '/people/little_boy.png',
  OBJ_EVENT_GFX_LITTLE_GIRL: '/people/little_girl.png',
  OBJ_EVENT_GFX_FAT_MAN: '/people/fat_man.png',
  OBJ_EVENT_GFX_WOMAN_1: '/people/woman_1.png',
  OBJ_EVENT_GFX_WOMAN_2: '/people/woman_2.png',
  OBJ_EVENT_GFX_WOMAN_3: '/people/woman_3.png',
  OBJ_EVENT_GFX_WOMAN_4: '/people/woman_4.png',
  OBJ_EVENT_GFX_WOMAN_5: '/people/woman_5.png',
  OBJ_EVENT_GFX_OLD_MAN: '/people/old_man.png',
  OBJ_EVENT_GFX_OLD_WOMAN: '/people/old_woman.png',
  OBJ_EVENT_GFX_MAN_1: '/people/man_1.png',
  OBJ_EVENT_GFX_MAN_2: '/people/man_2.png',
  OBJ_EVENT_GFX_MAN_3: '/people/man_3.png',
  OBJ_EVENT_GFX_MAN_4: '/people/man_4.png',
  OBJ_EVENT_GFX_MAN_5: '/people/man_5.png',
  OBJ_EVENT_GFX_TWIN: '/people/twin.png',

  // Trainers / character classes
  OBJ_EVENT_GFX_NINJA_BOY: '/people/ninja_boy.png',
  OBJ_EVENT_GFX_BUG_CATCHER: '/people/bug_catcher.png',
  OBJ_EVENT_GFX_HIKER: '/people/hiker.png',
  OBJ_EVENT_GFX_SCIENTIST_1: '/people/scientist_1.png',
  OBJ_EVENT_GFX_SCIENTIST_2: '/people/scientist_2.png',
  OBJ_EVENT_GFX_BLACK_BELT: '/people/black_belt.png',
  OBJ_EVENT_GFX_GENTLEMAN: '/people/gentleman.png',
  OBJ_EVENT_GFX_BEAUTY: '/people/beauty.png',
  OBJ_EVENT_GFX_FISHERMAN: '/people/fisherman.png',
  OBJ_EVENT_GFX_SAILOR: '/people/sailor.png',
  OBJ_EVENT_GFX_CAMPER: '/people/camper.png',
  OBJ_EVENT_GFX_PICNICKER: '/people/picnicker.png',
  OBJ_EVENT_GFX_LASS: '/people/lass.png',
  OBJ_EVENT_GFX_SCHOOL_KID_M: '/people/school_kid_m.png',
  OBJ_EVENT_GFX_SCHOOL_KID_F: '/people/school_kid_f.png',
  OBJ_EVENT_GFX_EXPERT_M: '/people/expert_m.png',
  OBJ_EVENT_GFX_EXPERT_F: '/people/expert_f.png',
  OBJ_EVENT_GFX_YOUNGSTER: '/people/youngster.png',
  OBJ_EVENT_GFX_POKEFAN_M: '/people/pokefan_m.png',
  OBJ_EVENT_GFX_POKEFAN_F: '/people/pokefan_f.png',
  OBJ_EVENT_GFX_SWIMMER_M: '/people/swimmer_m.png',
  OBJ_EVENT_GFX_SWIMMER_F: '/people/swimmer_f.png',
  OBJ_EVENT_GFX_TUBER_M: '/people/tuber_m.png',
  OBJ_EVENT_GFX_TUBER_F: '/people/tuber_f.png',
  OBJ_EVENT_GFX_RUNNING_TRIATHLETE_M: '/people/running_triathlete_m.png',
  OBJ_EVENT_GFX_RUNNING_TRIATHLETE_F: '/people/running_triathlete_f.png',
  OBJ_EVENT_GFX_CYCLING_TRIATHLETE_M: '/people/cycling_triathlete_m.png',
  OBJ_EVENT_GFX_CYCLING_TRIATHLETE_F: '/people/cycling_triathlete_f.png',
  OBJ_EVENT_GFX_PSYCHIC_M: '/people/psychic_m.png',
  OBJ_EVENT_GFX_PSYCHIC_F: '/people/psychic_f.png',
  OBJ_EVENT_GFX_HEX_MANIAC: '/people/hex_maniac.png',
  OBJ_EVENT_GFX_GUITARIST: '/people/guitarist.png',
  OBJ_EVENT_GFX_COOK: '/people/cook.png',
  OBJ_EVENT_GFX_ARTIST: '/people/artist.png',
  OBJ_EVENT_GFX_REPORTER_M: '/people/reporter_m.png',
  OBJ_EVENT_GFX_REPORTER_F: '/people/reporter_f.png',
  OBJ_EVENT_GFX_CAMERAMAN: '/people/cameraman.png',
  OBJ_EVENT_GFX_RICH_BOY: '/people/rich_boy.png',
  OBJ_EVENT_GFX_LADY: '/people/lady.png',
  OBJ_EVENT_GFX_GAMEBOY_KID: '/people/gameboy_kid.png',
  OBJ_EVENT_GFX_CONTEST_JUDGE: '/people/contest_judge.png',
  OBJ_EVENT_GFX_DEVON_EMPLOYEE: '/people/devon_employee.png',
  OBJ_EVENT_GFX_HOT_SPRINGS_OLD_WOMAN: '/people/hot_springs_old_woman.png',

  // Team Aqua
  OBJ_EVENT_GFX_AQUA_MEMBER_M: '/people/team_aqua/aqua_member_m.png',
  OBJ_EVENT_GFX_AQUA_MEMBER_F: '/people/team_aqua/aqua_member_f.png',
  OBJ_EVENT_GFX_ARCHIE: '/people/team_aqua/archie.png',

  // Team Magma
  OBJ_EVENT_GFX_MAGMA_MEMBER_M: '/people/team_magma/magma_member_m.png',
  OBJ_EVENT_GFX_MAGMA_MEMBER_F: '/people/team_magma/magma_member_f.png',
  OBJ_EVENT_GFX_MAXIE: '/people/team_magma/maxie.png',

  // Gym Leaders
  OBJ_EVENT_GFX_ROXANNE: '/people/gym_leaders/roxanne.png',
  OBJ_EVENT_GFX_BRAWLY: '/people/gym_leaders/brawly.png',
  OBJ_EVENT_GFX_WATTSON: '/people/gym_leaders/wattson.png',
  OBJ_EVENT_GFX_FLANNERY: '/people/gym_leaders/flannery.png',
  OBJ_EVENT_GFX_NORMAN: '/people/gym_leaders/norman.png',
  OBJ_EVENT_GFX_WINONA: '/people/gym_leaders/winona.png',
  OBJ_EVENT_GFX_TATE: '/people/gym_leaders/tate.png',
  OBJ_EVENT_GFX_LIZA: '/people/gym_leaders/liza.png',
  OBJ_EVENT_GFX_JUAN: '/people/gym_leaders/juan.png',

  // Elite Four
  OBJ_EVENT_GFX_SIDNEY: '/people/elite_four/sidney.png',
  OBJ_EVENT_GFX_PHOEBE: '/people/elite_four/phoebe.png',
  OBJ_EVENT_GFX_GLACIA: '/people/elite_four/glacia.png',
  OBJ_EVENT_GFX_DRAKE: '/people/elite_four/drake.png',

  // Frontier Brains
  OBJ_EVENT_GFX_ANABEL: '/people/frontier_brains/anabel.png',
  OBJ_EVENT_GFX_BRANDON: '/people/frontier_brains/brandon.png',
  OBJ_EVENT_GFX_GRETA: '/people/frontier_brains/greta.png',
  OBJ_EVENT_GFX_LUCY: '/people/frontier_brains/lucy.png',
  OBJ_EVENT_GFX_NOLAND: '/people/frontier_brains/noland.png',
  OBJ_EVENT_GFX_SPENSER: '/people/frontier_brains/spenser.png',
  OBJ_EVENT_GFX_TUCKER: '/people/frontier_brains/tucker.png',

  // Story characters
  OBJ_EVENT_GFX_MOM: '/people/mom.png',
  OBJ_EVENT_GFX_NURSE: '/people/nurse.png',
  OBJ_EVENT_GFX_MART_EMPLOYEE: '/people/mart_employee.png',
  OBJ_EVENT_GFX_LINK_RECEPTIONIST: '/people/link_receptionist.png',
  OBJ_EVENT_GFX_CLERK: '/people/clerk.png',
  OBJ_EVENT_GFX_PROF_BIRCH: '/people/prof_birch.png',
  OBJ_EVENT_GFX_MR_BRINEY: '/people/mr_briney.png',
  OBJ_EVENT_GFX_SCOTT: '/people/scott.png',
  OBJ_EVENT_GFX_WALLY: '/people/wally.png',
  OBJ_EVENT_GFX_STEVEN: '/people/steven.png',
  OBJ_EVENT_GFX_LANETTE: '/people/lanette.png',
  OBJ_EVENT_GFX_RYDEL: '/people/rydel.png',

  // Player characters (Brendan/May)
  OBJ_EVENT_GFX_BRENDAN_NORMAL: '/people/brendan/walking.png',
  OBJ_EVENT_GFX_MAY_NORMAL: '/people/may/walking.png',
  OBJ_EVENT_GFX_RIVAL_BRENDAN_NORMAL: '/people/brendan/walking.png',
  OBJ_EVENT_GFX_RIVAL_MAY_NORMAL: '/people/may/walking.png',

  // Pokemon (overworld)
  OBJ_EVENT_GFX_ZIGZAGOON_1: '/pokemon/enemy_zigzagoon.png',
  OBJ_EVENT_GFX_ZIGZAGOON_2: '/pokemon/zigzagoon.png',
  OBJ_EVENT_GFX_PIKACHU: '/pokemon/pikachu.png',
  OBJ_EVENT_GFX_POOCHYENA: '/pokemon/poochyena.png',
  OBJ_EVENT_GFX_WINGULL: '/pokemon/wingull.png',
  OBJ_EVENT_GFX_VIGOROTH_CARRYING_BOX: '/pokemon/vigoroth.png',
  OBJ_EVENT_GFX_VIGOROTH_FACING_AWAY: '/pokemon/vigoroth.png',
  OBJ_EVENT_GFX_AZURILL: '/pokemon/azurill.png',
  OBJ_EVENT_GFX_SKITTY: '/pokemon/skitty.png',
  OBJ_EVENT_GFX_KECLEON: '/pokemon/kecleon.png',
  OBJ_EVENT_GFX_KYOGRE: '/pokemon/kyogre.png',
  OBJ_EVENT_GFX_GROUDON: '/pokemon/groudon.png',
  OBJ_EVENT_GFX_RAYQUAZA: '/pokemon/rayquaza.png',
  OBJ_EVENT_GFX_LATIAS: '/pokemon/latias_latios.png',
  OBJ_EVENT_GFX_LATIOS: '/pokemon/latias_latios.png',
  OBJ_EVENT_GFX_DEOXYS: '/pokemon/deoxys.png',
  OBJ_EVENT_GFX_MEW: '/pokemon/mew.png',
  OBJ_EVENT_GFX_HO_OH: '/pokemon/ho_oh.png',
  OBJ_EVENT_GFX_LUGIA: '/pokemon/lugia.png',
  OBJ_EVENT_GFX_SUDOWOODO: '/pokemon/sudowoodo.png',
};

function getGuessedSpritePaths(graphicsId: string): string[] {
  // Remove prefix
  const name = graphicsId.replace('OBJ_EVENT_GFX_', '');

  // Convert to lowercase with underscores to path format
  const snakeCase = name.toLowerCase();

  return [
    `/people/${snakeCase}.png`,
    `/misc/${snakeCase}.png`,
    `/pokemon/${snakeCase}.png`,
  ];
}

function addUniquePath(paths: string[], path: string | null | undefined): void {
  if (!path) return;
  if (!paths.includes(path)) {
    paths.push(path);
  }
}

function expandCategoryFallbacks(fullPath: string): string[] {
  if (!fullPath.startsWith(SPRITE_BASE_PATH)) {
    return [];
  }

  const relative = fullPath.slice(SPRITE_BASE_PATH.length);
  const fallbacks: string[] = [];

  if (relative.startsWith('/people/')) {
    fallbacks.push(`${SPRITE_BASE_PATH}${relative.replace('/people/', '/misc/')}`);
    fallbacks.push(`${SPRITE_BASE_PATH}${relative.replace('/people/', '/pokemon/')}`);
  } else if (relative.startsWith('/misc/')) {
    fallbacks.push(`${SPRITE_BASE_PATH}${relative.replace('/misc/', '/people/')}`);
  } else if (relative.startsWith('/pokemon/')) {
    fallbacks.push(`${SPRITE_BASE_PATH}${relative.replace('/pokemon/', '/people/')}`);
    fallbacks.push(`${SPRITE_BASE_PATH}${relative.replace('/pokemon/', '/misc/')}`);
  }

  return fallbacks;
}

export function getNPCSpritePathCandidates(graphicsId: string): string[] {
  const candidates: string[] = [];

  const metaPath = getMetadataSpritePath(graphicsId);
  if (metaPath) {
    addUniquePath(candidates, SPRITE_BASE_PATH + metaPath);
  }

  const hardcoded = GRAPHICS_ID_TO_PATH[graphicsId];
  if (hardcoded) {
    addUniquePath(candidates, SPRITE_BASE_PATH + hardcoded);
  }

  for (const guessed of getGuessedSpritePaths(graphicsId)) {
    addUniquePath(candidates, SPRITE_BASE_PATH + guessed);
  }

  // Add path-category fallbacks to survive incorrect metadata placement.
  const expanded = [...candidates];
  for (const candidate of candidates) {
    for (const fallback of expandCategoryFallbacks(candidate)) {
      addUniquePath(expanded, fallback);
    }
  }

  return expanded;
}

/**
 * Get the sprite path for a graphics ID
 * Uses auto-generated metadata first, then hardcoded paths, then guesses
 */
export function getNPCSpritePath(graphicsId: string): string | null {
  return getNPCSpritePathCandidates(graphicsId)[0] ?? null;
}

/**
 * Sprite dimensions info
 */
export interface SpriteDimensions {
  frameWidth: number;
  frameHeight: number;
  totalWidth: number;
  totalHeight: number;
}

/**
 * NPC sprite cache
 * Stores sprites as canvas elements with transparency applied
 */
class NPCSpriteCache {
  private cache: Map<string, HTMLCanvasElement> = new Map();
  private dimensions: Map<string, SpriteDimensions> = new Map();
  private loading: Map<string, Promise<HTMLCanvasElement | null>> = new Map();
  private failed: Set<string> = new Set();
  private runtimeVariants: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Get a cached sprite or null if not loaded
   */
  get(graphicsId: string): HTMLCanvasElement | null {
    const runtimeVariant = this.runtimeVariants.get(graphicsId);
    if (runtimeVariant) return runtimeVariant;
    return this.cache.get(graphicsId) ?? null;
  }

  /**
   * Get sprite dimensions for a graphics ID
   * Returns expected dimensions from C source if not loaded yet
   */
  getDimensions(graphicsId: string): SpriteDimensions {
    const dims = this.dimensions.get(graphicsId);
    if (dims) return dims;
    // Fall back to expected dimensions from C source
    const expected = getExpectedFrameDimensions(graphicsId);
    return {
      frameWidth: expected.width,
      frameHeight: expected.height,
      totalWidth: expected.width * 9, // Assume 9 frames as default
      totalHeight: expected.height,
    };
  }

  /**
   * Check if a sprite is cached
   */
  has(graphicsId: string): boolean {
    return this.runtimeVariants.has(graphicsId) || this.cache.has(graphicsId);
  }

  /**
   * Check if a sprite failed to load
   */
  hasFailed(graphicsId: string): boolean {
    return this.failed.has(graphicsId);
  }

  /**
   * Load a sprite (async)
   * Applies transparency by making the background color (top-left pixel) transparent
   */
  async load(graphicsId: string): Promise<HTMLCanvasElement | null> {
    const runtimeVariant = this.runtimeVariants.get(graphicsId);
    if (runtimeVariant) {
      return runtimeVariant;
    }

    // Already cached
    if (this.cache.has(graphicsId)) {
      return this.cache.get(graphicsId)!;
    }

    // Already failed
    if (this.failed.has(graphicsId)) {
      return null;
    }

    // Already loading
    if (this.loading.has(graphicsId)) {
      return this.loading.get(graphicsId)!;
    }

    // Get path
    const paths = getNPCSpritePathCandidates(graphicsId);
    if (paths.length === 0) {
      console.warn(`[NPCSpriteCache] No sprite path for ${graphicsId}`);
      this.failed.add(graphicsId);
      return null;
    }

    // Start loading
    const loadPromise = (async () => {
      let loadedPath: string | null = null;
      let canvas: HTMLCanvasElement | null = null;
      for (const path of paths) {
        try {
          canvas = await loadImageCanvasAsset(path, {
            transparency: { type: 'indexed-zero', fallback: { type: 'top-left' } },
          });
          loadedPath = path;
          break;
        } catch {
          // Try next fallback path.
        }
      }

      if (!canvas || !loadedPath) {
        throw new Error('Sprite load failed');
      }

      if (loadedPath !== paths[0]) {
        console.warn(`[NPCSpriteCache] Loaded ${graphicsId} using fallback sprite path: ${loadedPath}`);
      }

      this.cache.set(graphicsId, canvas);

      const expected = getExpectedFrameDimensions(graphicsId);
      this.dimensions.set(graphicsId, {
        frameWidth: expected.width,
        frameHeight: expected.height,
        totalWidth: canvas.width,
        totalHeight: canvas.height,
      });

      this.loading.delete(graphicsId);
      return canvas;
    })()
      .catch(() => {
        console.warn(`[NPCSpriteCache] Failed to load sprite: ${graphicsId} (tried ${paths.join(', ')})`);
        this.failed.add(graphicsId);
        this.loading.delete(graphicsId);
        return null;
      });

    this.loading.set(graphicsId, loadPromise);
    return loadPromise;
  }

  /**
   * Load multiple sprites in parallel
   */
  async loadMany(graphicsIds: string[]): Promise<void> {
    await Promise.all(graphicsIds.map((id) => this.load(id)));
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.dimensions.clear();
    this.loading.clear();
    this.failed.clear();
    this.runtimeVariants.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { cached: number; loading: number; failed: number } {
    return {
      cached: this.cache.size + this.runtimeVariants.size,
      loading: this.loading.size,
      failed: this.failed.size,
    };
  }

  /**
   * Override a sprite at runtime with a pre-rendered variant.
   * Used by scripted palette effects (e.g. Birth Island Deoxys rock).
   */
  setRuntimeSpriteVariant(graphicsId: string, canvas: HTMLCanvasElement): void {
    this.runtimeVariants.set(graphicsId, canvas);
    const expected = getExpectedFrameDimensions(graphicsId);
    this.dimensions.set(graphicsId, {
      frameWidth: expected.width,
      frameHeight: expected.height,
      totalWidth: canvas.width,
      totalHeight: canvas.height,
    });
  }

  /**
   * Clear any runtime sprite override and return to source asset loading.
   */
  clearRuntimeSpriteVariant(graphicsId: string): void {
    this.runtimeVariants.delete(graphicsId);
    this.cache.delete(graphicsId);
    this.dimensions.delete(graphicsId);
    this.failed.delete(graphicsId);
  }

  hasRuntimeSpriteVariant(graphicsId: string): boolean {
    return this.runtimeVariants.has(graphicsId);
  }
}

/** Singleton sprite cache */
export const npcSpriteCache = new NPCSpriteCache();

/**
 * Get frame info for rendering an NPC
 *
 * @param direction The direction the NPC is facing
 * @param isWalking Whether the NPC is walking (for animation)
 * @param walkFrame The current walk animation frame
 * @param graphicsId Optional graphics ID for frame mapping (sprites with non-standard layouts)
 */
export function getNPCFrameInfo(
  direction: 'down' | 'up' | 'left' | 'right',
  isWalking: boolean = false,
  walkFrame: number = 0,
  graphicsId?: string
): { frameIndex: number; flipHorizontal: boolean } {
  // Inanimate/object sprites (e.g. Birth Island triangle) do not have walking frame
  // layouts. Always use a static directional frame so sub-tile movement remains visible.
  if (graphicsId) {
    const spriteInfo = getSpriteInfo(graphicsId);
    if (spriteInfo?.inanimate || (spriteInfo?.frameCount ?? 9) <= 1) {
      const staticFrame = getStaticFrameIndex(graphicsId, direction);
      return {
        frameIndex: staticFrame.frameIndex,
        flipHorizontal: staticFrame.hFlip,
      };
    }
  }

  let logicalFrameIndex: number;
  let flipHorizontal = false;

  if (isWalking) {
    // Walking animation - alternate between walk frames
    // Standard 9-frame layout:
    //   0: down idle, 1: up idle, 2: left idle
    //   3: down walk 1, 4: down walk 2
    //   5: up walk 1, 6: up walk 2
    //   7: left walk 1, 8: left walk 2
    const walkFrameIdx = walkFrame % 2;
    switch (direction) {
      case 'down':
        logicalFrameIndex = walkFrameIdx === 0 ? 3 : 4; // down walk frames
        break;
      case 'up':
        logicalFrameIndex = walkFrameIdx === 0 ? 5 : 6; // up walk frames
        break;
      case 'left':
        logicalFrameIndex = walkFrameIdx === 0 ? 7 : 8; // left walk frames
        break;
      case 'right':
        logicalFrameIndex = walkFrameIdx === 0 ? 7 : 8; // left walk frames (flipped)
        flipHorizontal = true;
        break;
    }
  } else {
    // Standing still
    switch (direction) {
      case 'down':
        logicalFrameIndex = 0;
        break;
      case 'up':
        logicalFrameIndex = 1;
        break;
      case 'left':
        logicalFrameIndex = 2;
        break;
      case 'right':
        logicalFrameIndex = 2;
        flipHorizontal = true;
        break;
    }
  }

  // Apply frame mapping if graphicsId provided (for sprites with non-standard layouts)
  let frameIndex = logicalFrameIndex;
  if (graphicsId) {
    const info = getSpriteInfo(graphicsId);
    if (info?.frameMap && logicalFrameIndex < info.frameMap.length) {
      frameIndex = info.frameMap[logicalFrameIndex];
    }

    // Safety clamp: if a sprite has fewer physical frames than the selected logical frame,
    // fall back to its static directional frame to avoid sampling outside atlas bounds.
    const frameCount = info?.frameCount ?? getMetadataFrameCount(graphicsId);
    if (frameCount > 0 && frameIndex >= frameCount) {
      const staticFrame = getStaticFrameIndex(graphicsId, direction);
      frameIndex = staticFrame.frameIndex;
      flipHorizontal = staticFrame.hFlip;
    }
  }

  return { frameIndex, flipHorizontal };
}

/**
 * Get NPC frame info using auto-generated metadata
 * This is the preferred method when you have the graphics ID
 */
export function getNPCFrameInfoFromMetadata(
  graphicsId: string,
  direction: 'down' | 'up' | 'left' | 'right'
): { frameIndex: number; flipHorizontal: boolean } {
  const result = getStaticFrameIndex(graphicsId, direction);
  return {
    frameIndex: result.frameIndex,
    flipHorizontal: result.hFlip,
  };
}

/**
 * Get the expected frame count for a graphics ID
 */
export function getExpectedFrameCount(graphicsId: string): number {
  return getMetadataFrameCount(graphicsId);
}

/**
 * Get sprite metadata info
 */
export { getSpriteInfo };

/**
 * Calculate source rectangle for a frame in the sprite sheet
 * @param frameIndex The frame index (0-8)
 * @param graphicsId Optional graphics ID to get actual sprite dimensions
 */
export function getNPCFrameRect(
  frameIndex: number,
  graphicsId?: string
): {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
} {
  // Get actual dimensions if graphicsId provided, otherwise use default 16x32
  const dims = graphicsId
    ? npcSpriteCache.getDimensions(graphicsId)
    : {
        frameWidth: 16,
        frameHeight: 32,
      };

  return {
    sx: frameIndex * dims.frameWidth,
    sy: 0,
    sw: dims.frameWidth,
    sh: dims.frameHeight,
  };
}

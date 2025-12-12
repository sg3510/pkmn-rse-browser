/**
 * Parse pokeemerald C source files to generate sprite metadata JSON
 *
 * This script reads:
 * - object_event_graphics_info.h - sprite dimensions, animation table references
 * - object_event_pic_tables.h - frame counts per sprite
 * - object_event_anims.h - animation sequences
 *
 * And outputs a comprehensive sprite-metadata.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POKEEMERALD_PATH = path.join(__dirname, '../public/pokeemerald');
const OUTPUT_PATH = path.join(__dirname, '../src/data/sprite-metadata.json');

interface AnimFrame {
  frameIndex: number;
  duration: number;  // in game ticks (16.67ms each)
  hFlip?: boolean;
  vFlip?: boolean;
}

interface Animation {
  name: string;
  frames: AnimFrame[];
}

interface AnimationTable {
  name: string;
  animations: Record<string, Animation>;
}

interface SpriteMetadata {
  graphicsId: string;
  name: string;
  width: number;
  height: number;
  frameCount: number;
  animationTable: string;
  inanimate: boolean;
  shadowSize: string;
  spritePath?: string;
  frameMap?: number[];  // Maps logical frame index to physical frame in sprite sheet
}

// Standard animation indices
const ANIM_INDICES: Record<string, number> = {
  'ANIM_STD_FACE_SOUTH': 0,
  'ANIM_STD_FACE_NORTH': 1,
  'ANIM_STD_FACE_WEST': 2,
  'ANIM_STD_FACE_EAST': 3,
  'ANIM_STD_GO_SOUTH': 4,
  'ANIM_STD_GO_NORTH': 5,
  'ANIM_STD_GO_WEST': 6,
  'ANIM_STD_GO_EAST': 7,
  'ANIM_STD_GO_FAST_SOUTH': 8,
  'ANIM_STD_GO_FAST_NORTH': 9,
  'ANIM_STD_GO_FAST_WEST': 10,
  'ANIM_STD_GO_FAST_EAST': 11,
  'ANIM_STD_GO_FASTER_SOUTH': 12,
  'ANIM_STD_GO_FASTER_NORTH': 13,
  'ANIM_STD_GO_FASTER_WEST': 14,
  'ANIM_STD_GO_FASTER_EAST': 15,
  'ANIM_STD_GO_FASTEST_SOUTH': 16,
  'ANIM_STD_GO_FASTEST_NORTH': 17,
  'ANIM_STD_GO_FASTEST_WEST': 18,
  'ANIM_STD_GO_FASTEST_EAST': 19,
};

function readFile(relativePath: string): string {
  const fullPath = path.join(POKEEMERALD_PATH, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Parse individual animation commands like:
 * ANIMCMD_FRAME(3, 8)
 * ANIMCMD_FRAME(3, 8, .hFlip = TRUE)
 */
function parseAnimFrame(line: string): AnimFrame | null {
  const match = line.match(/ANIMCMD_FRAME\((\d+),\s*(\d+)(?:,\s*\.hFlip\s*=\s*TRUE)?(?:,\s*\.vFlip\s*=\s*TRUE)?\)/);
  if (!match) return null;

  return {
    frameIndex: parseInt(match[1]),
    duration: parseInt(match[2]),
    hFlip: line.includes('.hFlip = TRUE'),
    vFlip: line.includes('.vFlip = TRUE'),
  };
}

/**
 * Parse animation sequences from object_event_anims.h
 */
function parseAnimations(content: string): Record<string, Animation> {
  const animations: Record<string, Animation> = {};

  // Match animation definitions like: static const union AnimCmd sAnim_GoSouth[] = { ... };
  const animRegex = /static const union AnimCmd (sAnim_\w+)\[\]\s*=\s*\{([^}]+)\}/g;

  let match;
  while ((match = animRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];

    const frames: AnimFrame[] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      if (line.includes('ANIMCMD_FRAME')) {
        const frame = parseAnimFrame(line);
        if (frame) {
          frames.push(frame);
        }
      }
    }

    animations[name] = { name, frames };
  }

  return animations;
}

/**
 * Parse animation tables from object_event_anims.h
 */
function parseAnimationTables(content: string, animations: Record<string, Animation>): Record<string, AnimationTable> {
  const tables: Record<string, AnimationTable> = {};

  // Match table definitions like: static const union AnimCmd *const sAnimTable_Standard[] = { ... };
  const tableRegex = /static const union AnimCmd \*const (sAnimTable_\w+)\[\]\s*=\s*\{([^}]+)\}/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];

    const tableAnims: Record<string, Animation> = {};
    const lines = body.split('\n');

    for (const line of lines) {
      // Match: [ANIM_STD_FACE_SOUTH] = sAnim_FaceSouth,
      const entryMatch = line.match(/\[(\w+)\]\s*=\s*(sAnim_\w+)/);
      if (entryMatch) {
        const animIndex = entryMatch[1];
        const animName = entryMatch[2];
        if (animations[animName]) {
          tableAnims[animIndex] = animations[animName];
        }
      }
    }

    tables[tableName] = { name: tableName, animations: tableAnims };
  }

  return tables;
}

/**
 * Parse graphics info from object_event_graphics_info.h
 */
function parseGraphicsInfo(content: string): SpriteMetadata[] {
  const sprites: SpriteMetadata[] = [];

  // Match struct definitions
  const structRegex = /const struct ObjectEventGraphicsInfo (gObjectEventGraphicsInfo_\w+)\s*=\s*\{([^}]+)\}/g;

  let match;
  while ((match = structRegex.exec(content)) !== null) {
    const fullName = match[1];
    const name = fullName.replace('gObjectEventGraphicsInfo_', '');
    const body = match[2];

    // Parse fields
    const widthMatch = body.match(/\.width\s*=\s*(\d+)/);
    const heightMatch = body.match(/\.height\s*=\s*(\d+)/);
    const inanimateMatch = body.match(/\.inanimate\s*=\s*(\w+)/);
    const shadowMatch = body.match(/\.shadowSize\s*=\s*(\w+)/);
    const animsMatch = body.match(/\.anims\s*=\s*(\w+)/);

    const sprite: SpriteMetadata = {
      graphicsId: `OBJ_EVENT_GFX_${camelToSnake(name).toUpperCase()}`,
      name,
      width: widthMatch ? parseInt(widthMatch[1]) : 16,
      height: heightMatch ? parseInt(heightMatch[1]) : 32,
      frameCount: 9, // Will be updated from pic_tables
      animationTable: animsMatch ? animsMatch[1] : 'sAnimTable_Standard',
      inanimate: inanimateMatch ? inanimateMatch[1] === 'TRUE' : false,
      shadowSize: shadowMatch ? shadowMatch[1] : 'SHADOW_SIZE_M',
    };

    sprites.push(sprite);
  }

  return sprites;
}

/**
 * Parse pic tables to get frame counts and frame mappings
 *
 * The pic table maps logical frame indices (used by animation system)
 * to physical frame indices in the sprite sheet.
 *
 * Example: sPicTable_Wingull maps logical frame 2 to physical frame 4
 * because Wingull's sprite sheet is: down, down_walk, up, up_walk, left, left_walk
 * but standard animations expect: down, up, left, down_walk1, down_walk2, etc.
 */
function parsePicTables(content: string): Record<string, {
  frameCount: number;
  tilesW: number;
  tilesH: number;
  frameMap: number[];  // frameMap[logicalIndex] = physicalIndex
}> {
  const picTables: Record<string, {
    frameCount: number;
    tilesW: number;
    tilesH: number;
    frameMap: number[];
  }> = {};

  // Match: static const struct SpriteFrameImage sPicTable_BrendanNormal[] = { ... };
  const tableRegex = /static const struct SpriteFrameImage (sPicTable_\w+)\[\]\s*=\s*\{([^}]+)\}/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];

    // Parse each overworld_frame entry to get the physical frame index
    // Format: overworld_frame(gObjectEventPic_Name, tilesW, tilesH, physicalFrameIndex)
    const frameMap: number[] = [];
    const frameRegex = /overworld_frame\(\w+,\s*(\d+),\s*(\d+),\s*(\d+)\)/g;
    let frameMatch;
    let tilesW = 2;
    let tilesH = 4;

    while ((frameMatch = frameRegex.exec(body)) !== null) {
      tilesW = parseInt(frameMatch[1]);
      tilesH = parseInt(frameMatch[2]);
      const physicalFrame = parseInt(frameMatch[3]);
      frameMap.push(physicalFrame);
    }

    picTables[tableName] = {
      frameCount: frameMap.length,
      tilesW,
      tilesH,
      frameMap
    };
  }

  return picTables;
}

/**
 * Convert CamelCase to SNAKE_CASE
 */
function camelToSnake(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2');
}

/**
 * Convert name to likely sprite path
 */
function nameToSpritePath(name: string): string {
  const snakeName = name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

  // Handle special cases
  if (snakeName.includes('brendan')) return `/people/brendan/${snakeName.replace('brendan_', '')}.png`;
  if (snakeName.includes('may')) return `/people/may/${snakeName.replace('may_', '')}.png`;
  if (snakeName.includes('aqua_member')) return `/people/team_aqua/${snakeName}.png`;
  if (snakeName.includes('magma_member')) return `/people/team_magma/${snakeName}.png`;
  if (snakeName.includes('archie')) return `/people/team_aqua/archie.png`;
  if (snakeName.includes('maxie')) return `/people/team_magma/maxie.png`;

  // Gym leaders
  const gymLeaders = ['roxanne', 'brawly', 'wattson', 'flannery', 'norman', 'winona', 'liza', 'tate', 'juan', 'wallace'];
  for (const leader of gymLeaders) {
    if (snakeName === leader) return `/people/gym_leaders/${leader}.png`;
  }

  // Elite Four
  const eliteFour = ['sidney', 'phoebe', 'glacia', 'drake'];
  for (const member of eliteFour) {
    if (snakeName === member) return `/people/elite_four/${member}.png`;
  }

  // Frontier Brains
  const frontierBrains = ['anabel', 'brandon', 'greta', 'lucy', 'noland', 'spenser', 'tucker'];
  for (const brain of frontierBrains) {
    if (snakeName === brain) return `/people/frontier_brains/${brain}.png`;
  }

  // Pokemon
  const pokemonNames = ['pikachu', 'kecleon', 'zigzagoon', 'poochyena', 'wingull', 'azurill', 'skitty',
                         'kyogre', 'groudon', 'rayquaza', 'latias', 'latios', 'deoxys', 'mew', 'ho_oh',
                         'lugia', 'sudowoodo', 'azumarill', 'kirlia', 'vigoroth', 'dusclops'];
  for (const pokemon of pokemonNames) {
    if (snakeName.includes(pokemon)) return `/pokemon/${pokemon}.png`;
  }

  return `/people/${snakeName}.png`;
}

// Main execution
function main() {
  console.log('Parsing pokeemerald sprite metadata...\n');

  // Read source files
  const graphicsInfoContent = readFile('src/data/object_events/object_event_graphics_info.h');
  const picTablesContent = readFile('src/data/object_events/object_event_pic_tables.h');
  const animsContent = readFile('src/data/object_events/object_event_anims.h');

  // Parse animations
  console.log('Parsing animations...');
  const animations = parseAnimations(animsContent);
  console.log(`  Found ${Object.keys(animations).length} animations`);

  // Parse animation tables
  console.log('Parsing animation tables...');
  const animationTables = parseAnimationTables(animsContent, animations);
  console.log(`  Found ${Object.keys(animationTables).length} animation tables`);

  // Parse graphics info
  console.log('Parsing graphics info...');
  const sprites = parseGraphicsInfo(graphicsInfoContent);
  console.log(`  Found ${sprites.length} sprites`);

  // Parse pic tables for frame counts
  console.log('Parsing pic tables...');
  const picTables = parsePicTables(picTablesContent);
  console.log(`  Found ${Object.keys(picTables).length} pic tables`);

  // Update sprites with frame counts, frame maps, and paths
  for (const sprite of sprites) {
    const picTableName = `sPicTable_${sprite.name}`;
    if (picTables[picTableName]) {
      sprite.frameCount = picTables[picTableName].frameCount;
      // Only include frameMap if it's non-trivial (not just 0,1,2,3,4...)
      const frameMap = picTables[picTableName].frameMap;
      const isNonTrivial = frameMap.some((physicalIdx, logicalIdx) => physicalIdx !== logicalIdx);
      if (isNonTrivial) {
        sprite.frameMap = frameMap;
      }
    }
    sprite.spritePath = nameToSpritePath(sprite.name);
  }

  // Build output
  const output = {
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      'object_event_graphics_info.h',
      'object_event_pic_tables.h',
      'object_event_anims.h'
    ],
    animationIndices: ANIM_INDICES,
    animations: Object.fromEntries(
      Object.entries(animations).map(([k, v]) => [k, v.frames])
    ),
    animationTables: Object.fromEntries(
      Object.entries(animationTables).map(([k, v]) => [
        k,
        Object.fromEntries(
          Object.entries(v.animations).map(([ak, av]) => [ak, av.name])
        )
      ])
    ),
    sprites: Object.fromEntries(
      sprites.map(s => [s.graphicsId, s])
    ),
  };

  // Write output
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\nOutput written to ${OUTPUT_PATH}`);
  console.log(`  Total sprites: ${sprites.length}`);
  console.log(`  Total animations: ${Object.keys(animations).length}`);
  console.log(`  Total animation tables: ${Object.keys(animationTables).length}`);
}

main();

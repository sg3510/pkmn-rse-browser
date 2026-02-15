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

interface AffineCommandFrame {
  type: 'FRAME';
  xScale: number;
  yScale: number;
  rotation: number;
  duration: number;
}

interface AffineCommandLoop {
  type: 'LOOP';
  count: number;
}

interface AffineCommandJump {
  type: 'JUMP';
  target: number;
}

interface AffineCommandEnd {
  type: 'END';
}

type AffineCommand = AffineCommandFrame | AffineCommandLoop | AffineCommandJump | AffineCommandEnd;

interface AffineAnimation {
  name: string;
  commands: AffineCommand[];
}

interface AffineAnimationTable {
  name: string;
  animations: string[];
}

interface SpriteMetadata {
  graphicsId: string;
  name: string;
  width: number;
  height: number;
  frameCount: number;
  animationTable: string;
  affineAnimationTable?: string;
  inanimate: boolean;
  shadowSize: string;
  spritePath?: string;
  frameMap?: number[];  // Maps logical frame index to physical frame in sprite sheet
}

interface GraphicsInfoEntry {
  infoSymbol: string;
  name: string;
  width: number;
  height: number;
  animationTable: string;
  affineAnimationTable: string;
  inanimate: boolean;
  shadowSize: string;
  imageTable: string;
}

interface PicTableData {
  frameCount: number;
  frameMap: number[];
  picSymbols: string[];
  primaryPicSymbol?: string;
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

const TABLE_KEY_CONSTANTS: Record<string, number> = {
  ...ANIM_INDICES,
  BERRY_STAGE_NO_BERRY: 0,
  BERRY_STAGE_PLANTED: 1,
  BERRY_STAGE_SPROUTED: 2,
  BERRY_STAGE_TALLER: 3,
  BERRY_STAGE_FLOWERING: 4,
  BERRY_STAGE_BERRIES: 5,
  BERRY_STAGE_SPARKLING: 255,
};

function resolveTableKey(rawKey: string): string {
  const key = rawKey.trim();

  if (key in ANIM_INDICES) {
    return key;
  }

  const arithmeticMatch = key.match(/^([A-Z0-9_]+)\s*([+-])\s*(\d+)$/);
  if (arithmeticMatch) {
    const lhs = TABLE_KEY_CONSTANTS[arithmeticMatch[1]];
    if (typeof lhs === 'number') {
      const rhs = parseInt(arithmeticMatch[3], 10);
      const value = arithmeticMatch[2] === '-' ? lhs - rhs : lhs + rhs;
      return String(value);
    }
  }

  return key;
}

function readFile(relativePath: string): string {
  const fullPath = path.join(POKEEMERALD_PATH, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

function parseCInteger(raw: string): number {
  const trimmed = raw.trim();
  const sign = trimmed.startsWith('-') ? -1 : 1;
  const unsigned = trimmed.replace(/^[+-]/, '');

  if (/^0x/i.test(unsigned)) {
    return sign * parseInt(unsigned, 16);
  }
  return sign * parseInt(unsigned, 10);
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
      // Match entries such as:
      // [ANIM_STD_FACE_SOUTH] = sAnim_FaceSouth,
      // [BERRY_STAGE_PLANTED - 1] = sAnim_BerryTreeStage0,
      const entryMatch = line.match(/\[(.+?)\]\s*=\s*(sAnim_\w+)/);
      if (entryMatch) {
        const animIndex = resolveTableKey(entryMatch[1]);
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

function parseAffineAnimations(content: string): Record<string, AffineAnimation> {
  const animations: Record<string, AffineAnimation> = {};

  const affineRegex = /static const union AffineAnimCmd (sAffineAnim_\w+)\[\]\s*=\s*\{([\s\S]*?)\};/g;

  let match;
  while ((match = affineRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const commands: AffineCommand[] = [];

    const lines = body.split('\n').map((line) => line.trim());
    for (const line of lines) {
      const frameMatch = line.match(
        /AFFINEANIMCMD_FRAME\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/
      );
      if (frameMatch) {
        commands.push({
          type: 'FRAME',
          xScale: parseCInteger(frameMatch[1]),
          yScale: parseCInteger(frameMatch[2]),
          rotation: parseCInteger(frameMatch[3]),
          duration: parseCInteger(frameMatch[4]),
        });
        continue;
      }

      const loopMatch = line.match(/AFFINEANIMCMD_LOOP\(\s*([^)]+)\s*\)/);
      if (loopMatch) {
        commands.push({
          type: 'LOOP',
          count: parseCInteger(loopMatch[1]),
        });
        continue;
      }

      const jumpMatch = line.match(/AFFINEANIMCMD_JUMP\(\s*([^)]+)\s*\)/);
      if (jumpMatch) {
        commands.push({
          type: 'JUMP',
          target: parseCInteger(jumpMatch[1]),
        });
        continue;
      }

      if (line.includes('AFFINEANIMCMD_END')) {
        commands.push({ type: 'END' });
      }
    }

    animations[name] = { name, commands };
  }

  return animations;
}

function parseAffineAnimationTables(content: string): Record<string, AffineAnimationTable> {
  const tables: Record<string, AffineAnimationTable> = {};

  const tableRegex = /static const union AffineAnimCmd \*const (sAffineAnimTable_\w+)\[\]\s*=\s*\{([\s\S]*?)\};/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const animations: string[] = [];

    const lines = body.split('\n').map((line) => line.trim());
    for (const line of lines) {
      const entryMatch = line.match(/^(sAffineAnim_\w+)\s*,/);
      if (entryMatch) {
        animations.push(entryMatch[1]);
      }
    }

    tables[name] = { name, animations };
  }

  return tables;
}

/**
 * Parse graphics-info structs from object_event_graphics_info.h.
 *
 * C reference:
 * - public/pokeemerald/src/data/object_events/object_event_graphics_info.h
 */
function parseGraphicsInfo(content: string): Record<string, GraphicsInfoEntry> {
  const infos: Record<string, GraphicsInfoEntry> = {};

  const structRegex = /const struct ObjectEventGraphicsInfo (gObjectEventGraphicsInfo_\w+)\s*=\s*\{([\s\S]*?)\};/g;

  let match;
  while ((match = structRegex.exec(content)) !== null) {
    const infoSymbol = match[1];
    const name = infoSymbol.replace('gObjectEventGraphicsInfo_', '');
    const body = match[2];

    const widthMatch = body.match(/\.width\s*=\s*(\d+)/);
    const heightMatch = body.match(/\.height\s*=\s*(\d+)/);
    const inanimateMatch = body.match(/\.inanimate\s*=\s*(\w+)/);
    const shadowMatch = body.match(/\.shadowSize\s*=\s*(\w+)/);
    const animsMatch = body.match(/\.anims\s*=\s*(\w+)/);
    const affineAnimsMatch = body.match(/\.affineAnims\s*=\s*(\w+)/);
    const imagesMatch = body.match(/\.images\s*=\s*(\w+)/);

    infos[infoSymbol] = {
      infoSymbol,
      name,
      width: widthMatch ? parseInt(widthMatch[1], 10) : 16,
      height: heightMatch ? parseInt(heightMatch[1], 10) : 32,
      animationTable: animsMatch ? animsMatch[1] : 'sAnimTable_Standard',
      affineAnimationTable: affineAnimsMatch ? affineAnimsMatch[1] : 'gDummySpriteAffineAnimTable',
      inanimate: inanimateMatch ? inanimateMatch[1] === 'TRUE' : false,
      shadowSize: shadowMatch ? shadowMatch[1] : 'SHADOW_SIZE_M',
      imageTable: imagesMatch ? imagesMatch[1] : '',
    };
  }

  return infos;
}

/**
 * Parse graphics-ID -> graphics-info symbol pointers.
 *
 * C reference:
 * - public/pokeemerald/src/data/object_events/object_event_graphics_info_pointers.h
 */
function parseGraphicsInfoPointers(content: string): Record<string, string> {
  const pointers: Record<string, string> = {};
  const pointerRegex = /\[(OBJ_EVENT_GFX_[A-Z0-9_]+)\]\s*=\s*&?(gObjectEventGraphicsInfo_\w+)/g;

  let match;
  while ((match = pointerRegex.exec(content)) !== null) {
    const graphicsId = match[1];
    const infoSymbol = match[2];
    pointers[graphicsId] = infoSymbol;
  }

  return pointers;
}

/**
 * Parse object-event picture symbols -> runtime PNG paths.
 *
 * C reference:
 * - public/pokeemerald/src/data/object_events/object_event_graphics.h
 */
function parseObjectEventPicPaths(content: string): Record<string, string> {
  const pathMap: Record<string, string> = {};
  const picRegex = /const u32 (gObjectEventPic_\w+)\[\]\s*=\s*INCBIN_U32\("([^"]+)"\);/g;

  let match;
  while ((match = picRegex.exec(content)) !== null) {
    const picSymbol = match[1];
    const incbinPath = match[2];

    if (!incbinPath.startsWith('graphics/object_events/pics/')) {
      continue;
    }
    if (!incbinPath.endsWith('.4bpp')) {
      continue;
    }

    const relative = incbinPath
      .replace('graphics/object_events/pics/', '')
      .replace(/\.4bpp$/, '.png');
    pathMap[picSymbol] = `/${relative}`;
  }

  return pathMap;
}

/**
 * Parse sPicTable_* entries from pic-table headers.
 *
 * C references:
 * - public/pokeemerald/src/data/object_events/object_event_pic_tables.h
 * - public/pokeemerald/src/data/object_events/berry_tree_graphics_tables.h
 */
function parsePicTables(content: string, existing: Record<string, PicTableData> = {}): Record<string, PicTableData> {
  const picTables = existing;
  const tableRegex = /static const struct SpriteFrameImage (sPicTable_\w+)\[\]\s*=\s*\{([\s\S]*?)\};/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const frameMap: number[] = [];
    const picSymbols: string[] = [];

    const lines = body.split('\n').map((line) => line.trim());
    for (const line of lines) {
      const overworldFrameMatch = line.match(
        /overworld_frame\((gObjectEventPic_\w+),\s*\d+,\s*\d+,\s*(\d+)\)/
      );
      if (overworldFrameMatch) {
        picSymbols.push(overworldFrameMatch[1]);
        frameMap.push(parseInt(overworldFrameMatch[2], 10));
        continue;
      }

      const objFrameTilesMatch = line.match(/obj_frame_tiles\((gObjectEventPic_\w+)\)/);
      if (objFrameTilesMatch) {
        picSymbols.push(objFrameTilesMatch[1]);
        // obj_frame_tiles implies one full-frame image in-order.
        frameMap.push(frameMap.length);
      }
    }

    let primaryPicSymbol: string | undefined;
    if (picSymbols.length > 0) {
      const counts = new Map<string, number>();
      let maxCount = 0;
      for (const symbol of picSymbols) {
        const nextCount = (counts.get(symbol) ?? 0) + 1;
        counts.set(symbol, nextCount);
        if (nextCount > maxCount) {
          maxCount = nextCount;
          primaryPicSymbol = symbol;
        }
      }
    }

    picTables[tableName] = {
      frameCount: frameMap.length,
      frameMap,
      picSymbols,
      primaryPicSymbol,
    };
  }

  return picTables;
}

function resolveSpritePathFromImageTable(
  imageTable: string,
  picTables: Record<string, PicTableData>,
  picPaths: Record<string, string>
): string | undefined {
  const table = picTables[imageTable];
  if (!table) return undefined;

  if (table.primaryPicSymbol && picPaths[table.primaryPicSymbol]) {
    return picPaths[table.primaryPicSymbol];
  }

  for (const symbol of table.picSymbols) {
    const resolved = picPaths[symbol];
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

// Main execution
function main() {
  console.log('Parsing pokeemerald sprite metadata...\n');

  // Read source files
  const graphicsInfoContent = readFile('src/data/object_events/object_event_graphics_info.h');
  const graphicsInfoPointersContent = readFile('src/data/object_events/object_event_graphics_info_pointers.h');
  const objectEventGraphicsContent = readFile('src/data/object_events/object_event_graphics.h');
  const picTablesContent = readFile('src/data/object_events/object_event_pic_tables.h');
  const berryTreePicTablesContent = readFile('src/data/object_events/berry_tree_graphics_tables.h');
  const animsContent = readFile('src/data/object_events/object_event_anims.h');

  // Parse animations
  console.log('Parsing animations...');
  const animations = parseAnimations(animsContent);
  console.log(`  Found ${Object.keys(animations).length} animations`);

  // Parse animation tables
  console.log('Parsing animation tables...');
  const animationTables = parseAnimationTables(animsContent, animations);
  console.log(`  Found ${Object.keys(animationTables).length} animation tables`);

  // Parse affine animations
  console.log('Parsing affine animations...');
  const affineAnimations = parseAffineAnimations(animsContent);
  console.log(`  Found ${Object.keys(affineAnimations).length} affine animations`);

  // Parse affine animation tables
  console.log('Parsing affine animation tables...');
  const affineAnimationTables = parseAffineAnimationTables(animsContent);
  console.log(`  Found ${Object.keys(affineAnimationTables).length} affine animation tables`);

  // Parse graphics-info structs and pointer table
  console.log('Parsing graphics info...');
  const graphicsInfos = parseGraphicsInfo(graphicsInfoContent);
  const graphicsPointers = parseGraphicsInfoPointers(graphicsInfoPointersContent);
  console.log(`  Found ${Object.keys(graphicsInfos).length} graphics-info structs`);
  console.log(`  Found ${Object.keys(graphicsPointers).length} graphics ID pointers`);

  // Parse picture symbols -> paths from object_event_graphics.h
  console.log('Parsing object-event picture paths...');
  const objectEventPicPaths = parseObjectEventPicPaths(objectEventGraphicsContent);
  console.log(`  Found ${Object.keys(objectEventPicPaths).length} object-event picture symbols`);

  // Parse pic tables for frame counts/frame maps and image-symbol references
  console.log('Parsing pic tables...');
  const picTables = parsePicTables(
    berryTreePicTablesContent,
    parsePicTables(picTablesContent)
  );
  console.log(`  Found ${Object.keys(picTables).length} pic tables`);

  // Build final sprite metadata using authoritative pointer mapping:
  // OBJ_EVENT_GFX_* -> gObjectEventGraphicsInfo_* -> sPicTable_* -> gObjectEventPic_* -> path
  const sprites: SpriteMetadata[] = [];
  const unresolvedPathIds: string[] = [];
  for (const [graphicsId, infoSymbol] of Object.entries(graphicsPointers)) {
    const info = graphicsInfos[infoSymbol];
    if (!info) {
      continue;
    }

    const sprite: SpriteMetadata = {
      graphicsId,
      name: info.name,
      width: info.width,
      height: info.height,
      frameCount: 9,
      animationTable: info.animationTable,
      affineAnimationTable: info.affineAnimationTable,
      inanimate: info.inanimate,
      shadowSize: info.shadowSize,
    };

    const picTable = picTables[info.imageTable];
    if (picTable && picTable.frameCount > 0) {
      sprite.frameCount = picTable.frameCount;
      const isNonTrivial = picTable.frameMap.some((physicalIdx, logicalIdx) => physicalIdx !== logicalIdx);
      if (isNonTrivial) {
        sprite.frameMap = picTable.frameMap;
      }
    }

    sprite.spritePath = resolveSpritePathFromImageTable(info.imageTable, picTables, objectEventPicPaths);
    if (!sprite.spritePath) {
      unresolvedPathIds.push(graphicsId);
    }

    sprites.push(sprite);
  }

  if (unresolvedPathIds.length > 0) {
    console.warn(
      `[WARN] Could not resolve sprite paths for ${unresolvedPathIds.length} graphics IDs (first 10): ` +
      unresolvedPathIds.slice(0, 10).join(', ')
    );
  }

  // Build output
  const output = {
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      'object_event_graphics_info.h',
      'object_event_graphics_info_pointers.h',
      'object_event_graphics.h',
      'object_event_pic_tables.h',
      'berry_tree_graphics_tables.h',
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
    affineAnimations: Object.fromEntries(
      Object.entries(affineAnimations).map(([k, v]) => [k, v.commands])
    ),
    affineAnimationTables: Object.fromEntries(
      Object.entries(affineAnimationTables).map(([k, v]) => [k, v.animations])
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
  console.log(`  Total affine animations: ${Object.keys(affineAnimations).length}`);
  console.log(`  Total affine animation tables: ${Object.keys(affineAnimationTables).length}`);
}

main();

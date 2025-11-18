import { loadTilesetImage } from './mapLoader';

export interface AnimationFrame {
  image: Uint8Array;
  duration: number; // in frames (approx 16ms each)
}

export interface TileAnimation {
  destinationTileId: number; // The tile ID in the tileset to overwrite
  frames: string[]; // Paths to the frame images
  sequence: number[]; // Sequence of frame indices to play
  interval: number; // How many game frames to wait before advancing
}

export interface LoadedAnimation {
  destinationTileId: number;
  frames: Uint8Array[];
  sequence: number[];
  interval: number;
  timer: number;
  currentSequenceIndex: number;
  framesWidth: number; // Assume all frames have same dimensions
}

// Definition from tileset_anims.c
export const GENERAL_TILESET_ANIMATIONS: TileAnimation[] = [
  {
    destinationTileId: 508, // BG_VRAM + TILE_OFFSET_4BPP(508)
    frames: [
      'data/tilesets/primary/general/anim/flower/0.png',
      'data/tilesets/primary/general/anim/flower/1.png',
      'data/tilesets/primary/general/anim/flower/2.png',
    ],
    sequence: [0, 1, 0, 2], // gTilesetAnims_General_Flower
    interval: 16, // timer % 16 == 0
  }
];

export async function loadAnimationResources(
  animations: TileAnimation[], 
  projectRoot: string
): Promise<LoadedAnimation[]> {
  const loaded: LoadedAnimation[] = [];

  for (const anim of animations) {
    const frameImages: Uint8Array[] = [];
    let width = 16; // Default fallback
    for (const path of anim.frames) {
      // We need to know the width of the loaded image to determine stride.
      // loadTilesetImage returns Uint8Array, we lose dimensions.
      // But for 16x16 flower animations, we know it's 16.
      // We should probably update loadTilesetImage to return dimensions or just assume based on file size?
      // 16x16 = 256 bytes.
      // 8x8 = 64 bytes.
      // For now, let's hardcode 16 for flowers or infer from length.
      const imgData = await loadTilesetImage(`${projectRoot}/${path}`);
      frameImages.push(imgData);
      
      if (imgData.length === 256) width = 16;
      else if (imgData.length === 64) width = 8;
      else width = 16; // Assumption
    }
    loaded.push({
      destinationTileId: anim.destinationTileId,
      frames: frameImages,
      sequence: anim.sequence,
      interval: anim.interval,
      timer: 0,
      currentSequenceIndex: 0,
      framesWidth: width
    });
  }

  return loaded;
}

// Updates the animation state and returns true if any tile changed
export function updateAnimations(animations: LoadedAnimation[]): boolean {
  let changed = false;
  for (const anim of animations) {
    anim.timer++;
    if (anim.timer >= anim.interval) {
      anim.timer = 0;
      anim.currentSequenceIndex = (anim.currentSequenceIndex + 1) % anim.sequence.length;
      changed = true;
    }
  }
  return changed;
}

// Helper to copy an 8x8 tile from source image to dest image
function copyTile(
  src: Uint8Array, srcX: number, srcY: number, srcStride: number, 
  dest: Uint8Array, destX: number, destY: number, destStride: number
) {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const val = src[(srcY + y) * srcStride + (srcX + x)];
      dest[(destY + y) * destStride + (destX + x)] = val;
    }
  }
}

// Apply current animation frames to the tileset data
// tileset is 128px wide (stride 128)
export function applyAnimationsToTileset(
  tileset: Uint8Array, 
  animations: LoadedAnimation[]
) {
  const DEST_STRIDE = 128;
  const DEST_TILES_PER_ROW = 16;

  for (const anim of animations) {
    const frameIndex = anim.sequence[anim.currentSequenceIndex];
    const frameData = anim.frames[frameIndex];
    const srcStride = anim.framesWidth;
    
    // Calculate how many tiles are in the source frame
    const numTilesX = srcStride / 8;
    const numTilesY = (frameData.length / srcStride) / 8;
    
    // We assume the destination tiles are sequential in ID.
    // Source tiles are read in raster order (row by row of tiles).
    
    let currentDestId = anim.destinationTileId;
    
    for (let ty = 0; ty < numTilesY; ty++) {
      for (let tx = 0; tx < numTilesX; tx++) {
        // Source Coordinates
        const sx = tx * 8;
        const sy = ty * 8;
        
        // Destination Coordinates
        const dx = (currentDestId % DEST_TILES_PER_ROW) * 8;
        const dy = Math.floor(currentDestId / DEST_TILES_PER_ROW) * 8;
        
        copyTile(frameData, sx, sy, srcStride, tileset, dx, dy, DEST_STRIDE);
        
        currentDestId++;
      }
    }
  }
}

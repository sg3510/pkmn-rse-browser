/**
 * TilesetUploader - GPU Tileset Management
 *
 * Handles uploading tileset data to the WebGL pipeline.
 * This includes combining palettes and uploading to the correct GPU slots.
 */

import type { Palette } from '../../utils/mapLoader';
import type { WorldSnapshot, TilesetPairInfo } from '../../game/WorldManager';
import type { WebGLRenderPipeline } from './WebGLRenderPipeline';

// =============================================================================
// Constants
// =============================================================================

/** Number of palettes from primary tileset (0-5) */
const NUM_PALS_IN_PRIMARY = 6;

/** Total number of palettes used (0-12) */
const NUM_PALS_TOTAL = 13;

// =============================================================================
// Palette Combination
// =============================================================================

/**
 * Combine primary (0-5) and secondary (6-12) palettes into a single GPU palette array.
 *
 * The GBA uses 13 palettes for backgrounds:
 * - Palettes 0-5 come from the primary tileset
 * - Palettes 6-12 come from the secondary tileset
 *
 * This function produces a 16-palette array for GPU upload, filling
 * unused slots (13-15) with black.
 *
 * @param primaryPalettes - Palettes from primary tileset
 * @param secondaryPalettes - Palettes from secondary tileset
 * @returns Combined palette array for GPU upload
 */
export function combineTilesetPalettes(
  primaryPalettes: Palette[],
  secondaryPalettes: Palette[]
): Palette[] {
  const combined: Palette[] = [];

  // Primary palettes (0-5)
  for (let i = 0; i < NUM_PALS_IN_PRIMARY; i++) {
    combined.push(primaryPalettes[i] || { colors: Array(16).fill('#000000') });
  }

  // Secondary palettes (6-12)
  for (let i = NUM_PALS_IN_PRIMARY; i < NUM_PALS_TOTAL; i++) {
    combined.push(secondaryPalettes[i - NUM_PALS_IN_PRIMARY] || { colors: Array(16).fill('#000000') });
  }

  // Fill remaining slots (13-15) with black
  for (let i = NUM_PALS_TOTAL; i < 16; i++) {
    combined.push({ colors: Array(16).fill('#000000') });
  }

  return combined;
}

// =============================================================================
// Tileset Upload
// =============================================================================

/**
 * Upload tilesets from a WorldSnapshot to the WebGL pipeline.
 *
 * This function handles the GPU slot mapping:
 * - Each tileset pair is assigned to GPU slot 0 or 1
 * - The mapping is stored in snapshot.pairIdToGpuSlot
 * - Tilesets not in the current 2-slot window are skipped
 *
 * @param pipeline - The WebGL render pipeline
 * @param snapshot - World snapshot containing tileset pairs and GPU slot mapping
 */
export function uploadTilesetsFromSnapshot(
  pipeline: WebGLRenderPipeline,
  snapshot: WorldSnapshot
): void {
  const { tilesetPairs, pairIdToGpuSlot } = snapshot;

  console.log('[TILESET_UPLOAD] ========== UPLOADING TILESETS ==========');
  console.log('[TILESET_UPLOAD] Tileset pairs:', tilesetPairs.map(p => p.id));
  console.log('[TILESET_UPLOAD] GPU slot mapping:', Object.fromEntries(pairIdToGpuSlot));

  // Upload tilesets based on pairIdToGpuSlot mapping, not array index!
  // This ensures GPU textures match what the scheduler/resolver expects
  for (const pair of tilesetPairs) {
    const gpuSlot = pairIdToGpuSlot.get(pair.id);
    console.log(
      `[TILESET_UPLOAD] Pair ${pair.id}: gpuSlot=${gpuSlot}, ` +
      `primarySize=${pair.primaryImage.width}x${pair.primaryImage.height}, ` +
      `secondarySize=${pair.secondaryImage.width}x${pair.secondaryImage.height}`
    );

    if (gpuSlot === 0) {
      console.log(`[TILESET_UPLOAD] Uploading ${pair.id} to GPU SLOT 0`);
      uploadToSlot0(pipeline, pair);
    } else if (gpuSlot === 1) {
      console.log(`[TILESET_UPLOAD] Uploading ${pair.id} to GPU SLOT 1`);
      uploadToSlot1(pipeline, pair);
    } else {
      console.log(`[TILESET_UPLOAD] Pair ${pair.id} NOT in GPU (slot=${gpuSlot})`);
    }
  }
  console.log('[TILESET_UPLOAD] ========== UPLOAD COMPLETE ==========');
}

/**
 * Upload a tileset pair to GPU slot 0 (primary slot)
 */
function uploadToSlot0(pipeline: WebGLRenderPipeline, pair: TilesetPairInfo): void {
  pipeline.uploadTilesets(
    pair.primaryImage.data,
    pair.primaryImage.width,
    pair.primaryImage.height,
    pair.secondaryImage.data,
    pair.secondaryImage.width,
    pair.secondaryImage.height,
    pair.animations
  );
  pipeline.uploadPalettes(combineTilesetPalettes(pair.primaryPalettes, pair.secondaryPalettes));
}

/**
 * Upload a tileset pair to GPU slot 1 (secondary slot)
 */
function uploadToSlot1(pipeline: WebGLRenderPipeline, pair: TilesetPairInfo): void {
  pipeline.uploadTilesetsPair1(
    pair.primaryImage.data,
    pair.primaryImage.width,
    pair.primaryImage.height,
    pair.secondaryImage.data,
    pair.secondaryImage.width,
    pair.secondaryImage.height,
    pair.animations
  );
  pipeline.uploadPalettesPair1(combineTilesetPalettes(pair.primaryPalettes, pair.secondaryPalettes));
}

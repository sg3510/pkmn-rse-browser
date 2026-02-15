/**
 * Berry tree sprite resolver.
 *
 * C references:
 * - public/pokeemerald/src/event_object_movement.c (SetBerryTreeGraphics)
 * - public/pokeemerald/src/data/object_events/berry_tree_graphics_tables.h
 */

import {
  getBerryTreeFrameSource,
  getBerryTreeGraphicsIdForStage,
  getBerryTreeRenderConfig,
  getSpriteAnimationFrames,
} from '../data/spriteMetadata.ts';
import { BERRY_STAGE, berryTypeToItemId } from '../game/berry/berryConstants.ts';

const DEFAULT_BERRY_ITEM_ID = 133;
const BERRY_TREE_ATLAS_PREFIX = 'berry-tree';
const BERRY_TREE_ASSET_ROOT = '/pokeemerald/graphics/object_events/pics';
const METATILE_SIZE = 16;

const BERRY_TREE_GRAPHICS_IDS = new Set<string>([
  'OBJ_EVENT_GFX_BERRY_TREE',
  'OBJ_EVENT_GFX_BERRY_TREE_EARLY_STAGES',
  'OBJ_EVENT_GFX_BERRY_TREE_LATE_STAGES',
]);

export interface BerryTreeAtlasDescriptor {
  atlasName: string;
  spritePath: string;
  assetPath: string;
  frameWidth: number;
  frameHeight: number;
}

export interface BerryTreeResolvedSpriteFrame {
  atlasName: string;
  spritePath: string;
  assetPath: string;
  atlasX: number;
  atlasY: number;
  atlasWidth: number;
  atlasHeight: number;
  width: number;
  height: number;
  flipX: boolean;
  logicalFrameIndex: number;
  stageGraphicsId: string;
}

export interface BerryTreePlacement {
  worldX: number;
  worldY: number;
  feetY: number;
}

function sanitizeAtlasSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
}

function normalizeBerryStage(stage: number): number {
  const normalized = Math.trunc(stage);
  if (normalized === BERRY_STAGE.SPARKLING) {
    return BERRY_STAGE.BERRIES;
  }
  return normalized;
}

export function isBerryTreeGraphicsId(graphicsId: string): boolean {
  return BERRY_TREE_GRAPHICS_IDS.has(graphicsId);
}

export function getBerryTreeAtlasNameForSpritePath(spritePath: string): string {
  return `${BERRY_TREE_ATLAS_PREFIX}-${sanitizeAtlasSegment(spritePath)}`;
}

export function getBerryTreeAssetPath(spritePath: string): string {
  return `${BERRY_TREE_ASSET_ROOT}${spritePath}`;
}

export function getBerryTreeAnimIndexForStage(stage: number): number | null {
  const normalizedStage = normalizeBerryStage(stage);
  if (normalizedStage <= BERRY_STAGE.NO_BERRY) {
    return null;
  }
  if (normalizedStage === BERRY_STAGE.PLANTED) return 0;
  if (normalizedStage === BERRY_STAGE.SPROUTED) return 1;
  if (normalizedStage === BERRY_STAGE.TALLER) return 2;
  if (normalizedStage === BERRY_STAGE.FLOWERING) return 3;
  return 4;
}

export function resolveBerryTreeSpriteFrame(
  berryType: number,
  stage: number
): BerryTreeResolvedSpriteFrame | null {
  const animIndex = getBerryTreeAnimIndexForStage(stage);
  if (animIndex === null) {
    return null;
  }

  const normalizedStage = normalizeBerryStage(stage);
  const stageGraphicsId = getBerryTreeGraphicsIdForStage(normalizedStage);
  const animationFrames = getSpriteAnimationFrames(stageGraphicsId, animIndex);
  if (animationFrames.length === 0) {
    return null;
  }

  const selectedFrame = animationFrames[0];
  const berryItemId = berryTypeToItemId(berryType);
  const frameSource = getBerryTreeFrameSource(berryItemId, selectedFrame.frameIndex)
    ?? getBerryTreeFrameSource(DEFAULT_BERRY_ITEM_ID, selectedFrame.frameIndex);
  if (!frameSource) {
    return null;
  }

  return {
    atlasName: getBerryTreeAtlasNameForSpritePath(frameSource.spritePath),
    spritePath: frameSource.spritePath,
    assetPath: getBerryTreeAssetPath(frameSource.spritePath),
    atlasX: frameSource.sourceFrame * frameSource.frameWidth,
    atlasY: 0,
    atlasWidth: frameSource.frameWidth,
    atlasHeight: frameSource.frameHeight,
    width: frameSource.frameWidth,
    height: frameSource.frameHeight,
    flipX: selectedFrame.hFlip ?? false,
    logicalFrameIndex: selectedFrame.frameIndex,
    stageGraphicsId,
  };
}

/**
 * Resolve berry sprite placement from object-event tile coordinates.
 *
 * C parity reference:
 * - public/pokeemerald/src/event_object_movement.c (ObjectEventSetGraphicsId)
 *   sprite->y += 16 + sprite->centerToCornerVecY
 * For top-left rendering this is equivalent to: worldY = tileY * 16 + 16 - spriteHeight.
 */
export function resolveBerryTreePlacement(
  tileX: number,
  tileY: number,
  frame: { width: number; height: number }
): BerryTreePlacement {
  const worldX = tileX * METATILE_SIZE + Math.floor((METATILE_SIZE - frame.width) / 2);
  const worldY = tileY * METATILE_SIZE + METATILE_SIZE - frame.height;
  return {
    worldX,
    worldY,
    feetY: worldY + frame.height,
  };
}

export function listBerryTreeAtlasDescriptors(): BerryTreeAtlasDescriptor[] {
  const config = getBerryTreeRenderConfig();
  const descriptorsByPath = new Map<string, BerryTreeAtlasDescriptor>();

  for (const sources of Object.values(config.picTableFrameSources)) {
    for (const source of sources) {
      const existing = descriptorsByPath.get(source.spritePath);
      if (existing) {
        continue;
      }
      descriptorsByPath.set(source.spritePath, {
        atlasName: getBerryTreeAtlasNameForSpritePath(source.spritePath),
        spritePath: source.spritePath,
        assetPath: getBerryTreeAssetPath(source.spritePath),
        frameWidth: source.frameWidth,
        frameHeight: source.frameHeight,
      });
    }
  }

  return Array.from(descriptorsByPath.values()).sort((a, b) => a.spritePath.localeCompare(b.spritePath));
}

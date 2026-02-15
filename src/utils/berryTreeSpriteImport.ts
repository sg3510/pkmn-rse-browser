/**
 * Berry tree sprite import/upload utility.
 *
 * C references:
 * - public/pokeemerald/src/data/object_events/berry_tree_graphics_tables.h
 * - public/pokeemerald/src/event_object_movement.c (SetBerryTreeGraphics)
 */

import { loadImageCanvasAsset } from './assetLoader';
import {
  listBerryTreeAtlasDescriptors,
  type BerryTreeAtlasDescriptor,
} from './berryTreeSpriteResolver';

type BerryTreeSpriteUploadTarget = {
  hasSpriteSheet: (name: string) => boolean;
  uploadSpriteSheet: (
    name: string,
    source: HTMLCanvasElement | ImageData,
    info?: { frameWidth?: number; frameHeight?: number }
  ) => void;
};

const atlasCanvasPromises = new Map<string, Promise<HTMLCanvasElement>>();

function canLoadBerryAtlases(): boolean {
  return typeof window !== 'undefined' && typeof Image !== 'undefined' && typeof document !== 'undefined';
}

function getAtlasLoadPromise(descriptor: BerryTreeAtlasDescriptor): Promise<HTMLCanvasElement> {
  let promise = atlasCanvasPromises.get(descriptor.assetPath);
  if (!promise) {
    promise = loadImageCanvasAsset(descriptor.assetPath, {
      transparency: { type: 'top-left' },
    });
    atlasCanvasPromises.set(descriptor.assetPath, promise);
  }
  return promise;
}

export function listRequiredBerryTreeAtlases(): BerryTreeAtlasDescriptor[] {
  return listBerryTreeAtlasDescriptors();
}

export async function preloadBerryTreeAtlases(): Promise<void> {
  if (!canLoadBerryAtlases()) {
    return;
  }

  const atlases = listRequiredBerryTreeAtlases();
  await Promise.all(atlases.map((atlas) => getAtlasLoadPromise(atlas)));
}

export async function ensureBerryTreeAtlasesUploaded(
  spriteRenderer: BerryTreeSpriteUploadTarget
): Promise<void> {
  if (!canLoadBerryAtlases()) {
    return;
  }

  const atlases = listRequiredBerryTreeAtlases();
  if (atlases.length === 0) {
    return;
  }

  await Promise.all(
    atlases.map(async (atlas) => {
      if (spriteRenderer.hasSpriteSheet(atlas.atlasName)) {
        return;
      }

      const canvas = await getAtlasLoadPromise(atlas);
      spriteRenderer.uploadSpriteSheet(atlas.atlasName, canvas, {
        frameWidth: atlas.frameWidth,
        frameHeight: atlas.frameHeight,
      });
    })
  );
}

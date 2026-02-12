import { loadImageCanvasAsset } from '../utils/assetLoader';
import type { WeatherAssetDescriptor } from './types';

export async function loadWeatherAssets(
  descriptors: readonly WeatherAssetDescriptor[]
): Promise<Map<string, HTMLCanvasElement>> {
  const entries = await Promise.all(
    descriptors.map(async (descriptor) => {
      const canvas = await loadImageCanvasAsset(descriptor.path, {
        transparency: descriptor.transparency ?? { type: 'top-left' },
      });
      return [descriptor.key, canvas] as const;
    })
  );
  return new Map(entries);
}

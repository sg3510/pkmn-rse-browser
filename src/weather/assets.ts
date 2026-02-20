import { loadImageCanvasAsset, type TransparencyMode } from '../utils/assetLoader';
import type { WeatherAssetDescriptor } from './types';

export async function loadWeatherAssets(
  descriptors: readonly WeatherAssetDescriptor[]
): Promise<Map<string, HTMLCanvasElement>> {
  const entries = await Promise.all(
    descriptors.map(async (descriptor) => {
      const transparency: TransparencyMode =
        descriptor.transparency?.type === 'top-left'
          ? { type: 'indexed-zero', fallback: descriptor.transparency } as const
          : (descriptor.transparency ?? { type: 'indexed-zero', fallback: { type: 'top-left' } });
      const canvas = await loadImageCanvasAsset(descriptor.path, {
        transparency,
      });
      return [descriptor.key, canvas] as const;
    })
  );
  return new Map(entries);
}

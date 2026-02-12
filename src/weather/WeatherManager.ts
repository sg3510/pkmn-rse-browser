import type { WorldCameraView } from '../rendering/types';
import type { WeatherName } from '../data/weather.gen';
import {
  getRuntimeWeatherAlias,
  getWeatherEffectFactory,
  resolveCoordEventWeatherToWeatherName,
  resolveWeatherName,
  WEATHER_NONE_NAME,
} from './registry';
import type { WeatherEffect, WeatherStateSnapshot } from './types';

export interface MapWeatherSource {
  mapId: string;
  mapWeather: string | null;
}

export class WeatherManager {
  private mapDefaults = new Map<string, WeatherName>();

  private currentMapId: string | null = null;
  private savedWeather: WeatherName = WEATHER_NONE_NAME;
  private activeWeather: WeatherName = WEATHER_NONE_NAME;

  private effect: WeatherEffect | null = null;

  private lastUpdateMs = 0;

  setMapDefaultsFromSources(sources: MapWeatherSource[]): void {
    this.mapDefaults.clear();

    for (const source of sources) {
      const defaultWeather = source.mapWeather
        ? resolveWeatherName(source.mapWeather) ?? WEATHER_NONE_NAME
        : WEATHER_NONE_NAME;
      this.mapDefaults.set(source.mapId, defaultWeather);
    }
  }

  setCurrentMap(mapId: string): void {
    if (this.currentMapId === mapId) return;

    this.currentMapId = mapId;
    this.setSavedWeatherToMapDefault(mapId);
    this.doCurrentWeather();
  }

  setSavedWeather(weather: string | number): void {
    const resolved = resolveWeatherName(weather);
    if (!resolved) return;
    this.savedWeather = resolved;
  }

  setSavedWeatherToMapDefault(mapId: string | null = this.currentMapId): void {
    if (!mapId) {
      this.savedWeather = WEATHER_NONE_NAME;
      return;
    }

    this.savedWeather = this.mapDefaults.get(mapId) ?? WEATHER_NONE_NAME;
  }

  doCurrentWeather(): void {
    const runtimeWeather = getRuntimeWeatherAlias(this.savedWeather);
    if (runtimeWeather === this.activeWeather) {
      return;
    }

    this.effect?.onExit?.();
    this.effect = null;

    this.activeWeather = runtimeWeather;

    const factory = getWeatherEffectFactory(runtimeWeather);
    if (factory) {
      this.effect = factory();
      this.effect.onEnter?.();
    }
  }

  applyCoordWeather(coordWeather: string | number): void {
    const weather = resolveCoordEventWeatherToWeatherName(coordWeather);
    if (!weather) return;

    this.savedWeather = weather;
    this.doCurrentWeather();
  }

  update(nowMs: number, view: WorldCameraView): void {
    const deltaMs = this.lastUpdateMs === 0 ? 0 : Math.max(0, nowMs - this.lastUpdateMs);
    this.lastUpdateMs = nowMs;

    this.effect?.update?.({ nowMs, deltaMs, view });
  }

  render(ctx2d: CanvasRenderingContext2D, view: WorldCameraView, nowMs: number): void {
    this.effect?.render?.({ ctx2d, view, nowMs });
  }

  getStateSnapshot(): WeatherStateSnapshot {
    return {
      currentMapId: this.currentMapId,
      savedWeather: this.savedWeather,
      activeWeather: this.activeWeather,
    };
  }

  clear(): void {
    this.effect?.onExit?.();
    this.effect = null;
    this.currentMapId = null;
    this.savedWeather = WEATHER_NONE_NAME;
    this.activeWeather = WEATHER_NONE_NAME;
    this.lastUpdateMs = 0;
  }
}

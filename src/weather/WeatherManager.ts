import type { WorldCameraView } from '../rendering/types';
import type { WeatherName } from '../data/weather.gen';
import {
  resolveRuntimeWeather,
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
  private static readonly WEATHER_CYCLE_LENGTH = 4;
  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;
  // C parity reference:
  // - public/pokeemerald/src/clock.c (gLocalTime.days / UpdatePerDay)
  // - public/pokeemerald/src/field_weather_effect.c (UpdateWeatherPerDay)
  // We treat this as LOCAL day count since 2000-01-01 (GBA RTC epoch style),
  // not UTC days since Unix epoch.
  private static readonly RTC_EPOCH_LOCAL_MS = new Date(2000, 0, 1).getTime();

  private mapDefaults = new Map<string, WeatherName>();

  private currentMapId: string | null = null;
  private savedWeather: WeatherName = WEATHER_NONE_NAME;
  private activeWeather: WeatherName = WEATHER_NONE_NAME;
  private weatherCycleStage = WeatherManager.defaultWeatherCycleStage();

  private effect: WeatherEffect | null = null;

  private lastUpdateMs = 0;
  private lastCycleSyncRtcDay = WeatherManager.resolveRtcDay(Date.now());

  private static resolveRtcDay(nowMs: number): number {
    const now = new Date(nowMs);
    const localMidnightMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    return Math.floor(
      (localMidnightMs - WeatherManager.RTC_EPOCH_LOCAL_MS) / WeatherManager.MS_PER_DAY
    );
  }

  private static defaultWeatherCycleStage(nowMs: number = Date.now()): number {
    const daysSinceEpoch = WeatherManager.resolveRtcDay(nowMs);
    return ((daysSinceEpoch % WeatherManager.WEATHER_CYCLE_LENGTH) + WeatherManager.WEATHER_CYCLE_LENGTH)
      % WeatherManager.WEATHER_CYCLE_LENGTH;
  }

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

  setWeatherCycleStage(stage: number): void {
    if (!Number.isFinite(stage)) return;
    const normalized = Math.floor(stage);
    this.weatherCycleStage =
      ((normalized % WeatherManager.WEATHER_CYCLE_LENGTH) + WeatherManager.WEATHER_CYCLE_LENGTH)
      % WeatherManager.WEATHER_CYCLE_LENGTH;
  }

  syncWeatherCycleToCurrentDate(nowMs: number = Date.now()): void {
    const rtcDay = WeatherManager.resolveRtcDay(nowMs);
    if (rtcDay === this.lastCycleSyncRtcDay) return;

    this.lastCycleSyncRtcDay = rtcDay;
    this.setWeatherCycleStage(WeatherManager.defaultWeatherCycleStage(nowMs));
    this.doCurrentWeather();
  }

  doCurrentWeather(): void {
    const runtimeWeather = resolveRuntimeWeather(this.savedWeather, this.weatherCycleStage);
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
    this.syncWeatherCycleToCurrentDate(nowMs);

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
      weatherCycleStage: this.weatherCycleStage,
    };
  }

  clear(): void {
    this.effect?.onExit?.();
    this.effect = null;
    this.currentMapId = null;
    this.savedWeather = WEATHER_NONE_NAME;
    this.activeWeather = WEATHER_NONE_NAME;
    this.weatherCycleStage = WeatherManager.defaultWeatherCycleStage();
    this.lastCycleSyncRtcDay = WeatherManager.resolveRtcDay(Date.now());
    this.lastUpdateMs = 0;
  }
}

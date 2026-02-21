import type { WorldCameraView } from '../rendering/types';
import type { WaterMaskData } from '../rendering/ISpriteRenderer';
import type { WeatherName } from '../data/weather.gen';
import {
  resolveRuntimeWeather,
  getWeatherEffectFactory,
  resolveCoordEventWeatherToWeatherName,
  resolveWeatherName,
  WEATHER_NONE_NAME,
} from './registry';
import { WeatherColorPipeline } from './WeatherColorPipeline';
import { WeatherColorWebGLPass } from './WeatherColorWebGLPass';
import type { WeatherEffect, WeatherStateSnapshot } from './types';

export interface MapWeatherSource {
  mapId: string;
  mapWeather: string | null;
}

export class WeatherManager {
  private static readonly WEATHER_CYCLE_LENGTH = 4;
  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;
  private static readonly WEATHER_TRANSITION_MS = 480;
  // C parity reference:
  // - public/pokeemerald/src/clock.c (gLocalTime.days / UpdatePerDay)
  // - public/pokeemerald/src/field_weather_effect.c (UpdateWeatherPerDay)
  // We treat this as LOCAL day count since 2000-01-01 (GBA RTC epoch style),
  // not UTC days since Unix epoch.
  private static readonly RTC_EPOCH_LOCAL_MS = new Date(2000, 0, 1).getTime();

  private mapDefaults = new Map<string, WeatherName>();

  private currentMapId: string | null = null;
  private currentMapOffsetX: number | null = null;
  private currentMapOffsetY: number | null = null;
  private savedWeather: WeatherName = WEATHER_NONE_NAME;
  private activeWeather: WeatherName = WEATHER_NONE_NAME;
  private weatherCycleStage = WeatherManager.defaultWeatherCycleStage();

  private effect: WeatherEffect | null = null;
  private previousEffect: WeatherEffect | null = null;
  private transitionElapsedMs = 0;
  private transitionDurationMs = 0;
  private weatherChangeWaiters: Array<() => void> = [];

  private lastUpdateMs = 0;
  private lastCycleSyncRtcDay = WeatherManager.resolveRtcDay(Date.now());
  private readonly colorPipeline = new WeatherColorPipeline();
  private colorWebGLPass: WeatherColorWebGLPass | null = null;

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

  setCurrentMap(mapId: string, mapOffsetX?: number, mapOffsetY?: number): void {
    const mapChanged = this.currentMapId !== mapId;
    if (Number.isFinite(mapOffsetX)) {
      this.currentMapOffsetX = Math.trunc(mapOffsetX as number);
    } else if (mapChanged) {
      this.currentMapOffsetX = null;
    }
    if (Number.isFinite(mapOffsetY)) {
      this.currentMapOffsetY = Math.trunc(mapOffsetY as number);
    } else if (mapChanged) {
      this.currentMapOffsetY = null;
    }
    if (!mapChanged) return;

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

    // If a previous transition is still active, retire its outgoing effect now.
    if (this.previousEffect) {
      this.previousEffect.onExit?.();
      this.previousEffect = null;
      this.transitionElapsedMs = 0;
      this.transitionDurationMs = 0;
    }

    const outgoingEffect = this.effect;
    this.effect = null;

    this.activeWeather = runtimeWeather;
    this.colorPipeline.setActiveWeather(runtimeWeather);

    const factory = getWeatherEffectFactory(runtimeWeather);
    const incomingEffect = factory ? factory() : null;
    incomingEffect?.onEnter?.();
    this.effect = incomingEffect;

    if (outgoingEffect) {
      this.previousEffect = outgoingEffect;
      this.transitionElapsedMs = 0;
      this.transitionDurationMs = WeatherManager.WEATHER_TRANSITION_MS;
    } else {
      this.resolveWeatherChangeWaiters();
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

    const updateContext = {
      nowMs,
      deltaMs,
      view,
      mapOffsetX: this.currentMapOffsetX,
      mapOffsetY: this.currentMapOffsetY,
    };
    this.previousEffect?.update?.(updateContext);
    this.effect?.update?.(updateContext);
    this.consumeEffectColorCommands(this.previousEffect);
    this.consumeEffectColorCommands(this.effect);
    this.colorPipeline.update(deltaMs);

    if (this.previousEffect) {
      this.transitionElapsedMs += deltaMs;
      if (this.transitionElapsedMs >= this.transitionDurationMs) {
        this.completeActiveTransition();
      }
    }
  }

  render(
    ctx2d: CanvasRenderingContext2D,
    view: WorldCameraView,
    nowMs: number,
    waterMask: WaterMaskData | null = null,
    gl: WebGL2RenderingContext | null = null,
    webglCanvas: HTMLCanvasElement | null = null
  ): void {
    const targetWidth = Math.max(0, Math.trunc(ctx2d.canvas.width));
    const targetHeight = Math.max(0, Math.trunc(ctx2d.canvas.height));
    const { eva, evb } = this.colorPipeline.getBlendCoeffs();

    if (this.previousEffect) {
      const progress = Math.min(
        1,
        this.transitionElapsedMs / Math.max(1, this.transitionDurationMs)
      );
      const outgoingAlpha = 1 - progress;
      const incomingAlpha = progress;

      if (outgoingAlpha > 0.001) {
        ctx2d.save();
        ctx2d.globalAlpha = outgoingAlpha;
        this.previousEffect.render?.({
          ctx2d,
          view,
          nowMs,
          waterMask,
          mapOffsetX: this.currentMapOffsetX,
          mapOffsetY: this.currentMapOffsetY,
          blendEva: eva,
          blendEvb: evb,
        });
        ctx2d.restore();
      }

      if (incomingAlpha > 0.001) {
        ctx2d.save();
        ctx2d.globalAlpha = incomingAlpha;
        this.effect?.render?.({
          ctx2d,
          view,
          nowMs,
          waterMask,
          mapOffsetX: this.currentMapOffsetX,
          mapOffsetY: this.currentMapOffsetY,
          blendEva: eva,
          blendEvb: evb,
        });
        ctx2d.restore();
      }
    } else {
      this.effect?.render?.({
        ctx2d,
        view,
        nowMs,
        waterMask,
        mapOffsetX: this.currentMapOffsetX,
        mapOffsetY: this.currentMapOffsetY,
        blendEva: eva,
        blendEvb: evb,
      });
    }

    const appliedByWebGL =
      gl != null
      && webglCanvas != null
      && this.applyColorPipelineWithWebGL(
        ctx2d,
        targetWidth,
        targetHeight,
        gl,
        webglCanvas
      );

    if (!appliedByWebGL) {
      this.colorPipeline.applyToCanvas(ctx2d, targetWidth, targetHeight);
    }
  }

  waitForChangeComplete(): Promise<void> {
    if (!this.previousEffect) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.weatherChangeWaiters.push(resolve);
    });
  }

  getStateSnapshot(): WeatherStateSnapshot {
    return {
      currentMapId: this.currentMapId,
      savedWeather: this.savedWeather,
      activeWeather: this.activeWeather,
      weatherCycleStage: this.weatherCycleStage,
    };
  }

  hasActiveVisualEffects(): boolean {
    if (this.previousEffect || this.effect) return true;
    if (this.activeWeather !== WEATHER_NONE_NAME) return true;

    const { eva, evb } = this.colorPipeline.getBlendCoeffs();
    return this.colorPipeline.getCurrentColorMapIndex() !== 0 || eva !== 16 || evb !== 0;
  }

  clear(): void {
    this.previousEffect?.onExit?.();
    this.previousEffect = null;
    this.effect?.onExit?.();
    this.effect = null;
    this.currentMapId = null;
    this.currentMapOffsetX = null;
    this.currentMapOffsetY = null;
    this.savedWeather = WEATHER_NONE_NAME;
    this.activeWeather = WEATHER_NONE_NAME;
    this.weatherCycleStage = WeatherManager.defaultWeatherCycleStage();
    this.lastCycleSyncRtcDay = WeatherManager.resolveRtcDay(Date.now());
    this.lastUpdateMs = 0;
    this.transitionElapsedMs = 0;
    this.transitionDurationMs = 0;
    this.colorPipeline.clear();
    this.colorWebGLPass?.dispose();
    this.colorWebGLPass = null;
    this.resolveWeatherChangeWaiters();
  }

  private completeActiveTransition(): void {
    if (!this.previousEffect) return;
    this.previousEffect.onExit?.();
    this.previousEffect = null;
    this.transitionElapsedMs = 0;
    this.transitionDurationMs = 0;
    this.resolveWeatherChangeWaiters();
  }

  private resolveWeatherChangeWaiters(): void {
    if (this.weatherChangeWaiters.length === 0) return;
    const waiters = this.weatherChangeWaiters;
    this.weatherChangeWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  private consumeEffectColorCommands(effect: WeatherEffect | null): void {
    if (!effect?.consumeColorCommands) return;
    const commands = effect.consumeColorCommands();
    if (!commands || commands.length === 0) return;
    for (const command of commands) {
      this.colorPipeline.applyCommand(command);
    }
  }

  private applyColorPipelineWithWebGL(
    ctx2d: CanvasRenderingContext2D,
    width: number,
    height: number,
    gl: WebGL2RenderingContext,
    webglCanvas: HTMLCanvasElement
  ): boolean {
    if (!this.colorWebGLPass || !this.colorWebGLPass.isForContext(gl)) {
      this.colorWebGLPass?.dispose();
      this.colorWebGLPass = new WeatherColorWebGLPass(gl);
    }

    return this.colorWebGLPass.render(
      ctx2d,
      width,
      height,
      webglCanvas,
      this.colorPipeline
    );
  }
}

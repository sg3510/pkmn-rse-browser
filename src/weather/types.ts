import type { WorldCameraView } from '../rendering/types';
import type { WeatherName } from '../data/weather.gen';

export interface WeatherUpdateContext {
  nowMs: number;
  deltaMs: number;
  view: WorldCameraView;
}

export interface WeatherRenderContext {
  ctx2d: CanvasRenderingContext2D;
  view: WorldCameraView;
  nowMs: number;
}

export interface WeatherEffect {
  onEnter?(): void;
  onExit?(): void;
  update?(context: WeatherUpdateContext): void;
  render?(context: WeatherRenderContext): void;
}

export interface WeatherStateSnapshot {
  currentMapId: string | null;
  savedWeather: WeatherName;
  activeWeather: WeatherName;
}

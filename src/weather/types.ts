import type { WorldCameraView } from '../rendering/types';
import type { WaterMaskData } from '../rendering/ISpriteRenderer';
import type { WeatherName } from '../data/weather.gen';
import type { TransparencyMode } from '../utils/assetLoader';

export type WeatherColorCommand =
  | {
    kind: 'applyColorMapIfIdle';
    colorMapIndex: number;
  }
  | {
    kind: 'applyColorMapIfIdleGradual';
    colorMapIndex: number;
    targetColorMapIndex: number;
    colorMapStepDelay: number;
  };

export interface WeatherUpdateContext {
  nowMs: number;
  deltaMs: number;
  view: WorldCameraView;
  mapOffsetX: number | null;
  mapOffsetY: number | null;
}

export interface WeatherRenderContext {
  ctx2d: CanvasRenderingContext2D;
  view: WorldCameraView;
  nowMs: number;
  waterMask: WaterMaskData | null;
  mapOffsetX: number | null;
  mapOffsetY: number | null;
  blendEva: number;
  blendEvb: number;
}

export interface WeatherEffect {
  onEnter?(): void;
  onExit?(): void;
  update?(context: WeatherUpdateContext): void;
  render?(context: WeatherRenderContext): void;
  consumeColorCommands?(): readonly WeatherColorCommand[];
}

export interface WeatherStateSnapshot {
  currentMapId: string | null;
  savedWeather: WeatherName;
  activeWeather: WeatherName;
  weatherCycleStage: number;
}

export interface WeatherAssetDescriptor {
  key: string;
  path: string;
  transparency?: TransparencyMode;
}

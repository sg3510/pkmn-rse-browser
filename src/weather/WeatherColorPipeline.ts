/**
 * C-inspired weather palette pipeline for overworld weather color processing.
 *
 * C references:
 * - public/pokeemerald/src/field_weather.c (BuildColorMaps / ApplyColorMap* / Weather_UpdateBlend / DroughtStateRun)
 * - public/pokeemerald/src/field_weather_effect.c (weather init vars + thunder color-map calls)
 */

import type { WeatherName } from '../data/weather.gen';
import type { WeatherColorCommand } from './types';

interface BlendCoeffs {
  eva: number;
  evb: number;
}

interface WeatherColorProfile {
  targetColorMapIndex: number;
  colorMapStepDelay: number;
  blendInit?: BlendCoeffs;
  blendTarget?: {
    eva: number;
    evb: number;
    delay: number;
  };
  runDroughtState?: boolean;
}

const WEATHER_COLOR_MAP_COUNT = 19;
const DROUGHT_TABLE_COUNT = 6;
const DROUGHT_TABLE_SIZE = 0x1000;

const DEFAULT_PROFILE: WeatherColorProfile = {
  targetColorMapIndex: 0,
  colorMapStepDelay: 20,
};

const WEATHER_COLOR_PROFILES: Partial<Record<WeatherName, WeatherColorProfile>> = {
  WEATHER_ABNORMAL: {
    targetColorMapIndex: 3,
    colorMapStepDelay: 20,
  },
  WEATHER_RAIN: {
    targetColorMapIndex: 3,
    colorMapStepDelay: 20,
  },
  WEATHER_RAIN_THUNDERSTORM: {
    targetColorMapIndex: 3,
    colorMapStepDelay: 20,
  },
  WEATHER_DOWNPOUR: {
    targetColorMapIndex: 3,
    colorMapStepDelay: 20,
  },
  WEATHER_SNOW: {
    targetColorMapIndex: 3,
    colorMapStepDelay: 20,
  },
  WEATHER_SHADE: {
    targetColorMapIndex: 3,
    colorMapStepDelay: 20,
  },
  WEATHER_DROUGHT: {
    targetColorMapIndex: 0,
    colorMapStepDelay: 0,
    runDroughtState: true,
  },
  WEATHER_SUNNY_CLOUDS: {
    targetColorMapIndex: 0,
    colorMapStepDelay: 20,
    blendInit: { eva: 0, evb: 16 },
    blendTarget: { eva: 12, evb: 8, delay: 1 },
  },
  WEATHER_FOG_HORIZONTAL: {
    targetColorMapIndex: 0,
    colorMapStepDelay: 20,
    blendInit: { eva: 0, evb: 16 },
    blendTarget: { eva: 12, evb: 8, delay: 3 },
  },
  WEATHER_FOG_DIAGONAL: {
    targetColorMapIndex: 0,
    colorMapStepDelay: 20,
    blendInit: { eva: 0, evb: 16 },
    blendTarget: { eva: 12, evb: 8, delay: 8 },
  },
  WEATHER_UNDERWATER: {
    targetColorMapIndex: 0,
    colorMapStepDelay: 20,
    blendInit: { eva: 0, evb: 16 },
    blendTarget: { eva: 4, evb: 16, delay: 0 },
  },
  WEATHER_UNDERWATER_BUBBLES: {
    targetColorMapIndex: 0,
    colorMapStepDelay: 20,
    blendInit: { eva: 0, evb: 16 },
    blendTarget: { eva: 4, evb: 16, delay: 0 },
  },
  WEATHER_VOLCANIC_ASH: {
    targetColorMapIndex: 0,
    colorMapStepDelay: 20,
    blendInit: { eva: 0, evb: 16 },
    blendTarget: { eva: 16, evb: 0, delay: 1 },
  },
  WEATHER_SANDSTORM: {
    targetColorMapIndex: 0,
    colorMapStepDelay: 20,
    blendInit: { eva: 0, evb: 16 },
    blendTarget: { eva: 16, evb: 0, delay: 0 },
  },
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function buildColorMaps(): {
  darkenedContrastColorMaps: Uint8Array[];
  contrastColorMaps: Uint8Array[];
} {
  const darkenedContrastColorMaps = Array.from(
    { length: WEATHER_COLOR_MAP_COUNT },
    () => new Uint8Array(32)
  );
  const contrastColorMaps = Array.from(
    { length: WEATHER_COLOR_MAP_COUNT },
    () => new Uint8Array(32)
  );

  for (let tableIndex = 0; tableIndex < 2; tableIndex++) {
    const colorMaps = tableIndex === 0 ? darkenedContrastColorMaps : contrastColorMaps;

    for (let colorVal = 0; colorVal < 32; colorVal++) {
      let curBrightness = colorVal << 8;
      let brightnessDelta = tableIndex === 0 ? ((colorVal << 8) / 16) | 0 : 0;

      let colorMapIndex = 0;
      for (; colorMapIndex < 3; colorMapIndex++) {
        curBrightness -= brightnessDelta;
        colorMaps[colorMapIndex][colorVal] = clamp(curBrightness >> 8, 0, 31);
      }

      const baseBrightness = curBrightness;
      brightnessDelta = ((0x1f00 - curBrightness) / (WEATHER_COLOR_MAP_COUNT - 3)) | 0;

      if (colorVal < 12) {
        for (; colorMapIndex < WEATHER_COLOR_MAP_COUNT; colorMapIndex++) {
          curBrightness += brightnessDelta;
          const diff = curBrightness - baseBrightness;
          if (diff > 0) {
            curBrightness -= (diff / 2) | 0;
          }
          colorMaps[colorMapIndex][colorVal] = clamp(curBrightness >> 8, 0, 31);
        }
      } else {
        for (; colorMapIndex < WEATHER_COLOR_MAP_COUNT; colorMapIndex++) {
          curBrightness += brightnessDelta;
          colorMaps[colorMapIndex][colorVal] = clamp(curBrightness >> 8, 0, 31);
        }
      }
    }
  }

  return { darkenedContrastColorMaps, contrastColorMaps };
}

function gbaSin(angle: number): number {
  const normalized = angle & 0xff;
  return Math.round(Math.sin((normalized * Math.PI) / 128) * 256);
}

export class WeatherColorPipeline {
  private readonly darkenedContrastColorMaps: Uint8Array[];
  private readonly contrastColorMaps: Uint8Array[];

  private palProcessingState: 'changing' | 'idle' = 'idle';
  private colorMapIndex = 0;
  private targetColorMapIndex = 0;
  private colorMapStepDelay = 20;
  private colorMapStepCounter = 0;

  private currBlendEVA = 16;
  private currBlendEVB = 0;
  private targetBlendEVA = 16;
  private targetBlendEVB = 0;
  private blendDelay = 0;
  private blendFrameCounter = 0;
  private blendUpdateCounter = 0;

  private frameAccumulator = 0;

  private runDroughtState = false;
  private droughtState = 0;
  private droughtBrightnessStage = 0;
  private droughtLastBrightnessStage = 0;
  private droughtTimer = 0;

  private droughtColorTables: Uint16Array[] | null = null;
  private droughtTablesLoadPromise: Promise<void> | null = null;

  constructor() {
    const { darkenedContrastColorMaps, contrastColorMaps } = buildColorMaps();
    this.darkenedContrastColorMaps = darkenedContrastColorMaps;
    this.contrastColorMaps = contrastColorMaps;
  }

  setActiveWeather(weather: WeatherName): void {
    const profile = WEATHER_COLOR_PROFILES[weather] ?? DEFAULT_PROFILE;

    this.targetColorMapIndex = profile.targetColorMapIndex;
    this.colorMapStepDelay = Math.max(0, profile.colorMapStepDelay);
    this.colorMapStepCounter = 0;
    if (this.colorMapIndex !== this.targetColorMapIndex) {
      this.palProcessingState = 'changing';
    }

    if (profile.blendInit) {
      this.setBlendCoeffs(profile.blendInit.eva, profile.blendInit.evb);
    }
    if (profile.blendTarget) {
      this.setTargetBlendCoeffs(
        profile.blendTarget.eva,
        profile.blendTarget.evb,
        profile.blendTarget.delay
      );
    }

    this.runDroughtState = !!profile.runDroughtState;
    if (this.runDroughtState) {
      this.initDroughtState();
      void this.ensureDroughtTablesLoaded();
    }
  }

  applyCommand(command: WeatherColorCommand): void {
    switch (command.kind) {
    case 'applyColorMapIfIdle':
      this.applyColorMapIfIdle(command.colorMapIndex);
      break;
    case 'applyColorMapIfIdleGradual':
      this.applyColorMapIfIdleGradual(
        command.colorMapIndex,
        command.targetColorMapIndex,
        command.colorMapStepDelay
      );
      break;
    }
  }

  update(deltaMs: number): void {
    this.frameAccumulator += deltaMs / (1000 / 60);
    while (this.frameAccumulator >= 1) {
      this.frameAccumulator -= 1;
      this.stepFrame();
    }
  }

  getBlendCoeffs(): { eva: number; evb: number } {
    return {
      eva: this.currBlendEVA,
      evb: this.currBlendEVB,
    };
  }

  getCurrentColorMapIndex(): number {
    return this.colorMapIndex;
  }

  getDarkenedColorMap(mapIndex: number): Uint8Array | null {
    const normalized = clamp(Math.trunc(mapIndex), 0, WEATHER_COLOR_MAP_COUNT - 1);
    return this.darkenedContrastColorMaps[normalized] ?? null;
  }

  getDroughtColorTable(tableIndex: number): Uint16Array | null {
    const normalized = clamp(Math.trunc(tableIndex), 0, DROUGHT_TABLE_COUNT - 1);
    return this.droughtColorTables?.[normalized] ?? null;
  }

  applyToCanvas(
    ctx2d: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    if (!this.shouldApplyColorMap(width, height)) {
      return;
    }

    const imageData = ctx2d.getImageData(0, 0, width, height);
    const data = imageData.data;
    const colorMapIndex = this.colorMapIndex;
    const hasDroughtTable = colorMapIndex < 0 && this.hasDroughtTable(colorMapIndex);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if ((r | g | b) === 0) continue;

      if (colorMapIndex > 0) {
        const mapped = this.mapPositiveColorMap(r, g, b, colorMapIndex);
        data[i] = mapped.r;
        data[i + 1] = mapped.g;
        data[i + 2] = mapped.b;
      } else if (colorMapIndex < 0 && hasDroughtTable) {
        const mapped = this.mapDroughtColor(r, g, b, colorMapIndex);
        data[i] = mapped.r;
        data[i + 1] = mapped.g;
        data[i + 2] = mapped.b;
      }
    }

    ctx2d.putImageData(imageData, 0, 0);
  }

  clear(): void {
    this.palProcessingState = 'idle';
    this.colorMapIndex = 0;
    this.targetColorMapIndex = 0;
    this.colorMapStepDelay = 20;
    this.colorMapStepCounter = 0;
    this.currBlendEVA = 16;
    this.currBlendEVB = 0;
    this.targetBlendEVA = 16;
    this.targetBlendEVB = 0;
    this.blendDelay = 0;
    this.blendFrameCounter = 0;
    this.blendUpdateCounter = 0;
    this.frameAccumulator = 0;
    this.runDroughtState = false;
    this.initDroughtState();
  }

  private stepFrame(): void {
    this.updateWeatherColorMap();
    this.updateBlend();

    if (this.runDroughtState) {
      this.runDroughtStateMachine();
    }
  }

  private updateWeatherColorMap(): void {
    if (this.palProcessingState !== 'changing') {
      return;
    }
    if (this.colorMapIndex === this.targetColorMapIndex) {
      this.palProcessingState = 'idle';
      return;
    }

    this.colorMapStepCounter += 1;
    if (this.colorMapStepCounter >= this.colorMapStepDelay) {
      this.colorMapStepCounter = 0;
      if (this.colorMapIndex < this.targetColorMapIndex) {
        this.colorMapIndex += 1;
      } else {
        this.colorMapIndex -= 1;
      }
    }
  }

  private setBlendCoeffs(eva: number, evb: number): void {
    this.currBlendEVA = clamp(Math.trunc(eva), 0, 16);
    this.currBlendEVB = clamp(Math.trunc(evb), 0, 16);
    this.targetBlendEVA = this.currBlendEVA;
    this.targetBlendEVB = this.currBlendEVB;
    this.blendDelay = 0;
    this.blendFrameCounter = 0;
    this.blendUpdateCounter = 0;
  }

  private setTargetBlendCoeffs(eva: number, evb: number, delay: number): void {
    this.targetBlendEVA = clamp(Math.trunc(eva), 0, 16);
    this.targetBlendEVB = clamp(Math.trunc(evb), 0, 16);
    this.blendDelay = Math.max(0, Math.trunc(delay));
    this.blendFrameCounter = 0;
    this.blendUpdateCounter = 0;
  }

  private updateBlend(): void {
    if (
      this.currBlendEVA === this.targetBlendEVA
      && this.currBlendEVB === this.targetBlendEVB
    ) {
      return;
    }

    this.blendFrameCounter += 1;
    if (this.blendFrameCounter > this.blendDelay) {
      this.blendFrameCounter = 0;
      this.blendUpdateCounter += 1;

      if ((this.blendUpdateCounter & 1) !== 0) {
        if (this.currBlendEVA < this.targetBlendEVA) {
          this.currBlendEVA += 1;
        } else if (this.currBlendEVA > this.targetBlendEVA) {
          this.currBlendEVA -= 1;
        }
      } else {
        if (this.currBlendEVB < this.targetBlendEVB) {
          this.currBlendEVB += 1;
        } else if (this.currBlendEVB > this.targetBlendEVB) {
          this.currBlendEVB -= 1;
        }
      }
    }
  }

  private applyColorMapIfIdle(colorMapIndex: number): void {
    if (this.palProcessingState !== 'idle') {
      return;
    }
    this.colorMapIndex = colorMapIndex;
  }

  private applyColorMapIfIdleGradual(
    colorMapIndex: number,
    targetColorMapIndex: number,
    colorMapStepDelay: number
  ): void {
    if (this.palProcessingState !== 'idle') {
      return;
    }
    this.palProcessingState = 'changing';
    this.colorMapIndex = colorMapIndex;
    this.targetColorMapIndex = targetColorMapIndex;
    this.colorMapStepCounter = 0;
    this.colorMapStepDelay = Math.max(0, colorMapStepDelay);
    this.applyColorMapIfIdle(colorMapIndex);
  }

  private initDroughtState(): void {
    this.droughtState = 0;
    this.droughtBrightnessStage = 0;
    this.droughtTimer = 0;
    this.droughtLastBrightnessStage = 0;
  }

  private runDroughtStateMachine(): void {
    switch (this.droughtState) {
    case 0:
      this.droughtTimer += 1;
      if (this.droughtTimer > 5) {
        this.droughtTimer = 0;
        this.setDroughtColorMap(this.droughtBrightnessStage);
        this.droughtBrightnessStage += 1;
        if (this.droughtBrightnessStage > 5) {
          this.droughtLastBrightnessStage = this.droughtBrightnessStage;
          this.droughtState = 1;
          this.droughtTimer = 60;
        }
      }
      break;
    case 1: {
      this.droughtTimer = (this.droughtTimer + 3) & 0x7f;
      const stage = (((gbaSin(this.droughtTimer) - 1) >> 6) + 2) | 0;
      this.droughtBrightnessStage = clamp(stage, 0, 5);
      if (this.droughtBrightnessStage !== this.droughtLastBrightnessStage) {
        this.setDroughtColorMap(this.droughtBrightnessStage);
      }
      this.droughtLastBrightnessStage = this.droughtBrightnessStage;
      break;
    }
    case 2:
      this.droughtTimer += 1;
      if (this.droughtTimer > 5) {
        this.droughtTimer = 0;
        this.droughtBrightnessStage = Math.max(0, this.droughtBrightnessStage - 1);
        this.setDroughtColorMap(this.droughtBrightnessStage);
        if (this.droughtBrightnessStage === 3) {
          this.droughtState = 0;
        }
      }
      break;
    }
  }

  private setDroughtColorMap(stage: number): void {
    const clampedStage = clamp(stage, 0, DROUGHT_TABLE_COUNT - 1);
    this.applyColorMapIfIdle(-clampedStage - 1);
  }

  private shouldApplyColorMap(width: number, height: number): boolean {
    if (width <= 0 || height <= 0) return false;
    return this.colorMapIndex !== 0;
  }

  private mapPositiveColorMap(
    r: number,
    g: number,
    b: number,
    colorMapIndex: number
  ): { r: number; g: number; b: number } {
    const mapIndex = clamp(colorMapIndex - 1, 0, WEATHER_COLOR_MAP_COUNT - 1);
    const colorMap = this.darkenedContrastColorMaps[mapIndex] ?? this.contrastColorMaps[mapIndex];
    const r5 = colorMap[r >> 3];
    const g5 = colorMap[g >> 3];
    const b5 = colorMap[b >> 3];
    return {
      r: (r5 << 3) | (r5 >> 2),
      g: (g5 << 3) | (g5 >> 2),
      b: (b5 << 3) | (b5 >> 2),
    };
  }

  private hasDroughtTable(colorMapIndex: number): boolean {
    const tableIndex = -colorMapIndex - 1;
    return !!this.droughtColorTables?.[tableIndex];
  }

  private mapDroughtColor(
    r: number,
    g: number,
    b: number,
    colorMapIndex: number
  ): { r: number; g: number; b: number } {
    const tableIndex = clamp(-colorMapIndex - 1, 0, DROUGHT_TABLE_COUNT - 1);
    const table = this.droughtColorTables?.[tableIndex];
    if (!table || table.length < DROUGHT_TABLE_SIZE) {
      return this.mapPositiveColorMap(r, g, b, 3);
    }

    const r5 = r >> 3;
    const g5 = g >> 3;
    const b5 = b >> 3;
    const offset = ((b5 & 0x1e) << 7) | ((g5 & 0x1e) << 3) | ((r5 & 0x1e) >> 1);
    const droughtColor = table[offset] ?? 0;

    const dr = droughtColor & 0x1f;
    const dg = (droughtColor >> 5) & 0x1f;
    const db = (droughtColor >> 10) & 0x1f;

    return {
      r: (dr << 3) | (dr >> 2),
      g: (dg << 3) | (dg >> 2),
      b: (db << 3) | (db >> 2),
    };
  }

  private async ensureDroughtTablesLoaded(): Promise<void> {
    if (this.droughtColorTables || this.droughtTablesLoadPromise) {
      return this.droughtTablesLoadPromise ?? Promise.resolve();
    }
    if (typeof fetch !== 'function') {
      return;
    }

    this.droughtTablesLoadPromise = (async () => {
      const tables: Uint16Array[] = [];
      for (let i = 0; i < DROUGHT_TABLE_COUNT; i++) {
        const response = await fetch(`/pokeemerald/graphics/weather/drought/colors_${i}.bin`);
        if (!response.ok) {
          throw new Error(`Failed to load drought color table ${i}: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const table = new Uint16Array(buffer);
        if (table.length < DROUGHT_TABLE_SIZE) {
          throw new Error(`Invalid drought color table ${i} size (${table.length})`);
        }
        tables.push(table);
      }
      this.droughtColorTables = tables;
    })()
      .catch((error) => {
        console.warn('[WeatherColorPipeline] Unable to load drought color tables:', error);
      })
      .finally(() => {
        this.droughtTablesLoadPromise = null;
      });

    await this.droughtTablesLoadPromise;
  }
}

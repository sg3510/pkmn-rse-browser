import {
  RUNTIME_PERF_COUNTERS,
  RUNTIME_PERF_SECTIONS,
  type RuntimePerfCapture,
  type RuntimePerfCounter,
  type RuntimePerfCounterMap,
  type RuntimePerfSample,
  type RuntimePerfSection,
  type RuntimePerfStats,
  type RuntimePerfSummary,
} from './runtimePerfTypes.ts';

const MAX_CAPTURE_SAMPLES = 600;

export interface RuntimePerfWindowApi {
  startCapture: (name?: string) => RuntimePerfCapture;
  stopCapture: () => RuntimePerfCapture | null;
  getSummary: () => RuntimePerfSummary | null;
  exportJson: () => string;
}

function createCounterMap(): RuntimePerfCounterMap {
  return {
    waterMaskBuilds: 0,
    waterMaskUploads: 0,
    readPixelsCalls: 0,
    webglCanvasBlits: 0,
    setStateFromRafCalls: 0,
    visibleListRebuilds: 0,
    visiblePairCount: 0,
    visiblePairOverflowFrames: 0,
    resolverGpuFallbackTiles: 0,
    viewportDrivenMapLoads: 0,
  };
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const clamped = Math.max(0, Math.min(1, p));
  const idx = Math.min(sortedValues.length - 1, Math.floor(clamped * (sortedValues.length - 1)));
  return sortedValues[idx] ?? 0;
}

function computeStats(values: number[]): RuntimePerfStats {
  if (values.length === 0) {
    return { avg: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    avg: sum / sorted.length,
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

class RuntimePerfRecorder {
  private capture: RuntimePerfCapture | null = null;
  private currentSample: RuntimePerfSample | null = null;

  startCapture(name: string = 'runtime-capture'): RuntimePerfCapture {
    this.capture = {
      name,
      startedAt: performance.now(),
      samples: [],
    };
    this.currentSample = null;
    return this.capture;
  }

  stopCapture(): RuntimePerfCapture | null {
    if (!this.capture) return null;
    if (this.currentSample) this.endFrame();

    const endedAt = performance.now();
    const summary = this.buildSummary(endedAt);
    this.capture.endedAt = endedAt;
    this.capture.summary = summary;
    return this.capture;
  }

  isCapturing(): boolean {
    return this.capture !== null;
  }

  beginFrame(frame: number, timestamp: number = performance.now()): void {
    if (!this.capture) return;
    if (this.currentSample) this.endFrame();

    this.currentSample = {
      frame,
      timestamp,
      sections: {},
      counters: createCounterMap(),
    };
  }

  recordSection(section: RuntimePerfSection, durationMs: number): void {
    if (!this.currentSample) return;
    this.currentSample.sections[section] = (this.currentSample.sections[section] ?? 0) + durationMs;
  }

  incrementCounter(counter: RuntimePerfCounter, amount: number = 1): void {
    if (!this.currentSample) return;
    this.currentSample.counters[counter] += amount;
  }

  endFrame(): void {
    if (!this.capture || !this.currentSample) return;

    this.capture.samples.push(this.currentSample);
    if (this.capture.samples.length > MAX_CAPTURE_SAMPLES) {
      this.capture.samples.splice(0, this.capture.samples.length - MAX_CAPTURE_SAMPLES);
    }
    this.currentSample = null;
  }

  getSummary(): RuntimePerfSummary | null {
    if (!this.capture) return null;
    return this.buildSummary(performance.now());
  }

  exportJson(): string {
    if (!this.capture) {
      return JSON.stringify({ error: 'no_active_capture' }, null, 2);
    }
    const snapshot: RuntimePerfCapture = {
      ...this.capture,
      samples: [...this.capture.samples],
      summary: this.getSummary() ?? undefined,
    };
    return JSON.stringify(snapshot, null, 2);
  }

  private buildSummary(endedAt: number): RuntimePerfSummary {
    const capture = this.capture;
    if (!capture) {
      return {
        captureName: 'none',
        startedAt: 0,
        endedAt,
        sampleCount: 0,
        sectionStats: {},
        counterTotals: createCounterMap(),
      };
    }

    const sectionValues: Partial<Record<RuntimePerfSection, number[]>> = {};
    const counterTotals = createCounterMap();

    for (const sample of capture.samples) {
      for (const section of RUNTIME_PERF_SECTIONS) {
        const value = sample.sections[section];
        if (value === undefined) continue;
        const list = sectionValues[section] ?? (sectionValues[section] = []);
        list.push(value);
      }
      for (const counter of RUNTIME_PERF_COUNTERS) {
        counterTotals[counter] += sample.counters[counter];
      }
    }

    const sectionStats: Partial<Record<RuntimePerfSection, RuntimePerfStats>> = {};
    for (const section of RUNTIME_PERF_SECTIONS) {
      const values = sectionValues[section];
      if (!values || values.length === 0) continue;
      sectionStats[section] = computeStats(values);
    }

    return {
      captureName: capture.name,
      startedAt: capture.startedAt,
      endedAt,
      sampleCount: capture.samples.length,
      sectionStats,
      counterTotals,
    };
  }
}

export const runtimePerfRecorder = new RuntimePerfRecorder();

export function beginRuntimePerfFrame(frame: number, timestamp: number = performance.now()): void {
  runtimePerfRecorder.beginFrame(frame, timestamp);
}

export function endRuntimePerfFrame(): void {
  runtimePerfRecorder.endFrame();
}

export function recordRuntimePerfSection(section: RuntimePerfSection, durationMs: number): void {
  runtimePerfRecorder.recordSection(section, durationMs);
}

export function incrementRuntimePerfCounter(counter: RuntimePerfCounter, amount: number = 1): void {
  runtimePerfRecorder.incrementCounter(counter, amount);
}

declare global {
  interface Window {
    __PKMN_PERF?: RuntimePerfWindowApi;
  }
}

if (typeof window !== 'undefined') {
  window.__PKMN_PERF = {
    startCapture: (name?: string) => runtimePerfRecorder.startCapture(name),
    stopCapture: () => runtimePerfRecorder.stopCapture(),
    getSummary: () => runtimePerfRecorder.getSummary(),
    exportJson: () => runtimePerfRecorder.exportJson(),
  };
}

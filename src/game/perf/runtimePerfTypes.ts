export const RUNTIME_PERF_SECTIONS = [
  'frameTotal',
  'objectSpawnDespawn',
  'worldUpdate',
  'spriteBuild',
  'composite',
  'debugState',
  'renderStats',
] as const;

export type RuntimePerfSection = (typeof RUNTIME_PERF_SECTIONS)[number];

export const RUNTIME_PERF_COUNTERS = [
  'waterMaskBuilds',
  'waterMaskUploads',
  'readPixelsCalls',
  'webglCanvasBlits',
  'setStateFromRafCalls',
  'visibleListRebuilds',
  'visiblePairCount',
  'visiblePairOverflowFrames',
  'resolverGpuFallbackTiles',
  'viewportDrivenMapLoads',
] as const;

export type RuntimePerfCounter = (typeof RUNTIME_PERF_COUNTERS)[number];

export type RuntimePerfCounterMap = Record<RuntimePerfCounter, number>;

export interface RuntimePerfSample {
  frame: number;
  timestamp: number;
  sections: Partial<Record<RuntimePerfSection, number>>;
  counters: RuntimePerfCounterMap;
}

export interface RuntimePerfStats {
  avg: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface RuntimePerfSummary {
  captureName: string;
  startedAt: number;
  endedAt: number;
  sampleCount: number;
  sectionStats: Partial<Record<RuntimePerfSection, RuntimePerfStats>>;
  counterTotals: RuntimePerfCounterMap;
}

export interface RuntimePerfCapture {
  name: string;
  startedAt: number;
  endedAt?: number;
  samples: RuntimePerfSample[];
  summary?: RuntimePerfSummary;
}

/**
 * Benchmark Runner for Rendering Performance
 *
 * Runs performance benchmarks for both Canvas2D and WebGL renderers
 * across multiple scenarios to establish baselines and track improvements.
 */

import type { BenchmarkScenario } from './benchmarkScenarios';
import { BENCHMARK_SCENARIOS, PERFORMANCE_TARGETS } from './benchmarkScenarios';

export interface BenchmarkMetrics {
  /** Average frame time in milliseconds */
  frameTimeMs: number;
  /** 95th percentile frame time */
  frameTimeP95: number;
  /** Minimum frame time */
  frameTimeMin: number;
  /** Maximum frame time */
  frameTimeMax: number;
  /** Standard deviation */
  frameTimeStdDev: number;
  /** Number of draw calls (estimated for Canvas2D) */
  drawCalls: number;
  /** Estimated memory usage in MB */
  memoryMB: number;
}

export interface BenchmarkResult {
  /** Scenario name */
  scenario: string;
  /** Renderer type */
  renderer: 'canvas2d' | 'webgl';
  /** Performance metrics */
  metrics: BenchmarkMetrics;
  /** Whether it met the performance target */
  meetsTarget: boolean;
  /** Target frame time for this scenario */
  targetMs: number;
  /** Timestamp when benchmark was run */
  timestamp: number;
}

export interface BenchmarkConfig {
  /** Number of warm-up frames to skip */
  warmupFrames: number;
  /** Number of frames to measure */
  measureFrames: number;
  /** Whether to force garbage collection between runs (if available) */
  forceGC: boolean;
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  warmupFrames: 60,
  measureFrames: 300,
  forceGC: true,
};

/**
 * Calculate statistics from an array of frame times
 */
export function calculateStats(frameTimes: number[]): Omit<BenchmarkMetrics, 'drawCalls' | 'memoryMB'> {
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  const squaredDiffs = sorted.map((t) => (t - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  const p95Index = Math.floor(sorted.length * 0.95);

  return {
    frameTimeMs: mean,
    frameTimeP95: sorted[p95Index] ?? sorted[sorted.length - 1],
    frameTimeMin: sorted[0],
    frameTimeMax: sorted[sorted.length - 1],
    frameTimeStdDev: stdDev,
  };
}

/**
 * Simple performance measurement function for Canvas2D rendering
 *
 * This can be used to measure the render function's performance
 * by wrapping calls and collecting timing data.
 */
export function measureRenderPerformance(
  renderFn: () => void,
  config: BenchmarkConfig = DEFAULT_CONFIG
): BenchmarkMetrics {
  const frameTimes: number[] = [];

  // Warm-up phase
  for (let i = 0; i < config.warmupFrames; i++) {
    renderFn();
  }

  // Force GC if available (Node.js with --expose-gc flag)
  if (config.forceGC && typeof global !== 'undefined' && (global as unknown as { gc?: () => void }).gc) {
    (global as unknown as { gc: () => void }).gc();
  }

  // Measurement phase
  for (let i = 0; i < config.measureFrames; i++) {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    frameTimes.push(end - start);
  }

  const stats = calculateStats(frameTimes);

  return {
    ...stats,
    drawCalls: 0, // Will be filled in by the benchmark runner
    memoryMB: 0, // Will be filled in by the benchmark runner
  };
}

/**
 * Check if a result meets its performance target
 */
export function meetsTarget(
  scenario: string,
  renderer: 'canvas2d' | 'webgl',
  frameTimeMs: number
): boolean {
  const target = PERFORMANCE_TARGETS[scenario];
  if (!target) return true; // No target defined

  const targetMs = renderer === 'canvas2d' ? target.canvas2d : target.webgl;
  return frameTimeMs <= targetMs;
}

/**
 * Format benchmark results as a table string
 */
export function formatResults(results: BenchmarkResult[]): string {
  const lines: string[] = [];

  lines.push('┌─────────────────────────┬──────────┬────────────┬────────────┬────────────┬────────┐');
  lines.push('│ Scenario                │ Renderer │ Avg (ms)   │ P95 (ms)   │ Target     │ Status │');
  lines.push('├─────────────────────────┼──────────┼────────────┼────────────┼────────────┼────────┤');

  for (const result of results) {
    const scenario = result.scenario.padEnd(23);
    const renderer = result.renderer.padEnd(8);
    const avg = result.metrics.frameTimeMs.toFixed(2).padStart(10);
    const p95 = result.metrics.frameTimeP95.toFixed(2).padStart(10);
    const target = result.targetMs.toFixed(2).padStart(10);
    const status = result.meetsTarget ? '  ✓   ' : '  ✗   ';

    lines.push(`│ ${scenario} │ ${renderer} │ ${avg} │ ${p95} │ ${target} │${status}│`);
  }

  lines.push('└─────────────────────────┴──────────┴────────────┴────────────┴────────────┴────────┘');

  return lines.join('\n');
}

/**
 * Save results to JSON
 */
export function serializeResults(results: BenchmarkResult[]): string {
  return JSON.stringify(
    {
      timestamp: Date.now(),
      results,
    },
    null,
    2
  );
}

/**
 * Compare two benchmark runs and report improvements/regressions
 */
export function compareResults(
  baseline: BenchmarkResult[],
  current: BenchmarkResult[]
): Array<{
  scenario: string;
  renderer: string;
  baselineMs: number;
  currentMs: number;
  changePercent: number;
  improved: boolean;
}> {
  const comparisons: Array<{
    scenario: string;
    renderer: string;
    baselineMs: number;
    currentMs: number;
    changePercent: number;
    improved: boolean;
  }> = [];

  for (const curr of current) {
    const base = baseline.find(
      (b) => b.scenario === curr.scenario && b.renderer === curr.renderer
    );

    if (base) {
      const changePercent =
        ((curr.metrics.frameTimeMs - base.metrics.frameTimeMs) / base.metrics.frameTimeMs) * 100;

      comparisons.push({
        scenario: curr.scenario,
        renderer: curr.renderer,
        baselineMs: base.metrics.frameTimeMs,
        currentMs: curr.metrics.frameTimeMs,
        changePercent,
        improved: changePercent < 0,
      });
    }
  }

  return comparisons;
}

/**
 * Get all scenarios
 */
export function getAllScenarios(): BenchmarkScenario[] {
  return BENCHMARK_SCENARIOS;
}

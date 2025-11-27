/**
 * Benchmark Scenarios for Rendering Performance Testing
 *
 * These scenarios cover the range of rendering loads from
 * simple static maps to complex animated maps with weather.
 */

export interface BenchmarkScenario {
  /** Unique scenario name */
  name: string;
  /** Viewport width in metatiles */
  tilesWide: number;
  /** Viewport height in metatiles */
  tilesHigh: number;
  /** Total tile count */
  tiles: number;
  /** Whether to include animated tiles */
  animated: boolean;
  /** Approximate number of animated tiles (for water-edge scenarios) */
  animatedTileCount?: number;
  /** Description of the scenario */
  description: string;
}

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    name: '20x20-static',
    tilesWide: 20,
    tilesHigh: 20,
    tiles: 400,
    animated: false,
    description: 'Static 20x20 viewport, no animations',
  },
  {
    name: '20x20-water-edge',
    tilesWide: 20,
    tilesHigh: 20,
    tiles: 400,
    animated: true,
    animatedTileCount: 20,
    description: '20x20 with water at edges (~5% animated)',
  },
  {
    name: '20x20-full-water',
    tilesWide: 20,
    tilesHigh: 20,
    tiles: 400,
    animated: true,
    animatedTileCount: 300,
    description: '20x20 mostly water (~75% animated)',
  },
  {
    name: '40x40-static',
    tilesWide: 40,
    tilesHigh: 40,
    tiles: 1600,
    animated: false,
    description: 'Static 40x40 viewport, no animations',
  },
  {
    name: '40x40-water-edge',
    tilesWide: 40,
    tilesHigh: 40,
    tiles: 1600,
    animated: true,
    animatedTileCount: 80,
    description: '40x40 with water at edges (~5% animated)',
  },
  {
    name: '40x40-full-water',
    tilesWide: 40,
    tilesHigh: 40,
    tiles: 1600,
    animated: true,
    animatedTileCount: 1200,
    description: '40x40 mostly water (~75% animated)',
  },
  {
    name: '20x20-with-npcs',
    tilesWide: 20,
    tilesHigh: 20,
    tiles: 400,
    animated: true,
    animatedTileCount: 40,
    description: '20x20 with 10 NPCs and some water',
  },
  {
    name: '40x40-everything',
    tilesWide: 40,
    tilesHigh: 40,
    tiles: 1600,
    animated: true,
    animatedTileCount: 400,
    description: '40x40 with NPCs, water, flowers - full load',
  },
];

/**
 * Performance targets in milliseconds per frame
 * Budget at 60fps = 16.67ms per frame
 */
export const PERFORMANCE_TARGETS: Record<string, { canvas2d: number; webgl: number }> = {
  '20x20-static': { canvas2d: 4, webgl: 0.3 },
  '20x20-water-edge': { canvas2d: 8, webgl: 0.5 },
  '20x20-full-water': { canvas2d: 10, webgl: 0.8 },
  '40x40-static': { canvas2d: 16, webgl: 0.5 },
  '40x40-water-edge': { canvas2d: 20, webgl: 1.0 },
  '40x40-full-water': { canvas2d: 35, webgl: 1.5 },
  '20x20-with-npcs': { canvas2d: 10, webgl: 1.0 },
  '40x40-everything': { canvas2d: 50, webgl: 2.0 },
};

/**
 * Get scenario by name
 */
export function getScenario(name: string): BenchmarkScenario | undefined {
  return BENCHMARK_SCENARIOS.find((s) => s.name === name);
}

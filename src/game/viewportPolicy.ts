import type { ViewportConfig } from '../config/viewport';

export type FidelityMode = 'strict' | 'enhanced';
export type ActivationMode = 'emerald' | 'expanded';

export interface ViewportPolicy {
  fidelityMode: FidelityMode;
  activationMode: ActivationMode;
  renderViewport: {
    tilesWide: number;
    tilesHigh: number;
  };
  simulationViewport: {
    tilesWide: number;
    tilesHigh: number;
  };
  preloadMarginTiles: number;
  cameraMarginTiles: number;
}

export const GBA_SIMULATION_VIEWPORT = {
  tilesWide: 15,
  tilesHigh: 10,
} as const;

export function createViewportPolicy(
  renderViewport: ViewportConfig,
  overrides?: Partial<ViewportPolicy>
): ViewportPolicy {
  return {
    fidelityMode: overrides?.fidelityMode ?? 'strict',
    activationMode: overrides?.activationMode ?? 'emerald',
    renderViewport: {
      tilesWide: renderViewport.tilesWide,
      tilesHigh: renderViewport.tilesHigh,
    },
    simulationViewport: overrides?.simulationViewport ?? GBA_SIMULATION_VIEWPORT,
    preloadMarginTiles: overrides?.preloadMarginTiles ?? 2,
    cameraMarginTiles: overrides?.cameraMarginTiles ?? 0,
  };
}

export function usesExpandedActivation(policy: ViewportPolicy): boolean {
  return policy.activationMode === 'expanded';
}


import type { ActivationMode, FidelityMode } from '../game/viewportPolicy.ts';

export type PresentationMode = 'hybrid-modern' | 'strict-presentation' | 'enhanced';
export type TitlePresentationMode = 'rayquaza-3d' | 'emerald-2d';
export type HybridBattlePresentationPreference = 'overlay' | 'scene';

export interface HybridModernDefaults {
  presentationMode: PresentationMode;
  fidelityMode: FidelityMode;
  activationMode: ActivationMode;
  battlePresentationPreference: HybridBattlePresentationPreference;
  titlePresentationMode: TitlePresentationMode;
  touchControlsEnabled: boolean;
  largerViewportEnabled: boolean;
}

export const HYBRID_MODERN_DEFAULTS: HybridModernDefaults = {
  presentationMode: 'hybrid-modern',
  fidelityMode: 'strict',
  activationMode: 'emerald',
  battlePresentationPreference: 'overlay',
  titlePresentationMode: 'rayquaza-3d',
  touchControlsEnabled: true,
  largerViewportEnabled: true,
};

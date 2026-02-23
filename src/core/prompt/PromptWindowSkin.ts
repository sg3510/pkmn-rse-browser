import type { PromptWindowProfile } from './PromptWindowProfile.ts';

export interface PromptWindowSkinPreloadOptions {
  frameStyle?: number;
}

export interface PromptWindowSkinDrawRequest {
  originX: number;
  originY: number;
  scale: number;
  profile: PromptWindowProfile;
  frameStyle?: number;
}

export interface PromptWindowSkin {
  readonly id: string;
  preload?: (options?: PromptWindowSkinPreloadOptions) => Promise<void>;
  draw: (ctx: CanvasRenderingContext2D, request: PromptWindowSkinDrawRequest) => void;
}

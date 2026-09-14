/** C references: public/pokeemerald/include/battle_anim.h, src/battle_anim.c, src/sprite.c. */
export type BattlerSlot = 0 | 1 | 2 | 3;
export interface AnimationInstruction { readonly op: string; readonly args: readonly (number | string)[]; readonly line: number }
export interface AnimationProgram {
  readonly sourceHash: string;
  readonly instructions: readonly AnimationInstruction[];
  readonly labels: Readonly<Record<string, number>>;
  readonly moveEntries: Readonly<Record<number, string>>;
}
export interface FrameCommand { readonly op: string; readonly args: readonly number[]; readonly hFlip?: boolean; readonly vFlip?: boolean }
export interface AnimationFrameShape { readonly tileOffset: number; readonly width: number; readonly height: number }
export interface AnimationTemplate {
  readonly callback: string; readonly tag: number; readonly width: number; readonly height: number;
  readonly blend: boolean; readonly affine: boolean;
  readonly frames: readonly (readonly FrameCommand[])[];
  readonly affineFrames: readonly (readonly FrameCommand[])[];
  readonly source: string;
  readonly extraFrames?: readonly AnimationFrameShape[];
}
export interface AnimationAsset { readonly path: string; readonly parts?: readonly string[]; readonly palette: readonly (readonly number[])[]; readonly byteSize: number }
export interface AnimationBackground { readonly path: string; readonly tilemap: string; readonly palette: readonly (readonly number[])[]; readonly cycleColors: number }
export interface AnimationColorBlend { color: number; amount: number }
export interface AnimationBattler {
  readonly slot: BattlerSlot; readonly side: 'player' | 'opponent'; readonly identity: string;
  readonly species: number; readonly x: number; readonly y: number; readonly pictureY: number;
}
export interface AnimationRequest {
  readonly moveId: number; readonly attacker: BattlerSlot; readonly target: BattlerSlot;
  readonly battlers: readonly AnimationBattler[];
  readonly seed: number;
  readonly turn?: number;
}
export type AnimationStatus = 'loading' | 'running' | 'completed' | 'skipped' | 'cancelled' | 'failed';
export interface AnimationHandle { readonly status: AnimationStatus; readonly reason?: string; readonly finished: Promise<AnimationStatus> }
export interface AnimationPose { x: number; y: number; scaleX?: number; scaleY?: number }
export interface AnimationParticle {
  id: number; template: string; x: number; y: number; tileOffset: number;
  scaleX: number; scaleY: number; rotation: number; flipX: boolean; flipY: boolean;
  /** C OAM subpriority: lower draws in front. */
  subpriority: number;
  hidden?: boolean; width?: number; height?: number;
}
export interface AnimationTrace { frame: number; kind: string; symbol: string; line?: number }

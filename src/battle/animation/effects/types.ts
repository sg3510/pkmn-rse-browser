/** Ported callback contract; original behaviors live in public/pokeemerald/src/battle_anim*.c. */
import type { AnimationBattler, AnimationColorBlend, AnimationParticle, AnimationPose, AnimationRequest, AnimationTemplate, BattlerSlot } from '../types.ts';
import type { AnimationAudioCue, AnimationSoundHandle } from '../audio/AnimationAudio.ts';
import type { FrameAnimation } from '../runtime/FrameAnimation.ts';
export interface EffectInstance {
  id: number; symbol: string; kind: 'sprite' | 'task'; priority: number; alive: boolean;
  data: Int16Array; phase: number; pose: AnimationPose; slot?: BattlerSlot;
  waitGroup?: 'visual' | 'sound' | 'detached';
  particle?: AnimationParticle; frames?: FrameAnimation; affine?: FrameAnimation;
  step(context: EffectContext, effect: EffectInstance): void;
}
export interface EffectContext {
  readonly request: AnimationRequest;
  readonly args: Int16Array;
  readonly frame: number;
  resolve(role: number): AnimationBattler | undefined;
  sound(cue: Omit<AnimationAudioCue, 'frame'>): AnimationSoundHandle;
  criesComplete(): boolean;
  destroy(effect: EffectInstance): void;
  setPalette(mask: number, blend: AnimationColorBlend): void;
  setHidden(slot: BattlerSlot, hidden: boolean): void;
  cycleBackground(): void;
  spawnSprite(template: string, options: { x: number; y: number; width: number; height: number; tileOffset: number; mode: number }): void;
}
export interface EffectFactory {
  readonly children: readonly string[];
  initialize(context: EffectContext, effect: EffectInstance, template?: AnimationTemplate): void;
}

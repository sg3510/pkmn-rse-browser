/** Sound hook contract for public/pokeemerald/src/battle_anim.c and battle_anim_sound_tasks.c. */
export interface AnimationAudioCue {
  kind: 'effect' | 'cry'; id: number; frame: number; pan: number; mode?: number;
}
export interface AnimationSoundHandle { readonly completed: boolean; stop(): void }
export interface AnimationAudio { play(cue: AnimationAudioCue): AnimationSoundHandle }
const SILENT_HANDLE: AnimationSoundHandle = Object.freeze({ completed: true, stop() {} });
/** No AudioContext, asset downloads, timers, or assumed clip lengths. */
export class SilentAnimationAudio implements AnimationAudio {
  play(_cue: AnimationAudioCue): AnimationSoundHandle { return SILENT_HANDLE; }
}

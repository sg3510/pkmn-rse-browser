/** Browser and headless fixtures share these registered C callback ports. */
import { BATTLE_ANIMATION_ASSETS, BATTLE_ANIMATION_BACKGROUNDS, BATTLE_ANIMATION_PROGRAM, BATTLE_ANIMATION_TEMPLATES } from '../../data/battleAnimationPrograms.gen.ts';
import { movementEffects } from './effects/movement.ts';
import { normalEffects } from './effects/normal.ts';
import { AnimationPlayer, type AnimationPlayerOptions } from './runtime/AnimationPlayer.ts';
import { projectileEffects } from './effects/projectiles.ts';
import { paletteEffects } from './effects/palette.ts';
import { electricEffects } from './effects/electric.ts';
import { soundEffects } from './effects/sound.ts';
export const BATTLE_ANIMATION_EFFECTS = { ...movementEffects, ...normalEffects, ...projectileEffects, ...paletteEffects, ...electricEffects, ...soundEffects };
export function createAnimationPlayer(options: Pick<AnimationPlayerOptions, 'preload' | 'audio' | 'trace'> = {}): AnimationPlayer {
  return new AnimationPlayer({ program: BATTLE_ANIMATION_PROGRAM, templates: BATTLE_ANIMATION_TEMPLATES,
    assets: BATTLE_ANIMATION_ASSETS, backgrounds: BATTLE_ANIMATION_BACKGROUNDS, effects: BATTLE_ANIMATION_EFFECTS, ...options });
}

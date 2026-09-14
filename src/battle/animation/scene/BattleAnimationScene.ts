/** Anchors/OBJ layering from public/pokeemerald/src/battle_anim_mons.c and battle_anim.c. */
import { BATTLE_ANIMATION_TEMPLATES } from '../../../data/battleAnimationPrograms.gen.ts';
import { getPokemonSpriteCoords } from '../../../data/pokemonSpriteCoords.gen.ts';
import { BATTLE_LAYOUT } from '../../render/BattleLayout.ts';
import type { SpriteInstance } from '../../../rendering/types.ts';
import type { AnimationBattler, BattlerSlot } from '../types.ts';
import type { AnimationPlayer } from '../runtime/AnimationPlayer.ts';
import type { AnimationAssets } from '../assets/AnimationAssets.ts';
export function createAnimationBattler(slot: BattlerSlot, species: number, identity: string): AnimationBattler {
  const player = slot % 2 === 0;
  const coords = getPokemonSpriteCoords(species);
  const layout = player ? BATTLE_LAYOUT.player : BATTLE_LAYOUT.enemy;
  const y = layout.spriteY + 32;
  return { slot, species, identity, side: player ? 'player' : 'opponent', x: layout.spriteX + 32, y,
    pictureY: Math.min(104, y + (player ? (coords?.backYOffset ?? 0) + 8 : (coords?.frontYOffset ?? 0) - (coords?.elevation ?? 0))) };
}
/** Reuses instance storage; only the live effects enter the existing sprite batch. */
export class BattleAnimationScene {
  private instances: SpriteInstance[] = [];
  private assets: Pick<AnimationAssets, 'getFrame' | 'getBackground'>;
  constructor(assets: Pick<AnimationAssets, 'getFrame' | 'getBackground'>) { this.assets = assets; }
  applyPose(sprite: SpriteInstance, slot: BattlerSlot, player: AnimationPlayer): void {
    const pose = player.poses[slot]; sprite.worldX += pose.x; sprite.worldY += pose.y;
    if (pose.scaleX !== undefined) sprite.scaleX = (sprite.scaleX ?? 1) * pose.scaleX;
    if (pose.scaleY !== undefined) sprite.scaleY = (sprite.scaleY ?? 1) * pose.scaleY;
    if (player.hiddenSlots.has(slot)) sprite.alpha = 0;
    const blend = player.paletteBlends.get(slot);
    sprite.paletteBlend = blend ? colorBlend(blend.color, blend.amount) : undefined;
    // monbg moves this battler behind OBJ effects. This matters when the opponent's
    // hit splat has a lower drawing order than the normal player backsprite.
    if (player.monBackgroundSlots.has(slot)) sprite.sortKey = 2;
  }
  appendSprites(sprites: SpriteInstance[], player: AnimationPlayer): void {
    const background = sprites[0];
    if (background) {
      if (player.backgroundId !== null) {
        const frame = this.assets.getBackground(player.backgroundId, player.backgroundCycle);
        background.atlasName = frame.atlas; background.atlasX = 0; background.atlasY = frame.y;
        background.width = background.atlasWidth = frame.width; background.height = background.atlasHeight = frame.height;
      }
      const blend = player.paletteBlends.get(-1);
      background.paletteBlend = blend ? colorBlend(blend.color, blend.amount) : undefined;
      background.tintR *= 1 - player.backgroundDarkness; background.tintG *= 1 - player.backgroundDarkness; background.tintB *= 1 - player.backgroundDarkness;
    }
    for (let i = 0; i < player.particles.length; i++) {
      const node = player.particles[i];
      const frame = this.assets.getFrame(node.template, node.tileOffset, node.width, node.height);
      const sprite = this.instances[i] ??= {
        worldX: 0, worldY: 0, width: 0, height: 0, atlasName: '', atlasX: 0, atlasY: 0,
        atlasWidth: 0, atlasHeight: 0, flipX: false, flipY: false, alpha: 1,
        tintR: 1, tintG: 1, tintB: 1, sortKey: 0, isReflection: false,
      };
      sprite.worldX = Math.trunc(node.x) - frame.width / 2; sprite.worldY = Math.trunc(node.y) - frame.height / 2;
      sprite.width = sprite.atlasWidth = frame.width; sprite.height = sprite.atlasHeight = frame.height;
      sprite.atlasName = frame.atlas; sprite.atlasY = frame.y;
      sprite.scaleX = node.scaleX; sprite.scaleY = node.scaleY; sprite.rotationDeg = node.rotation;
      sprite.flipX = node.flipX; sprite.flipY = node.flipY;
      sprite.gbaBlend = BATTLE_ANIMATION_TEMPLATES[node.template].blend ? player.alpha ?? undefined : undefined;
      sprite.sortKey = 50 - node.subpriority;
      sprites.push(sprite);
    }
    // monbg makes the selected battler a background target for semitransparent OBJ pixels.
    // Singles resolve partner groups to the active battler; doubles composition remains separate.
    sprites.sort((a, b) => a.sortKey - b.sortKey);
  }
}

function colorBlend(color: number, amount: number): readonly [number, number, number, number] {
  return [(color & 31) / 31, ((color >> 5) & 31) / 31, ((color >> 10) & 31) / 31, Math.max(0, Math.min(1, amount))];
}

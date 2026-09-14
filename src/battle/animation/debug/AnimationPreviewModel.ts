/** Isolated fixtures using production mechanics, animation, and presentation. Never accesses SaveManager. */
import { BattleEngine } from '../../engine/BattleEngine.ts';
import { battlePokemonIdentity } from '../../engine/battlePresentationEvents.ts';
import { withBattleRngAdapter } from '../../engine/BattleRng.ts';
import { BattlePresentationSequence } from '../../presentation/BattlePresentationSequence.ts';
import { buildTurnPresentation } from '../../presentation/buildTurnPresentation.ts';
import { createMoveAnimationStep } from '../../presentation/moveAnimationStep.ts';
import { createTestPokemon } from '../../../pokemon/testFactory.ts';
import { getMoveName, MOVES } from '../../../data/moves.ts';
import { getSpeciesName } from '../../../data/species.ts';
import { createAnimationBattler } from '../scene/BattleAnimationScene.ts';
import type { AnimationPlayer } from '../runtime/AnimationPlayer.ts';
export interface PreviewConfig { moveId: number; attacker: 0 | 1; playerSpecies: number; enemySpecies: number; seed: number; enabled: boolean; mode: 'animation' | 'turn' }
export class AnimationPreviewModel {
  player: AnimationPlayer;
  sequence = new BattlePresentationSequence(() => {});
  config!: PreviewConfig;
  hp = [30, 30]; targetHp = [30, 30]; maxHp = [30, 30]; status = [0, 0];
  faint = [0, 0]; damageFlash = [0, 0];
  private fainting = [false, false];
  private engine: BattleEngine | null = null;
  private resultState = '';
  constructor(player: AnimationPlayer) { this.player = player; }
  get message(): string {
    return this.config.mode === 'turn' ? this.sequence.currentMessage
      : `${getSpeciesName(this.config.attacker === 0 ? this.config.playerSpecies : this.config.enemySpecies)} used ${getMoveName(this.config.moveId)}!`;
  }
  get mechanicsUnchanged(): boolean { return !this.engine || JSON.stringify([this.engine.getPlayer(), this.engine.getEnemy()]) === this.resultState; }
  reset(config: PreviewConfig): void {
    this.sequence.cancel(); this.player.cancel('Preview reset'); this.config = { ...config };
    this.engine = null; this.faint = [0, 0]; this.fainting = [false, false]; this.damageFlash = [0, 0]; this.status = [0, 0];
    const pokemon = [config.playerSpecies, config.enemySpecies].map((species, index) => createTestPokemon({
      species, level: 15, personality: index + 101, nickname: getSpeciesName(species),
      ivs: { hp: 20, attack: 20, defense: 20, speed: 20, spAttack: 20, spDefense: 20 },
      moves: [index === config.attacker ? config.moveId : MOVES.TACKLE, 0, 0, 0],
    }));
    this.hp = pokemon.map((mon) => mon.stats.hp); this.targetHp = [...this.hp]; this.maxHp = [...this.hp];
    if (config.mode === 'animation') {
      this.player.start({ moveId: config.moveId, attacker: config.attacker, target: config.attacker === 0 ? 1 : 0,
        seed: config.seed, battlers: [createAnimationBattler(0, config.playerSpecies, 'preview-player'), createAnimationBattler(1, config.enemySpecies, 'preview-enemy')] }, config.enabled);
      return;
    }
    const engine = this.engine = new BattleEngine({ config: { type: 'wild' }, playerPokemon: pokemon[0], enemyPokemon: pokemon[1] });
    let seed = config.seed >>> 0;
    const result = withBattleRngAdapter({ next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; } },
      () => engine.executeTurn({ type: 'fight', moveId: pokemon[0].moves[0], moveSlot: 0 }));
    this.resultState = JSON.stringify([engine.getPlayer(), engine.getEnemy()]);
    const entries = buildTurnPresentation(result.events, [], {
      animation: (event) => createMoveAnimationStep(event, this.player, { enabled: () => config.enabled,
        identity: (slot) => battlePokemonIdentity(slot === 0 ? engine.getPlayer() : engine.getEnemy()) }),
      eventStart: (event) => () => {
        const slot = event.battler ?? 0;
        if (event.hpAfter !== undefined) this.targetHp[slot] = event.hpAfter;
        else if (['heal', 'drain'].includes(event.type)) this.targetHp[slot] = Math.min(this.maxHp[slot], this.targetHp[slot] + (event.value ?? 0));
        else if (event.type === 'damage') this.targetHp[slot] = Math.max(0, this.targetHp[slot] - (event.value ?? 0));
        if (event.type === 'damage' && config.enabled) this.damageFlash[slot] = 220;
        if (event.statusAfter !== undefined) this.status[slot] = event.statusAfter;
        if (event.type === 'faint') this.targetHp[slot] = 0;
      },
      changesHp: (event) => ['damage', 'heal', 'drain'].includes(event.type),
      hpComplete: () => this.hp.every((hp, i) => hp === this.targetHp[i] && this.damageFlash[i] === 0),
      startFaint: (slot) => { this.fainting[slot] = true; }, faintComplete: (slot) => this.faint[slot] >= 1,
    });
    this.sequence.start(entries);
  }
  update(dt: number): void {
    this.player.advance(dt);
    for (let i = 0; i < 2; i++) {
      const step = Math.max(1, Math.floor(dt / 1000 * 96));
      this.hp[i] += Math.sign(this.targetHp[i] - this.hp[i]) * Math.min(step, Math.abs(this.targetHp[i] - this.hp[i]));
      this.damageFlash[i] = Math.max(0, this.damageFlash[i] - dt);
      if (this.fainting[i]) this.faint[i] = Math.min(1, this.faint[i] + dt / 420);
    }
    this.sequence.tick();
  }
}

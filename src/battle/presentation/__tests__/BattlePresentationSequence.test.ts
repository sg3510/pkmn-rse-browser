import assert from 'node:assert/strict';
import test from 'node:test';
import { BattlePresentationSequence } from '../BattlePresentationSequence.ts';
import { AnimationPreviewModel } from '../../animation/debug/AnimationPreviewModel.ts';
import { createAnimationPlayer } from '../../animation/createAnimationPlayer.ts';
import { createMoveAnimationStep } from '../moveAnimationStep.ts';
import { createDefaultSide } from '../../engine/types.ts';
import { BattleEngine } from '../../engine/BattleEngine.ts';
import { executeMove } from '../../engine/MoveEffects.ts';
import { withBattleRngAdapter } from '../../engine/BattleRng.ts';
import { createTestPokemon } from '../../../pokemon/testFactory.ts';
import { SPECIES } from '../../../data/species.ts';
import { MOVES } from '../../../data/moves.ts';
import { GBA_FRAME_MS } from '../../../config/timing.ts';
import { STATUS } from '../../../pokemon/types.ts';
import { BATTLE_ANIMATION_PROGRAM } from '../../../data/battleAnimationPrograms.gen.ts';
test('rapid confirmation cannot skip animation or HP barriers; callbacks run exactly once', () => {
  const shown: string[] = [], started: string[] = []; let animationDone = false, hpDone = false, complete = 0;
  const sequence = new BattlePresentationSequence((text) => shown.push(text));
  sequence.start([{ text: 'Used Tackle!' },
    { step: { kind: 'animation', start: () => { started.push('animation'); }, complete: () => animationDone } },
    { step: { kind: 'hp', start: () => { started.push('hp'); }, complete: () => hpDone } },
    { text: 'Next move!' }], () => { complete++; });
  sequence.advanceMessage(); for (let i = 0; i < 20; i++) { sequence.advanceMessage(); sequence.tick(); }
  assert.deepEqual(started, ['animation']); assert.deepEqual(shown, ['Used Tackle!']);
  animationDone = true; sequence.tick(); sequence.advanceMessage(); assert.deepEqual(started, ['animation', 'hp']);
  hpDone = true; sequence.tick(); assert.deepEqual(shown, ['Used Tackle!', 'Next move!']);
  sequence.advanceMessage(); sequence.tick(); assert.equal(complete, 1);
});
test('replacing/cancelling a sequence never runs its stale completion callback', () => {
  let stale = 0, fresh = 0;
  const sequence = new BattlePresentationSequence(() => {});
  sequence.start([{ text: 'old' }], () => { stale++; });
  sequence.start([{ text: 'new' }], () => { fresh++; });
  sequence.advanceMessage(); assert.equal(stale, 0); assert.equal(fresh, 1);
  sequence.cancel(); sequence.tick(); assert.equal(fresh, 1);
});
function fixture(moveId = MOVES.TACKLE, enemySpecies = SPECIES.POOCHYENA) {
  const mon = (species: number) => createTestPokemon({ species, level: 15, personality: 100,
    ivs: { hp: 20, attack: 20, defense: 20, speed: 20, spAttack: 20, spDefense: 20 }, moves: [moveId, 0, 0, 0] });
  const engine = new BattleEngine({ config: { type: 'wild' }, playerPokemon: mon(SPECIES.MUDKIP), enemyPokemon: mon(enemySpecies) });
  return { engine, context: { attacker: engine.getPlayer(), defender: engine.getEnemy(), moveId, moveSlot: 0,
    actionId: 12, weather: { type: 'none' as const, turnsRemaining: 0, permanent: false }, attackerSide: createDefaultSide(), defenderSide: createDefaultSide() } };
}
test('success emits one immutable animation event before damage/stat changes; PP and mechanics resolve only once', () => {
  for (const move of [MOVES.TACKLE, MOVES.GROWL]) {
    const { context } = fixture(move);
    const result = withBattleRngAdapter({ next: () => .1 }, () => executeMove(context));
    assert.equal(result.events.filter((event) => event.type === 'animation').length, 1);
    assert.equal(result.events[1].type, 'animation');
    assert.equal(context.attacker.pokemon.pp[0], 34);
    const data = result.events[1].presentation!;
    const originalHp = data.before[1].hp; context.defender.currentHp = 0;
    assert.equal(data.before[1].hp, originalHp); assert(Object.isFrozen(data.before[1]));
    assert.equal(data.actionId, 12);
  }
});
test('miss, protection, immunity and a failed stat drop do not emit an attack animation', () => {
  const miss = fixture(); const protectedMove = fixture(); protectedMove.context.defender.volatile.protect = true;
  const immune = fixture(MOVES.TACKLE, SPECIES.GASTLY);
  const failed = fixture(MOVES.GROWL); failed.context.defender.stages.attack = -6;
  for (const [context, roll] of [[miss.context, .999], [protectedMove.context, .1], [immune.context, .1], [failed.context, .1]] as const) {
    const result = withBattleRngAdapter({ next: () => roll }, () => executeMove(context));
    assert.equal(result.events.filter((event) => event.type === 'animation').length, 0);
  }
});
test('queued animation cannot attach to a replacement Pokémon', () => {
  const { context } = fixture(); const result = withBattleRngAdapter({ next: () => .1 }, () => executeMove(context));
  const player = createAnimationPlayer();
  const step = createMoveAnimationStep(result.events[1], player, { enabled: () => true, identity: () => 'replacement' });
  const sequence = new BattlePresentationSequence(() => {}); sequence.start([step.entry]);
  assert(!sequence.active); assert(!player.active); assert(!step.played());
});
test('Rest and status-curing moves record their HUD state at the event that changes it', () => {
  for (const move of [MOVES.REST, MOVES.HEAL_BELL, MOVES.AROMATHERAPY, MOVES.FLAME_WHEEL]) {
    const { context } = fixture(move);
    context.attacker.currentHp -= 5;
    context.attacker.pokemon.status = STATUS.POISON;
    context.defender.pokemon.status = STATUS.FREEZE;
    const result = withBattleRngAdapter({ next: () => .5 }, () => executeMove(context));
    const update = result.events.find((event) => event.statusAfter !== undefined)!;
    assert(update, `Missing status display update for ${move}`);
    assert.equal(update.statusAfter, move === MOVES.REST ? 3 : STATUS.NONE);
    assert.equal(update.battler, move === MOVES.FLAME_WHEEL ? 1 : 0);
  }
});
test('real engine turns preserve final mechanics while display waits for animations, including option-off', () => {
  for (const move of Object.keys(BATTLE_ANIMATION_PROGRAM.moveEntries).map(Number)) for (const enabled of [true, false]) for (const attacker of [0, 1] as const) {
    const model = new AnimationPreviewModel(createAnimationPlayer());
    model.reset({ mode: 'turn', moveId: move, attacker, playerSpecies: SPECIES.GARDEVOIR,
      enemySpecies: SPECIES.MUDKIP, seed: 7, enabled });
    assert.deepEqual(model.hp, model.maxHp);
    model.sequence.advanceMessage();
    if (enabled) { assert.equal(model.sequence.currentKind, 'animation'); assert.deepEqual(model.hp, model.maxHp); }
    const played = new Set<number>();
    for (let i = 0; model.sequence.active && i < 1000; i++) {
      model.sequence.advanceMessage(); model.update(GBA_FRAME_MS); assert(model.mechanicsUnchanged);
      if (model.player.active) played.add(model.player.request.moveId);
    }
    assert(!model.sequence.active); assert(!model.player.active); assert.deepEqual(model.hp, model.targetHp);
    if (enabled) assert(played.has(move), `Move ${move}, side ${attacker} did not play`);
    else assert.equal(played.size, 0);
  }
});

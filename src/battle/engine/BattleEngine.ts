/**
 * Battle engine turn orchestrator (logic only, no rendering).
 *
 * C ref:
 * - public/pokeemerald/src/battle_main.c (GetWhoStrikesFirst, turn order)
 * - public/pokeemerald/src/battle_util.c (TryRunFromBattle, end-of-turn effects)
 */

import { ABILITIES } from '../../data/abilities';
import { getBattleMoveData } from '../../data/battleMoves.gen';
import { HOLD_EFFECTS, getItemBattleEffect } from '../../data/itemBattleEffects.gen';
import { MOVES } from '../../data/moves';
import { getSpeciesName } from '../../data/species';
import type { PartyPokemon } from '../../pokemon/types';
import { STATUS } from '../../pokemon/types';
import { getAbility } from '../../pokemon/stats';
import { executeMove } from './MoveEffects';
import { applyEndOfTurnStatus, checkPreMoveStatus, hasStatus } from './StatusEffects';
import type {
  BattleAction,
  BattleConfig,
  BattleEvent,
  BattleOutcome,
  BattlePokemon,
  FightAction,
  SideState,
  TurnResult,
  WeatherState,
} from './types';
import { applyStatStage, createDefaultSide, createDefaultStages, createDefaultVolatile } from './types';
import { createDefaultWeather, tickWeather } from './Weather';

interface BattleEngineInit {
  config: BattleConfig;
  playerPokemon: PartyPokemon;
  enemyPokemon: PartyPokemon;
}

interface OrderedAction {
  actor: BattlePokemon;
  actorSide: SideState;
  target: BattlePokemon;
  targetSide: SideState;
  action: BattleAction;
}

export class BattleEngine {
  private readonly config: BattleConfig;

  private readonly player: BattlePokemon;
  private readonly enemy: BattlePokemon;

  private readonly playerSide: SideState = createDefaultSide();
  private readonly enemySide: SideState = createDefaultSide();
  private weather: WeatherState = createDefaultWeather();

  private outcome: BattleOutcome | null = null;
  private escapeAttempts = 0;

  constructor(init: BattleEngineInit) {
    this.config = init.config;
    this.player = this.wrapPartyMon(init.playerPokemon, true, 0);
    this.enemy = this.wrapPartyMon(init.enemyPokemon, false, 0);
  }

  getPlayer(): BattlePokemon {
    return this.player;
  }

  getEnemy(): BattlePokemon {
    return this.enemy;
  }

  getWeather(): WeatherState {
    return this.weather;
  }

  getOutcome(): BattleOutcome | null {
    return this.outcome;
  }

  executeTurn(playerAction: BattleAction): TurnResult {
    const events: BattleEvent[] = [];

    if (this.outcome !== null) {
      return { events, outcome: this.outcome };
    }

    if (playerAction.type === 'run') {
      this.handleRunAttempt(events);
      if (this.outcome === null && this.player.currentHp > 0 && this.enemy.currentHp > 0) {
        this.executeEnemyActionOnly(events);
      }
      if (this.outcome === null) {
        this.applyEndOfTurn(events);
        this.resolveOutcome();
      }
      this.finalizeTurnState();
      return { events, outcome: this.outcome };
    }

    const enemyAction = this.chooseEnemyAction();
    const ordered = this.orderActions(playerAction, enemyAction);

    for (const turnAction of ordered) {
      if (this.outcome !== null) break;
      if (turnAction.actor.currentHp <= 0 || turnAction.target.currentHp <= 0) continue;

      const preCheck = checkPreMoveStatus(turnAction.actor);
      events.push(...preCheck.events);
      if (!preCheck.canAct) {
        this.resolveOutcome();
        continue;
      }

      this.executeAction(turnAction, events);
      this.resolveOutcome();
    }

    if (this.outcome === null) {
      this.applyEndOfTurn(events);
      this.resolveOutcome();
    }

    this.finalizeTurnState();
    return { events, outcome: this.outcome };
  }

  private wrapPartyMon(pokemon: PartyPokemon, isPlayer: boolean, partyIndex: number): BattlePokemon {
    const defaultName = getSpeciesName(pokemon.species);
    return {
      pokemon: { ...pokemon },
      name: pokemon.nickname?.trim() || defaultName,
      currentHp: pokemon.stats.hp,
      maxHp: pokemon.stats.maxHp,
      stages: createDefaultStages(),
      volatile: createDefaultVolatile(),
      ability: getAbility(pokemon.species, pokemon.abilityNum),
      partyIndex,
      isPlayer,
    };
  }

  private chooseEnemyAction(): FightAction {
    const usableMoves = this.enemy.pokemon.moves
      .map((moveId, moveSlot) => ({ moveId, moveSlot }))
      .filter((entry) => entry.moveId !== MOVES.NONE && this.enemy.pokemon.pp[entry.moveSlot] > 0);

    if (usableMoves.length === 0) {
      return {
        type: 'fight',
        moveId: MOVES.STRUGGLE,
        moveSlot: -1,
      };
    }

    const picked = usableMoves[randomInt(0, usableMoves.length - 1)];
    return {
      type: 'fight',
      moveId: picked.moveId,
      moveSlot: picked.moveSlot,
    };
  }

  private orderActions(playerAction: BattleAction, enemyAction: BattleAction): OrderedAction[] {
    const playerOrdered: OrderedAction = {
      actor: this.player,
      actorSide: this.playerSide,
      target: this.enemy,
      targetSide: this.enemySide,
      action: this.normalizeAction(this.player, playerAction),
    };
    const enemyOrdered: OrderedAction = {
      actor: this.enemy,
      actorSide: this.enemySide,
      target: this.player,
      targetSide: this.playerSide,
      action: this.normalizeAction(this.enemy, enemyAction),
    };

    const playerPriority = getActionPriority(playerOrdered.action);
    const enemyPriority = getActionPriority(enemyOrdered.action);

    if (playerPriority !== enemyPriority) {
      return playerPriority > enemyPriority
        ? [playerOrdered, enemyOrdered]
        : [enemyOrdered, playerOrdered];
    }

    const playerSpeed = this.getEffectiveSpeed(this.player);
    const enemySpeed = this.getEffectiveSpeed(this.enemy);
    if (playerSpeed !== enemySpeed) {
      return playerSpeed > enemySpeed
        ? [playerOrdered, enemyOrdered]
        : [enemyOrdered, playerOrdered];
    }

    return randomInt(0, 1) === 0
      ? [playerOrdered, enemyOrdered]
      : [enemyOrdered, playerOrdered];
  }

  private normalizeAction(actor: BattlePokemon, action: BattleAction): BattleAction {
    if (action.type !== 'fight') {
      return action;
    }

    if (action.moveSlot >= 0 && action.moveSlot < 4) {
      const moveId = actor.pokemon.moves[action.moveSlot];
      const pp = actor.pokemon.pp[action.moveSlot];
      if (moveId === action.moveId && moveId !== MOVES.NONE && pp > 0) {
        return action;
      }
    }

    const fallback = actor.pokemon.moves
      .map((moveId, moveSlot) => ({ moveId, moveSlot }))
      .find((entry) => entry.moveId !== MOVES.NONE && actor.pokemon.pp[entry.moveSlot] > 0);

    if (fallback) {
      return {
        type: 'fight',
        moveId: fallback.moveId,
        moveSlot: fallback.moveSlot,
      };
    }

    return {
      type: 'fight',
      moveId: MOVES.STRUGGLE,
      moveSlot: -1,
    };
  }

  /**
   * Run failed run-away turn resolution:
   * player action is consumed, then only the opponent acts.
   *
   * C ref:
   * - public/pokeemerald/src/battle_util.c (HandleAction_Run)
   */
  private executeEnemyActionOnly(events: BattleEvent[]): void {
    const enemyAction = this.chooseEnemyAction();
    const enemyStep: OrderedAction = {
      actor: this.enemy,
      actorSide: this.enemySide,
      target: this.player,
      targetSide: this.playerSide,
      action: this.normalizeAction(this.enemy, enemyAction),
    };

    const preCheck = checkPreMoveStatus(enemyStep.actor);
    events.push(...preCheck.events);
    if (!preCheck.canAct) return;

    this.executeAction(enemyStep, events);
    this.resolveOutcome();
  }

  private executeAction(step: OrderedAction, events: BattleEvent[]): void {
    switch (step.action.type) {
      case 'fight': {
        const result = executeMove({
          attacker: step.actor,
          defender: step.target,
          moveId: step.action.moveId,
          moveSlot: step.action.moveSlot,
          weather: this.weather,
          attackerSide: step.actorSide,
          defenderSide: step.targetSide,
        });
        events.push(...result.events);
        if (result.weather) {
          this.weather = result.weather;
        }
        step.actor.volatile.lastMoveUsed = step.action.moveId;
        return;
      }
      case 'switch':
      case 'item': {
        events.push({
          type: 'message',
          battler: step.actor.isPlayer ? 0 : 1,
          message: 'But it failed!',
        });
        return;
      }
      case 'run': {
        this.handleRunAttempt(events);
      }
    }
  }

  private handleRunAttempt(events: BattleEvent[]): void {
    if (this.config.type === 'trainer' || this.config.firstBattle) {
      events.push({
        type: 'message',
        battler: 0,
        message: "No! There's no running from this battle!",
      });
      return;
    }

    const playerCanAlwaysRun = this.player.ability === ABILITIES.RUN_AWAY
      || getItemBattleEffect(this.player.pokemon.heldItem)?.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_CAN_ALWAYS_RUN;

    if (playerCanAlwaysRun) {
      this.outcome = 'flee';
      events.push({
        type: 'message',
        battler: 0,
        message: 'Got away safely!',
      });
      return;
    }

    const playerSpeed = this.getEffectiveSpeed(this.player);
    const enemySpeed = this.getEffectiveSpeed(this.enemy);

    let escaped = false;
    if (playerSpeed >= enemySpeed) {
      escaped = true;
    } else {
      const chance = Math.floor((playerSpeed * 128) / Math.max(1, enemySpeed)) + (this.escapeAttempts * 30);
      const roll = randomInt(0, 255);
      escaped = chance > roll;
    }

    this.escapeAttempts++;

    if (escaped) {
      this.outcome = 'flee';
      events.push({
        type: 'message',
        battler: 0,
        message: 'Got away safely!',
      });
    } else {
      events.push({
        type: 'message',
        battler: 0,
        message: "Can't escape!",
      });
    }
  }

  private applyEndOfTurn(events: BattleEvent[]): void {
    events.push(...applyEndOfTurnStatus(this.player));
    events.push(...applyEndOfTurnStatus(this.enemy));

    this.applyLeechSeed(events);

    const weatherTick = tickWeather(this.weather, [this.player, this.enemy]);
    this.weather = weatherTick.weather;
    events.push(...weatherTick.events);

    this.tickSideTimers(this.playerSide, true, events);
    this.tickSideTimers(this.enemySide, false, events);
  }

  private applyLeechSeed(events: BattleEvent[]): void {
    if (this.player.currentHp > 0 && this.player.volatile.leechSeed && this.enemy.currentHp > 0) {
      const drained = Math.max(1, Math.floor(this.player.maxHp / 8));
      const actualDrain = Math.min(drained, this.player.currentHp);
      this.player.currentHp -= actualDrain;
      const heal = Math.min(actualDrain, this.enemy.maxHp - this.enemy.currentHp);
      this.enemy.currentHp += heal;
      events.push({
        type: 'drain',
        battler: 0,
        value: actualDrain,
        message: `${this.player.name}'s health is sapped by Leech Seed!`,
      });
    }

    if (this.enemy.currentHp > 0 && this.enemy.volatile.leechSeed && this.player.currentHp > 0) {
      const drained = Math.max(1, Math.floor(this.enemy.maxHp / 8));
      const actualDrain = Math.min(drained, this.enemy.currentHp);
      this.enemy.currentHp -= actualDrain;
      const heal = Math.min(actualDrain, this.player.maxHp - this.player.currentHp);
      this.player.currentHp += heal;
      events.push({
        type: 'drain',
        battler: 1,
        value: actualDrain,
        message: `${this.enemy.name}'s health is sapped by Leech Seed!`,
      });
    }
  }

  private tickSideTimers(side: SideState, isPlayerSide: boolean, events: BattleEvent[]): void {
    if (side.reflect > 0) {
      side.reflect--;
      if (side.reflect === 0) {
        events.push({
          type: 'message',
          battler: isPlayerSide ? 0 : 1,
          message: isPlayerSide ? "Your team's Reflect wore off!" : "Foe's Reflect wore off!",
        });
      }
    }

    if (side.lightScreen > 0) {
      side.lightScreen--;
      if (side.lightScreen === 0) {
        events.push({
          type: 'message',
          battler: isPlayerSide ? 0 : 1,
          message: isPlayerSide ? "Your team's Light Screen wore off!" : "Foe's Light Screen wore off!",
        });
      }
    }
  }

  private getEffectiveSpeed(mon: BattlePokemon): number {
    let speed = applyStatStage(mon.pokemon.stats.speed, mon.stages.speed);

    if (hasStatus(mon, STATUS.PARALYSIS)) {
      speed = Math.floor(speed / 4);
    }

    if ((this.weather.type === 'rain' && mon.ability === ABILITIES.SWIFT_SWIM)
      || (this.weather.type === 'sun' && mon.ability === ABILITIES.CHLOROPHYLL)) {
      speed *= 2;
    }

    return Math.max(1, speed);
  }

  private resolveOutcome(): void {
    if (this.outcome !== null) return;

    const playerDown = this.player.currentHp <= 0;
    const enemyDown = this.enemy.currentHp <= 0;

    if (enemyDown && !playerDown) {
      this.outcome = 'win';
      return;
    }

    if (playerDown) {
      this.outcome = 'lose';
    }
  }

  private finalizeTurnState(): void {
    for (const mon of [this.player, this.enemy]) {
      mon.volatile.flinch = false;
      if (!mon.volatile.protect) {
        mon.volatile.protectSuccessCount = 0;
      }
      mon.volatile.protect = false;
    }
  }
}

function getActionPriority(action: BattleAction): number {
  switch (action.type) {
    case 'switch':
      return 6;
    case 'item':
      return 6;
    case 'run':
      return 7;
    case 'fight':
      return getBattleMoveData(action.moveId)?.priority ?? 0;
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

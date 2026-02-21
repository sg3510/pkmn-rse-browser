/**
 * Battle engine turn orchestrator (logic only, no rendering).
 *
 * C ref:
 * - public/pokeemerald/src/battle_main.c (GetWhoStrikesFirst, turn order)
 * - public/pokeemerald/src/battle_util.c (TryRunFromBattle, end-of-turn effects)
 */

import { ABILITIES } from '../../data/abilities.ts';
import { getBattleMoveData } from '../../data/battleMoves.gen.ts';
import { HOLD_EFFECTS, getItemBattleEffect } from '../../data/itemBattleEffects.gen.ts';
import { MOVES } from '../../data/moves.ts';
import { formatPokemonDisplayName } from '../../pokemon/displayName.ts';
import type { PartyPokemon } from '../../pokemon/types.ts';
import { STATUS } from '../../pokemon/types.ts';
import { getAbility } from '../../pokemon/stats.ts';
import { battleRandomInt } from './BattleRng.ts';
import { executeMove } from './MoveEffects.ts';
import { applyEndOfTurnStatus, checkPreMoveStatus, hasStatus } from './StatusEffects.ts';
import type {
  BattleAction,
  BattleActionValidationResult,
  BattleConfig,
  BattleEvent,
  BattleOutcome,
  BattlePokemon,
  FightAction,
  MoveSelectionBlockReason,
  SideState,
  TurnResult,
  WeatherState,
} from './types.ts';
import { applyStatStage, createDefaultSide, createDefaultStages, createDefaultVolatile } from './types.ts';
import { createDefaultWeather, tickWeather } from './Weather.ts';

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

  validatePlayerAction(action: BattleAction): BattleActionValidationResult {
    return this.validateAction(this.player, action, false);
  }

  replacePlayerPokemon(pokemon: PartyPokemon, partyIndex: number): void {
    this.clearEscapePreventionFromSource(true);
    this.applyPartyMonToBattler(this.player, pokemon, true, partyIndex);
    this.outcome = null;
  }

  replaceEnemyPokemon(pokemon: PartyPokemon, partyIndex: number): void {
    this.clearEscapePreventionFromSource(false);
    this.applyPartyMonToBattler(this.enemy, pokemon, false, partyIndex);
    this.outcome = null;
  }

  executeTurn(playerAction: BattleAction): TurnResult {
    const events: BattleEvent[] = [];
    let consumedTurn = false;

    if (this.outcome !== null) {
      return { events, outcome: this.outcome, consumedTurn: false };
    }

    if (playerAction.type === 'run') {
      const consumesTurn = this.handleRunAttempt(events);
      consumedTurn = consumesTurn;
      if (consumesTurn && this.outcome === null && this.player.currentHp > 0 && this.enemy.currentHp > 0) {
        this.executeEnemyActionOnly(events);
      }
      if (consumesTurn && this.outcome === null) {
        this.applyEndOfTurn(events);
        this.resolveOutcome();
      }
      this.finalizeTurnState();
      return { events, outcome: this.outcome, consumedTurn };
    }

    const validatedPlayerAction = this.validateAction(this.player, playerAction, false);
    if (!validatedPlayerAction.ok) {
      const message = validatedPlayerAction.blockedReason
        ? getMoveSelectionBlockMessage(validatedPlayerAction.blockedReason)
        : 'But it failed!';
      events.push({
        type: 'message',
        battler: 0,
        message,
      });
      this.finalizeTurnState();
      return { events, outcome: this.outcome, consumedTurn: false };
    }
    playerAction = validatedPlayerAction.normalizedAction;
    consumedTurn = true;

    const enemyAction = this.chooseEnemyAction();
    const ordered = this.orderActions(playerAction, enemyAction);

    for (const turnAction of ordered) {
      if (this.outcome !== null) break;
      if (turnAction.actor.currentHp <= 0 || turnAction.target.currentHp <= 0) continue;

      if (turnAction.action.type === 'fight') {
        const preCheck = checkPreMoveStatus(turnAction.actor);
        events.push(...preCheck.events);
        if (!preCheck.canAct) {
          this.resolveOutcome();
          continue;
        }
      }

      this.executeAction(turnAction, events);
      this.resolveOutcome();
    }

    if (this.outcome === null) {
      this.applyEndOfTurn(events);
      this.resolveOutcome();
    }

    this.finalizeTurnState();
    return { events, outcome: this.outcome, consumedTurn };
  }

  private wrapPartyMon(pokemon: PartyPokemon, isPlayer: boolean, partyIndex: number): BattlePokemon {
    return {
      pokemon: { ...pokemon },
      name: formatPokemonDisplayName(pokemon),
      currentHp: pokemon.stats.hp,
      maxHp: pokemon.stats.maxHp,
      stages: createDefaultStages(),
      volatile: createDefaultVolatile(),
      ability: getAbility(pokemon.species, pokemon.abilityNum),
      partyIndex,
      isPlayer,
    };
  }

  private applyPartyMonToBattler(
    target: BattlePokemon,
    pokemon: PartyPokemon,
    isPlayer: boolean,
    partyIndex: number,
  ): void {
    target.pokemon = { ...pokemon };
    target.name = formatPokemonDisplayName(pokemon);
    target.currentHp = pokemon.stats.hp;
    target.maxHp = pokemon.stats.maxHp;
    target.stages = createDefaultStages();
    target.volatile = createDefaultVolatile();
    target.ability = getAbility(pokemon.species, pokemon.abilityNum);
    target.partyIndex = partyIndex;
    target.isPlayer = isPlayer;
  }

  private chooseEnemyAction(): FightAction {
    const usableMoves = this.enemy.pokemon.moves
      .map((moveId, moveSlot) => ({ moveId, moveSlot }))
      .filter((entry) => this.isMoveSelectable(this.enemy, entry.moveId, entry.moveSlot) === null);

    if (usableMoves.length === 0) {
      return {
        type: 'fight',
        moveId: MOVES.STRUGGLE,
        moveSlot: -1,
      };
    }

    const picked = usableMoves[battleRandomInt(0, usableMoves.length - 1)];
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
      action: this.validateAction(this.player, playerAction, true).normalizedAction,
    };
    const enemyOrdered: OrderedAction = {
      actor: this.enemy,
      actorSide: this.enemySide,
      target: this.player,
      targetSide: this.playerSide,
      action: this.validateAction(this.enemy, enemyAction, true).normalizedAction,
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

    return battleRandomInt(0, 1) === 0
      ? [playerOrdered, enemyOrdered]
      : [enemyOrdered, playerOrdered];
  }

  private validateAction(
    actor: BattlePokemon,
    action: BattleAction,
    allowFallback: boolean,
  ): BattleActionValidationResult {
    if (action.type === 'switch') {
      if (this.isBattlerTrapped(actor)) {
        return {
          ok: false,
          normalizedAction: action,
        };
      }
      return {
        ok: true,
        normalizedAction: action,
      };
    }

    if (action.type === 'run') {
      if (actor.isPlayer && this.isBattlerTrapped(actor)) {
        return {
          ok: false,
          normalizedAction: action,
        };
      }
      return {
        ok: true,
        normalizedAction: action,
      };
    }

    if (action.type !== 'fight') {
      return {
        ok: true,
        normalizedAction: action,
      };
    }

    const forcedAction = this.resolveForcedFightAction(actor);
    if (forcedAction) {
      return {
        ok: true,
        normalizedAction: forcedAction,
      };
    }

    if (action.moveSlot >= 0 && action.moveSlot < 4) {
      const moveId = actor.pokemon.moves[action.moveSlot];
      if (moveId === action.moveId) {
        const blockedReason = this.isMoveSelectable(actor, moveId, action.moveSlot);
        if (blockedReason === null) {
          return {
            ok: true,
            normalizedAction: action,
          };
        }
        const fallback = this.findFirstUsableMove(actor);
        if (fallback) {
          if (allowFallback) {
            return {
              ok: true,
              normalizedAction: {
                type: 'fight',
                moveId: fallback.moveId,
                moveSlot: fallback.moveSlot,
              },
            };
          }
          return {
            ok: false,
            normalizedAction: action,
            blockedReason,
            blockedMoveSlot: action.moveSlot,
          };
        }
      }
    }

    const fallback = this.findFirstUsableMove(actor);

    if (fallback) {
      if (allowFallback) {
        return {
          ok: true,
          normalizedAction: {
            type: 'fight',
            moveId: fallback.moveId,
            moveSlot: fallback.moveSlot,
          },
        };
      }
      return {
        ok: false,
        normalizedAction: action,
        blockedReason: 'disabled',
        blockedMoveSlot: action.moveSlot,
      };
    }

    return {
      ok: true,
      normalizedAction: {
        type: 'fight',
        moveId: MOVES.STRUGGLE,
        moveSlot: -1,
      },
      allMovesUnusable: true,
    };
  }

  private resolveForcedFightAction(actor: BattlePokemon): FightAction | null {
    if (actor.volatile.recharging) {
      return null;
    }

    if (actor.volatile.chargeMove !== MOVES.NONE) {
      const forced = this.findUsableMoveById(actor, actor.volatile.chargeMove, true);
      if (forced) {
        return {
          type: 'fight',
          moveId: forced.moveId,
          moveSlot: forced.moveSlot,
        };
      }
      actor.volatile.chargeMove = MOVES.NONE;
      actor.volatile.semiInvulnerableMove = MOVES.NONE;
    }

    if (actor.volatile.rampageTurns > 0 && actor.volatile.rampageMove !== MOVES.NONE) {
      const forced = this.findUsableMoveById(actor, actor.volatile.rampageMove, true);
      if (forced) {
        return {
          type: 'fight',
          moveId: forced.moveId,
          moveSlot: forced.moveSlot,
        };
      }
      actor.volatile.rampageTurns = 0;
      actor.volatile.rampageMove = MOVES.NONE;
    }

    if (actor.volatile.rollout > 0 && actor.volatile.lastMoveUsed !== MOVES.NONE) {
      const forced = this.findUsableMoveById(actor, actor.volatile.lastMoveUsed, true);
      if (forced) {
        return {
          type: 'fight',
          moveId: forced.moveId,
          moveSlot: forced.moveSlot,
        };
      }
      actor.volatile.rollout = 0;
    }

    return null;
  }

  private findUsableMoveById(
    actor: BattlePokemon,
    moveId: number,
    ignoreSelectionRestrictions = false,
  ): { moveId: number; moveSlot: number } | null {
    for (let moveSlot = 0; moveSlot < actor.pokemon.moves.length; moveSlot++) {
      const candidateMoveId = actor.pokemon.moves[moveSlot];
      if (candidateMoveId !== moveId) continue;
      if (!ignoreSelectionRestrictions && this.isMoveSelectable(actor, candidateMoveId, moveSlot) !== null) continue;
      return {
        moveId: candidateMoveId,
        moveSlot,
      };
    }
    return null;
  }

  private findFirstUsableMove(actor: BattlePokemon): { moveId: number; moveSlot: number } | null {
    for (let moveSlot = 0; moveSlot < actor.pokemon.moves.length; moveSlot++) {
      const moveId = actor.pokemon.moves[moveSlot];
      if (this.isMoveSelectable(actor, moveId, moveSlot) !== null) continue;
      return {
        moveId,
        moveSlot,
      };
    }
    return null;
  }

  private isMoveSelectable(
    actor: BattlePokemon,
    moveId: number,
    moveSlot: number,
  ): MoveSelectionBlockReason | null {
    if (moveId === MOVES.NONE || moveSlot < 0 || moveSlot >= 4) {
      return 'disabled';
    }
    if (actor.pokemon.pp[moveSlot] <= 0) {
      return 'no_pp';
    }
    if (actor.volatile.disabledMove === moveId && actor.volatile.disabled > 0) {
      return 'disabled';
    }

    const moveData = getBattleMoveData(moveId);
    if (actor.volatile.taunt > 0 && (moveData?.power ?? 0) === 0) {
      return 'taunt';
    }
    if (actor.volatile.torment && actor.volatile.lastMoveUsed === moveId && moveId !== MOVES.STRUGGLE) {
      return 'torment';
    }

    const holdEffect = getItemBattleEffect(actor.pokemon.heldItem)?.holdEffect;
    const isChoiceBandLocked = holdEffect === HOLD_EFFECTS.HOLD_EFFECT_CHOICE_BAND
      && actor.volatile.lastMoveUsed !== MOVES.NONE
      && actor.volatile.lastMoveUsed !== MOVES.STRUGGLE
      && actor.volatile.lastMoveUsed !== moveId;
    if (isChoiceBandLocked) {
      return 'choice_lock';
    }

    return null;
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
      action: this.validateAction(this.enemy, enemyAction, true).normalizedAction,
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
          battleType: this.config.type,
          weather: this.weather,
          attackerSide: step.actorSide,
          defenderSide: step.targetSide,
        });
        events.push(...result.events);
        const forcedOutcome = result.events.find((event) => event.type === 'battle_end')?.detail;
        if (forcedOutcome === 'win' || forcedOutcome === 'lose' || forcedOutcome === 'draw' || forcedOutcome === 'flee') {
          this.outcome = forcedOutcome;
        }
        if (result.weather) {
          this.weather = result.weather;
        }
        step.actor.volatile.lastMoveUsed = step.action.moveId;
        return;
      }
      case 'switch':
      case 'item': {
        // Switch/item action effects are applied by the caller.
        // Engine still consumes turn order so the opponent can act.
        return;
      }
      case 'run': {
        this.handleRunAttempt(events);
      }
    }
  }

  private handleRunAttempt(events: BattleEvent[]): boolean {
    if (this.config.type === 'trainer' || this.config.firstBattle) {
      events.push({
        type: 'message',
        battler: 0,
        message: "No! There's no running from this battle!",
      });
      return false;
    }

    if (this.isBattlerTrapped(this.player)) {
      events.push({
        type: 'message',
        battler: 0,
        message: "Can't escape!",
      });
      return true;
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
      return true;
    }

    const playerSpeed = this.getEffectiveSpeed(this.player);
    const enemySpeed = this.getEffectiveSpeed(this.enemy);

    let escaped = false;
    if (playerSpeed >= enemySpeed) {
      escaped = true;
    } else {
      const chance = Math.floor((playerSpeed * 128) / Math.max(1, enemySpeed)) + (this.escapeAttempts * 30);
      const roll = battleRandomInt(0, 255);
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
    return true;
  }

  private applyEndOfTurn(events: BattleEvent[]): void {
    events.push(...applyEndOfTurnStatus(this.player));
    events.push(...applyEndOfTurnStatus(this.enemy));

    this.applyLeechSeed(events);
    this.applyFutureSight(events);

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

  private applyFutureSight(events: BattleEvent[]): void {
    for (const target of [this.player, this.enemy]) {
      if (target.currentHp <= 0) continue;
      if (target.volatile.futureSightTurns <= 0) continue;

      target.volatile.futureSightTurns--;
      if (target.volatile.futureSightTurns > 0) continue;

      const moveId = target.volatile.futureSightMoveId || MOVES.FUTURE_SIGHT;
      const attackName = moveId === MOVES.DOOM_DESIRE ? 'Doom Desire' : 'Future Sight';
      events.push({
        type: 'message',
        battler: target.isPlayer ? 0 : 1,
        message: `${target.name} took the ${attackName} attack!`,
      });

      const damage = Math.min(target.currentHp, Math.max(1, target.volatile.futureSightDamage));
      target.currentHp = Math.max(0, target.currentHp - damage);
      events.push({
        type: 'damage',
        battler: target.isPlayer ? 0 : 1,
        value: damage,
        moveId,
      });

      if (target.currentHp <= 0) {
        events.push({
          type: 'faint',
          battler: target.isPlayer ? 0 : 1,
          message: `${target.name} fainted!`,
        });
      }

      target.volatile.futureSightMoveId = MOVES.NONE;
      target.volatile.futureSightDamage = 0;
      target.volatile.futureSightAttackerIsPlayer = null;
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

    if (side.safeguard > 0) {
      side.safeguard--;
      if (side.safeguard === 0) {
        events.push({
          type: 'message',
          battler: isPlayerSide ? 0 : 1,
          message: isPlayerSide ? "Your team's Safeguard faded!" : "Foe's Safeguard faded!",
        });
      }
    }

    if (side.mist > 0) {
      side.mist--;
      if (side.mist === 0) {
        events.push({
          type: 'message',
          battler: isPlayerSide ? 0 : 1,
          message: isPlayerSide ? "Your team's Mist faded!" : "Foe's Mist faded!",
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

    if (playerDown && enemyDown) {
      this.outcome = 'draw';
      return;
    }

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
      if (!mon.volatile.protect && !mon.volatile.endure) {
        mon.volatile.protectSuccessCount = 0;
      }
      if (mon.volatile.lockOnTurns > 0) {
        mon.volatile.lockOnTurns--;
        if (mon.volatile.lockOnTurns <= 0) {
          mon.volatile.lockOnTurns = 0;
          mon.volatile.lockOnTargetIsPlayer = null;
        }
      }
      mon.volatile.protect = false;
      mon.volatile.endure = false;
    }
  }

  private isBattlerTrapped(actor: BattlePokemon): boolean {
    if (actor.volatile.trapped > 0) {
      return true;
    }

    const sourceIsPlayer = actor.volatile.meanLookSourceIsPlayer;
    if (sourceIsPlayer === null || sourceIsPlayer === actor.isPlayer) {
      return false;
    }

    const source = sourceIsPlayer ? this.player : this.enemy;
    return source.currentHp > 0;
  }

  private clearEscapePreventionFromSource(sourceIsPlayer: boolean): void {
    const target = sourceIsPlayer ? this.enemy : this.player;
    if (target.volatile.meanLookSourceIsPlayer === sourceIsPlayer) {
      target.volatile.meanLookSourceIsPlayer = null;
    }
  }
}

export function getMoveSelectionBlockMessage(reason: MoveSelectionBlockReason): string {
  switch (reason) {
    case 'no_pp':
      return "There's no PP left for this move!";
    case 'disabled':
      return 'This move is disabled!';
    case 'taunt':
      return "Taunt prevents status moves!";
    case 'torment':
      return 'Torment prevents using the same move twice!';
    case 'choice_lock':
      return 'The held item prevents selecting that move!';
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

/**
 * Status condition logic (primary and volatile).
 *
 * C ref: public/pokeemerald/include/constants/battle.h (STATUS1_*, STATUS2_*)
 * C ref: public/pokeemerald/src/battle_util.c (status application/check)
 *
 * Primary (one at a time, stored in pokemon.status):
 *   Sleep (1-7 turns), Poison (1/8/turn), Bad Poison (1/16 increasing),
 *   Burn (halves atk + 1/8/turn), Freeze (20% thaw/turn), Paralysis (75% speed, 25% skip)
 *
 * Volatile (reset on switch, stored in BattlePokemon.volatile):
 *   Confusion (1-4 turns, 50% self-hit), Flinch, etc. — see types.ts
 */

import { STATUS } from '../../pokemon/types.ts';
import { battleRandomInt } from './BattleRng.ts';
import { getBattlePokemonTypes } from './speciesTypes.ts';
import type { BattlePokemon, BattleEvent } from './types.ts';

// ── Primary status helpers ──

export function hasStatus(mon: BattlePokemon, status: number): boolean {
  if (status === STATUS.SLEEP) {
    return (mon.pokemon.status & STATUS.SLEEP) !== 0;
  }
  return (mon.pokemon.status & status) !== 0;
}

export function hasPrimaryStatus(mon: BattlePokemon): boolean {
  return mon.pokemon.status !== STATUS.NONE;
}

export function getSleepTurns(mon: BattlePokemon): number {
  return mon.pokemon.status & STATUS.SLEEP; // bottom 3 bits
}

/** Try to apply a primary status. Returns false if blocked. */
export function tryApplyStatus(
  target: BattlePokemon,
  status: number,
  events: BattleEvent[],
): boolean {
  // Can't stack primary statuses
  if (hasPrimaryStatus(target)) {
    return false;
  }

  // Type immunities
  const types = getBattlePokemonTypes(target);
  if (status === STATUS.POISON || status === STATUS.TOXIC) {
    if (types.includes('POISON') || types.includes('STEEL')) {
      return false;
    }
  }
  if (status === STATUS.BURN) {
    if (types.includes('FIRE')) {
      return false;
    }
  }
  if (status === STATUS.PARALYSIS) {
    // In Gen 3, Electric types can be paralyzed
  }
  if (status === STATUS.FREEZE) {
    if (types.includes('ICE')) {
      return false;
    }
  }

  if (status === STATUS.SLEEP) {
    // Move-induced sleep in Emerald lasts 2-5 turns.
    const turns = battleRandomInt(2, 5);
    target.pokemon.status = turns; // sleep stored in bottom 3 bits
  } else if (status === STATUS.TOXIC) {
    target.pokemon.status = status;
    target.volatile.toxicCounter = 0;
  } else {
    target.pokemon.status = status;
    target.volatile.toxicCounter = 0;
  }

  const battler = target.isPlayer ? 0 : 1;
  events.push({
    type: 'status_applied',
    battler,
    detail: getStatusName(status),
    message: getStatusApplyMessage(target.name, status),
  });

  return true;
}

/** Cure a status condition. */
export function cureStatus(target: BattlePokemon, events: BattleEvent[]): void {
  if (!hasPrimaryStatus(target)) return;

  const oldStatus = target.pokemon.status;
  target.pokemon.status = STATUS.NONE;
  target.volatile.toxicCounter = 0;

  events.push({
    type: 'status_cured',
    battler: target.isPlayer ? 0 : 1,
    detail: getStatusName(oldStatus),
    message: `${target.name} was cured of its ${getStatusName(oldStatus)}!`,
  });
}

// ── Pre-move status checks ──

/**
 * Check if a battler can act this turn due to status.
 * Returns events and whether they can act.
 */
export function checkPreMoveStatus(mon: BattlePokemon): {
  canAct: boolean;
  events: BattleEvent[];
} {
  const events: BattleEvent[] = [];
  const battler = mon.isPlayer ? 0 : 1;

  if (mon.volatile.recharging) {
    mon.volatile.recharging = false;
    events.push({
      type: 'message',
      battler,
      message: `${mon.name} must recharge!`,
    });
    return { canAct: false, events };
  }

  // Sleep check
  if (hasStatus(mon, STATUS.SLEEP)) {
    const turnsLeft = getSleepTurns(mon);
    if (turnsLeft > 0) {
      // Decrement sleep counter
      mon.pokemon.status = (mon.pokemon.status & ~STATUS.SLEEP) | (turnsLeft - 1);
      if (turnsLeft - 1 > 0) {
        events.push({
          type: 'fast_asleep',
          battler,
          message: `${mon.name} is fast asleep.`,
        });
        return { canAct: false, events };
      }
      // Woke up this turn
      mon.pokemon.status = STATUS.NONE;
      events.push({
        type: 'wake_up',
        battler,
        message: `${mon.name} woke up!`,
      });
    }
  }

  // Freeze check (20% chance to thaw each turn)
  if (hasStatus(mon, STATUS.FREEZE)) {
    if (battleRandomInt(1, 5) === 1) {
      mon.pokemon.status = STATUS.NONE;
      events.push({
        type: 'thaw',
        battler,
        message: `${mon.name} thawed out!`,
      });
    } else {
      events.push({
        type: 'frozen_solid',
        battler,
        message: `${mon.name} is frozen solid!`,
      });
      return { canAct: false, events };
    }
  }

  // Paralysis check (25% chance can't move)
  if (hasStatus(mon, STATUS.PARALYSIS)) {
    if (battleRandomInt(1, 4) === 1) {
      events.push({
        type: 'fully_paralyzed',
        battler,
        message: `${mon.name} is fully paralyzed!`,
      });
      return { canAct: false, events };
    }
  }

  // Flinch check
  if (mon.volatile.flinch) {
    mon.volatile.flinch = false;
    events.push({
      type: 'flinch',
      battler,
      message: `${mon.name} flinched!`,
    });
    return { canAct: false, events };
  }

  // Confusion check
  if (mon.volatile.confusion > 0) {
    mon.volatile.confusion--;
    if (mon.volatile.confusion === 0) {
      events.push({
        type: 'message',
        battler,
        message: `${mon.name} snapped out of confusion!`,
      });
    } else {
      events.push({
        type: 'message',
        battler,
        message: `${mon.name} is confused!`,
      });
      // 50% chance to hit self
      if (battleRandomInt(1, 2) === 1) {
        const selfDamage = calculateConfusionDamage(mon);
        mon.currentHp = Math.max(0, mon.currentHp - selfDamage);
        events.push({
          type: 'confusion_self_hit',
          battler,
          value: selfDamage,
          message: `It hurt itself in its confusion!`,
        });
        return { canAct: false, events };
      }
    }
  }

  // Attract check
  if (mon.volatile.attractedTo !== null) {
    events.push({
      type: 'message',
      battler,
      message: `${mon.name} is in love!`,
    });
    if (battleRandomInt(1, 2) === 1) {
      events.push({
        type: 'message',
        battler,
        message: `${mon.name} is immobilized by love!`,
      });
      return { canAct: false, events };
    }
  }

  return { canAct: true, events };
}

// ── End-of-turn status damage ──

export function applyEndOfTurnStatus(mon: BattlePokemon): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (mon.currentHp <= 0) return events;

  const battler = mon.isPlayer ? 0 : 1;
  if (!hasStatus(mon, STATUS.TOXIC)) {
    mon.volatile.toxicCounter = 0;
  }

  // Poison: 1/8 max HP per turn
  if (hasStatus(mon, STATUS.POISON)) {
    const damage = Math.max(1, Math.floor(mon.maxHp / 8));
    mon.currentHp = Math.max(0, mon.currentHp - damage);
    events.push({
      type: 'hurt_by_status',
      battler,
      value: damage,
      message: `${mon.name} is hurt by poison!`,
    });
  }

  // Toxic (bad poison): damage increases each turn (1/16, 2/16, 3/16, ...)
  // We track the toxic counter in the upper bits — for simplicity, use a volatile counter
  if (hasStatus(mon, STATUS.TOXIC)) {
    mon.volatile.toxicCounter = Math.min(15, mon.volatile.toxicCounter + 1);
    const baseDamage = Math.max(1, Math.floor(mon.maxHp / 16));
    const damage = baseDamage * Math.max(1, mon.volatile.toxicCounter);
    mon.currentHp = Math.max(0, mon.currentHp - damage);
    events.push({
      type: 'hurt_by_status',
      battler,
      value: damage,
      message: `${mon.name} is hurt by poison!`,
    });
  }

  // Burn: 1/8 max HP per turn
  if (hasStatus(mon, STATUS.BURN)) {
    const damage = Math.max(1, Math.floor(mon.maxHp / 8));
    mon.currentHp = Math.max(0, mon.currentHp - damage);
    events.push({
      type: 'hurt_by_status',
      battler,
      value: damage,
      message: `${mon.name} is hurt by its burn!`,
    });
  }

  // Nightmare: 1/4 max HP if asleep
  if (mon.volatile.nightmare && hasStatus(mon, STATUS.SLEEP)) {
    const damage = Math.max(1, Math.floor(mon.maxHp / 4));
    mon.currentHp = Math.max(0, mon.currentHp - damage);
    events.push({
      type: 'hurt_by_status',
      battler,
      value: damage,
      message: `${mon.name} is locked in a nightmare!`,
    });
  }

  // Curse (non-Ghost): 1/4 max HP per turn
  if (mon.volatile.curse) {
    const damage = Math.max(1, Math.floor(mon.maxHp / 4));
    mon.currentHp = Math.max(0, mon.currentHp - damage);
    events.push({
      type: 'hurt_by_status',
      battler,
      value: damage,
      message: `${mon.name} is afflicted by the curse!`,
    });
  }

  // Leech Seed: handled in BattleEngine (needs other mon reference)

  // Trap damage (Wrap, Bind, etc.): 1/16 per turn
  if (mon.volatile.trapped > 0) {
    const damage = Math.max(1, Math.floor(mon.maxHp / 16));
    mon.currentHp = Math.max(0, mon.currentHp - damage);
    mon.volatile.trapped--;
    events.push({
      type: 'hurt_by_status',
      battler,
      value: damage,
      message: `${mon.name} is hurt by the trap!`,
    });
  }

  // Faint check
  if (mon.currentHp <= 0) {
    events.push({
      type: 'faint',
      battler,
      message: `${mon.name} fainted!`,
    });
  }

  return events;
}

// ── Helpers ──

/**
 * Confusion self-hit damage: 40 base power typeless physical attack against self.
 * C ref: battle_script_commands.c (confusion damage)
 */
function calculateConfusionDamage(mon: BattlePokemon): number {
  const level = mon.pokemon.level;
  const attack = mon.pokemon.stats.attack;
  const defense = mon.pokemon.stats.defense;
  const base = Math.floor(
    Math.floor(
      Math.floor(((2 * level / 5 + 2) * 40 * attack) / defense) / 50
    ) + 2
  );
  return Math.max(1, base);
}

function getStatusName(status: number): string {
  if ((status & STATUS.SLEEP) && status <= 7) return 'sleep';
  if (status & STATUS.POISON) return 'poison';
  if (status & STATUS.BURN) return 'burn';
  if (status & STATUS.FREEZE) return 'freeze';
  if (status & STATUS.PARALYSIS) return 'paralysis';
  if (status & STATUS.TOXIC) return 'bad poison';
  return 'status';
}

function getStatusApplyMessage(name: string, status: number): string {
  if (status === STATUS.SLEEP || (status >= 1 && status <= 7)) return `${name} fell asleep!`;
  if (status === STATUS.POISON) return `${name} was poisoned!`;
  if (status === STATUS.BURN) return `${name} was burned!`;
  if (status === STATUS.FREEZE) return `${name} was frozen solid!`;
  if (status === STATUS.PARALYSIS) return `${name} is paralyzed! It may be unable to move!`;
  if (status === STATUS.TOXIC) return `${name} was badly poisoned!`;
  return `${name} was afflicted!`;
}

/** Apply confusion to a battler. */
export function applyConfusion(target: BattlePokemon, events: BattleEvent[]): boolean {
  if (target.volatile.confusion > 0) return false; // already confused

  target.volatile.confusion = battleRandomInt(2, 5); // GBA: 2-5 turns
  events.push({
    type: 'status_applied',
    battler: target.isPlayer ? 0 : 1,
    detail: 'confusion',
    message: `${target.name} became confused!`,
  });
  return true;
}

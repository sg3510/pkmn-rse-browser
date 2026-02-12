/**
 * Shared RNG adapter for battle systems.
 *
 * C ref:
 * - public/pokeemerald/src/battle_util.c (Random usage in battle flow)
 * - public/pokeemerald/src/battle_script_commands.c
 */

export interface BattleRngAdapter {
  next: () => number;
}

const defaultAdapter: BattleRngAdapter = {
  next: () => Math.random(),
};

let activeAdapter: BattleRngAdapter = defaultAdapter;

export function setBattleRngAdapter(adapter: BattleRngAdapter): void {
  activeAdapter = adapter;
}

export function resetBattleRngAdapter(): void {
  activeAdapter = defaultAdapter;
}

export function battleRandomInt(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(activeAdapter.next() * (max - min + 1)) + min;
}

export function battleRandomChance(chance: number): boolean {
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return activeAdapter.next() < chance;
}


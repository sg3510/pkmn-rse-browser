# React Implementation Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BATTLE SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  BattleManager  │  │    AI Engine    │  │     Type Calculator         │ │
│  │   (Orchestrate) │  │  (Move Select)  │  │   (Effectiveness)           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ DamageCalculator│  │  Switch Logic   │  │      Item Logic             │ │
│  │  (HP Changes)   │  │  (Party Eval)   │  │   (Trainer Items)           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── battle/
│   ├── ai/
│   │   ├── index.ts              # Main AI exports
│   │   ├── AIEngine.ts           # Core AI engine
│   │   ├── AIScripts.ts          # AI script implementations
│   │   ├── MoveScorer.ts         # Move scoring logic
│   │   ├── SwitchEvaluator.ts    # Switch decision logic
│   │   ├── ItemEvaluator.ts      # Item usage logic
│   │   └── types.ts              # AI type definitions
│   ├── mechanics/
│   │   ├── TypeChart.ts          # Type effectiveness
│   │   ├── DamageCalculator.ts   # Damage formulas
│   │   ├── StatCalculator.ts     # Stat stage calculations
│   │   └── StatusEffects.ts      # Status condition handling
│   ├── state/
│   │   ├── BattleState.ts        # Battle state management
│   │   ├── BattlerState.ts       # Individual battler state
│   │   └── BattleHistory.ts      # Move/ability tracking
│   ├── data/
│   │   ├── moves.json            # Move database
│   │   ├── abilities.json        # Ability effects
│   │   └── items.json            # Item effects
│   └── BattleManager.ts          # Main battle orchestrator
```

## Core Type Definitions

### types.ts

```typescript
// AI Configuration
export interface AIConfig {
  aiFlags: number;
  isTrainer: boolean;
  trainerItems: number[];
}

// AI Script Flags
export const AI_FLAGS = {
  CHECK_BAD_MOVE: 1 << 0,
  TRY_TO_FAINT: 1 << 1,
  CHECK_VIABILITY: 1 << 2,
  SETUP_FIRST_TURN: 1 << 3,
  RISKY: 1 << 4,
  PREFER_POWER_EXTREMES: 1 << 5,
  PREFER_BATON_PASS: 1 << 6,
  DOUBLE_BATTLE: 1 << 7,
  HP_AWARE: 1 << 8,
  TRY_SUNNY_DAY_START: 1 << 9,
  ROAMING: 1 << 29,
  SAFARI: 1 << 30,
  FIRST_BATTLE: 1 << 31,
} as const;

// Type Effectiveness
export const TYPE_EFFECTIVENESS = {
  IMMUNE: 0,
  QUARTER: 10,
  HALF: 20,
  NORMAL: 40,
  DOUBLE: 80,
  QUADRUPLE: 160,
} as const;

// AI Actions
export type AIAction =
  | { type: 'move'; moveIndex: number; target: number }
  | { type: 'switch'; partyIndex: number }
  | { type: 'item'; itemId: number }
  | { type: 'flee' }
  | { type: 'watch' };

// Battle State
export interface BattlerState {
  species: number;
  level: number;
  hp: number;
  maxHp: number;
  types: [number, number?];
  ability: number;
  moves: number[];
  pp: number[];
  stats: Stats;
  statStages: StatStages;
  status1: number;
  status2: number;
  status3: number;
  isFirstTurn: boolean;
}

export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface StatStages {
  attack: number;   // -6 to +6
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
  accuracy: number;
  evasion: number;
}
```

## AIEngine.ts - Core Implementation

```typescript
import { AIConfig, AIAction, AI_FLAGS } from './types';
import { MoveScorer } from './MoveScorer';
import { SwitchEvaluator } from './SwitchEvaluator';
import { ItemEvaluator } from './ItemEvaluator';

export class AIEngine {
  private moveScorer: MoveScorer;
  private switchEvaluator: SwitchEvaluator;
  private itemEvaluator: ItemEvaluator;

  constructor() {
    this.moveScorer = new MoveScorer();
    this.switchEvaluator = new SwitchEvaluator();
    this.itemEvaluator = new ItemEvaluator();
  }

  /**
   * Main entry point for AI decision making
   */
  chooseAction(
    battle: BattleState,
    aiPokemon: BattlerState,
    party: Pokemon[],
    config: AIConfig
  ): AIAction {
    // Wild Pokemon - pure random
    if (!config.isTrainer) {
      return this.selectRandomMove(aiPokemon);
    }

    // Check for switch first
    const switchDecision = this.switchEvaluator.evaluate(
      battle, aiPokemon, party
    );
    if (switchDecision.shouldSwitch) {
      return { type: 'switch', partyIndex: switchDecision.targetIndex! };
    }

    // Check for item usage
    if (config.trainerItems.length > 0) {
      const itemDecision = this.itemEvaluator.evaluate(
        aiPokemon, config.trainerItems, battle.turnCount === 0
      );
      if (itemDecision.shouldUse) {
        return { type: 'item', itemId: itemDecision.itemId! };
      }
    }

    // Select best move using AI scripts
    return this.selectBestMove(battle, aiPokemon, config);
  }

  /**
   * Wild Pokemon random move selection
   */
  private selectRandomMove(pokemon: BattlerState): AIAction {
    const validMoves = pokemon.moves
      .map((move, i) => ({ move, index: i }))
      .filter(m => m.move !== 0 && pokemon.pp[m.index] > 0);

    if (validMoves.length === 0) {
      // Struggle
      return { type: 'move', moveIndex: 0, target: 0 };
    }

    const selected = validMoves[Math.floor(Math.random() * validMoves.length)];
    return { type: 'move', moveIndex: selected.index, target: 0 };
  }

  /**
   * Trainer AI move selection with scoring
   */
  private selectBestMove(
    battle: BattleState,
    aiPokemon: BattlerState,
    config: AIConfig
  ): AIAction {
    // Initialize scores at 100
    const scores = new Array(4).fill(100);

    // Apply move limitations (PP, disabled, etc.)
    for (let i = 0; i < 4; i++) {
      if (aiPokemon.moves[i] === 0 || aiPokemon.pp[i] === 0) {
        scores[i] = 0;
      }
    }

    // Add random variance (100 - random(0-15))
    const simulatedRNG = scores.map(() => 100 - Math.floor(Math.random() * 16));

    // Run each enabled AI script
    const target = battle.getOpponent(aiPokemon);

    if (config.aiFlags & AI_FLAGS.CHECK_BAD_MOVE) {
      this.moveScorer.checkBadMove(scores, aiPokemon, target, battle);
    }
    if (config.aiFlags & AI_FLAGS.TRY_TO_FAINT) {
      this.moveScorer.tryToFaint(scores, aiPokemon, target, battle);
    }
    if (config.aiFlags & AI_FLAGS.CHECK_VIABILITY) {
      this.moveScorer.checkViability(scores, aiPokemon, target, battle);
    }
    if (config.aiFlags & AI_FLAGS.SETUP_FIRST_TURN) {
      this.moveScorer.setupFirstTurn(scores, aiPokemon, battle);
    }
    if (config.aiFlags & AI_FLAGS.HP_AWARE) {
      this.moveScorer.hpAware(scores, aiPokemon, target);
    }
    // ... continue for other flags

    // Find best scoring moves
    return this.selectHighestScoredMove(scores, aiPokemon);
  }

  private selectHighestScoredMove(
    scores: number[],
    pokemon: BattlerState
  ): AIAction {
    let bestScore = -1;
    const bestMoves: number[] = [];

    for (let i = 0; i < 4; i++) {
      if (pokemon.moves[i] === 0) continue;

      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestMoves.length = 0;
        bestMoves.push(i);
      } else if (scores[i] === bestScore) {
        bestMoves.push(i);
      }
    }

    // Random selection among ties
    const selected = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    return { type: 'move', moveIndex: selected, target: 0 };
  }
}
```

## MoveScorer.ts - Scoring Implementation

```typescript
import { BattlerState, TYPE_EFFECTIVENESS } from './types';
import { TypeChart } from '../mechanics/TypeChart';
import { MoveData } from '../data/moves';

export class MoveScorer {
  private typeChart: TypeChart;

  constructor() {
    this.typeChart = new TypeChart();
  }

  /**
   * AI_CheckBadMove - Penalize ineffective moves
   */
  checkBadMove(
    scores: number[],
    user: BattlerState,
    target: BattlerState,
    battle: BattleState
  ): void {
    for (let i = 0; i < 4; i++) {
      if (scores[i] === 0) continue;

      const move = MoveData.get(user.moves[i]);
      if (!move) continue;

      // Check type immunity
      const effectiveness = this.typeChart.getEffectiveness(
        move.type, target.types
      );
      if (effectiveness === TYPE_EFFECTIVENESS.IMMUNE) {
        scores[i] -= 10;
        continue;
      }

      // Check ability immunity
      if (this.abilityBlocksMove(target.ability, move)) {
        scores[i] -= 12;
        continue;
      }

      // Check status move effectiveness
      if (move.category === 'status') {
        this.checkStatusMoveValidity(scores, i, move, target, battle);
      }
    }
  }

  /**
   * AI_TryToFaint - Prioritize KO moves
   */
  tryToFaint(
    scores: number[],
    user: BattlerState,
    target: BattlerState,
    battle: BattleState
  ): void {
    const strongestMoveIdx = this.findStrongestMove(user, target);

    for (let i = 0; i < 4; i++) {
      if (scores[i] === 0) continue;

      const move = MoveData.get(user.moves[i]);
      if (!move || move.power === 0) continue;

      // Check if move can faint
      const damage = battle.calculateDamage(user, target, move);
      if (damage >= target.hp) {
        // Explosion check - don't encourage self-KO for KO
        if (move.effect === 'EXPLOSION') continue;

        scores[i] += 4;

        // Extra bonus for priority moves
        if (move.priority > 0) {
          scores[i] += 2;
        }
      } else {
        // Penalize non-most-powerful moves
        if (i !== strongestMoveIdx) {
          scores[i] -= 1;
        }

        // Bonus for 4x super effective
        const effectiveness = this.typeChart.getEffectiveness(
          move.type, target.types
        );
        if (effectiveness === TYPE_EFFECTIVENESS.QUADRUPLE) {
          if (Math.random() > 0.31) { // ~68% chance
            scores[i] += 2;
          }
        }
      }
    }
  }

  /**
   * AI_CheckViability - Comprehensive move evaluation
   */
  checkViability(
    scores: number[],
    user: BattlerState,
    target: BattlerState,
    battle: BattleState
  ): void {
    for (let i = 0; i < 4; i++) {
      if (scores[i] === 0) continue;

      const move = MoveData.get(user.moves[i]);
      if (!move) continue;

      // Route to effect-specific handlers
      switch (move.effect) {
        case 'SLEEP':
          this.scoreSleepMove(scores, i, user, target);
          break;
        case 'RESTORE_HP':
        case 'SOFTBOILED':
          this.scoreHealingMove(scores, i, user, target, battle);
          break;
        case 'ATTACK_UP':
        case 'ATTACK_UP_2':
          this.scoreStatBoostMove(scores, i, user, 'attack');
          break;
        case 'SPEED_UP':
        case 'SPEED_UP_2':
          this.scoreSpeedBoostMove(scores, i, user, target);
          break;
        case 'TOXIC':
        case 'LEECH_SEED':
          this.scoreDOTMove(scores, i, user, target);
          break;
        case 'PROTECT':
          this.scoreProtectMove(scores, i, user, target);
          break;
        // ... many more effect handlers
      }
    }
  }

  /**
   * AI_SetupFirstTurn - Encourage setup on turn 0
   */
  setupFirstTurn(
    scores: number[],
    user: BattlerState,
    battle: BattleState
  ): void {
    if (battle.turnCount !== 0) return;

    const setupEffects = [
      'ATTACK_UP', 'DEFENSE_UP', 'SPEED_UP', 'SPECIAL_ATTACK_UP',
      'ATTACK_UP_2', 'DEFENSE_UP_2', 'DRAGON_DANCE', 'CALM_MIND',
      'BULK_UP', 'LIGHT_SCREEN', 'REFLECT', 'SUBSTITUTE'
    ];

    for (let i = 0; i < 4; i++) {
      if (scores[i] === 0) continue;

      const move = MoveData.get(user.moves[i]);
      if (!move) continue;

      if (setupEffects.includes(move.effect)) {
        if (Math.random() > 0.31) { // ~68% chance
          scores[i] += 2;
        }
      }
    }
  }

  /**
   * AI_HPAware - Adjust based on HP levels
   */
  hpAware(
    scores: number[],
    user: BattlerState,
    target: BattlerState
  ): void {
    const userHpPercent = (user.hp / user.maxHp) * 100;
    const targetHpPercent = (target.hp / target.maxHp) * 100;

    const discouragedHighHP = ['EXPLOSION', 'RESTORE_HP', 'REST', 'DESTINY_BOND'];
    const discouragedLowHP = ['ATTACK_UP', 'DEFENSE_UP', 'DRAGON_DANCE', 'BELLY_DRUM'];

    for (let i = 0; i < 4; i++) {
      if (scores[i] === 0) continue;

      const move = MoveData.get(user.moves[i]);
      if (!move) continue;

      // User HP checks
      if (userHpPercent > 70 && discouragedHighHP.includes(move.effect)) {
        if (Math.random() > 0.5) scores[i] -= 2;
      }
      if (userHpPercent < 30 && discouragedLowHP.includes(move.effect)) {
        if (Math.random() > 0.5) scores[i] -= 2;
      }

      // Target HP checks
      if (targetHpPercent < 30) {
        // Don't waste status on nearly dead target
        if (['SLEEP', 'TOXIC', 'PARALYZE'].includes(move.effect)) {
          if (Math.random() > 0.5) scores[i] -= 2;
        }
      }
    }
  }

  // Helper methods
  private findStrongestMove(user: BattlerState, target: BattlerState): number {
    let bestIdx = 0;
    let bestDamage = 0;

    for (let i = 0; i < 4; i++) {
      const move = MoveData.get(user.moves[i]);
      if (!move || move.power === 0) continue;

      // Rough damage estimate
      const effectiveness = this.typeChart.getEffectiveness(
        move.type, target.types
      );
      const damage = move.power * (effectiveness / 40);

      if (damage > bestDamage) {
        bestDamage = damage;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  private abilityBlocksMove(ability: number, move: MoveData): boolean {
    const abilityBlocks: Record<number, string[]> = {
      [ABILITY_VOLT_ABSORB]: ['Electric'],
      [ABILITY_WATER_ABSORB]: ['Water'],
      [ABILITY_FLASH_FIRE]: ['Fire'],
      [ABILITY_LEVITATE]: ['Ground'],
      [ABILITY_SOUNDPROOF]: ['sound-based'], // Sound moves
    };

    const blocked = abilityBlocks[ability];
    if (!blocked) return false;

    return blocked.includes(move.type) ||
           (blocked.includes('sound-based') && move.flags?.sound);
  }

  // Individual effect scorers...
  private scoreSleepMove(scores: number[], i: number, user: BattlerState, target: BattlerState): void {
    // Bonus if user has Dream Eater or Nightmare
    if (user.moves.some(m => ['DREAM_EATER', 'NIGHTMARE'].includes(MoveData.get(m)?.effect))) {
      if (Math.random() > 0.5) scores[i] += 1;
    }
  }

  private scoreHealingMove(scores: number[], i: number, user: BattlerState, target: BattlerState, battle: BattleState): void {
    const hpPercent = (user.hp / user.maxHp) * 100;

    if (hpPercent === 100) {
      scores[i] -= 8;
      return;
    }

    const isFaster = battle.isFaster(user, target);

    if (!isFaster && hpPercent > 80) {
      scores[i] -= 3;
    } else if (hpPercent < 40) {
      if (Math.random() > 0.08) scores[i] += 2;
    }
  }

  private scoreSpeedBoostMove(scores: number[], i: number, user: BattlerState, target: BattlerState): void {
    // If already faster, discourage
    const userSpeed = this.getEffectiveSpeed(user);
    const targetSpeed = this.getEffectiveSpeed(target);

    if (userSpeed > targetSpeed) {
      scores[i] -= 3;
    } else {
      if (Math.random() > 0.27) scores[i] += 3;
    }
  }
}
```

## Useful Source Files

### Existing Project Files to Leverage

| File | Purpose for Battle AI |
|------|----------------------|
| `src/types/objectEvents.ts` | Type definitions pattern |
| `src/game/PlayerController.ts` | State management pattern |
| `src/save/SaveManager.ts` | Persistence pattern |

### Data Files Needed

Create or extract from pokeemerald:

1. `src/battle/data/moves.json` - All move data
2. `src/battle/data/abilities.json` - Ability effects
3. `src/battle/data/typeChart.json` - Type effectiveness matrix
4. `src/battle/data/items.json` - Item effects

## Testing Strategy

```typescript
describe('AIEngine', () => {
  describe('Wild Pokemon', () => {
    it('should select random moves', () => {
      const ai = new AIEngine();
      const pokemon = createTestPokemon(['Tackle', 'Growl', 'Leer', 'Scratch']);

      // Run many times, verify distribution
      const selections = new Map<number, number>();
      for (let i = 0; i < 1000; i++) {
        const action = ai.chooseAction(battle, pokemon, [], { isTrainer: false });
        const count = selections.get(action.moveIndex) || 0;
        selections.set(action.moveIndex, count + 1);
      }

      // Should be roughly even distribution
      for (const [_, count] of selections) {
        expect(count).toBeGreaterThan(200);
        expect(count).toBeLessThan(300);
      }
    });
  });

  describe('Trainer AI', () => {
    it('should avoid immune moves', () => {
      const ai = new AIEngine();
      const pokemon = createTestPokemon(['Thunderbolt', 'Surf']);
      const target = createTestPokemon([], { types: ['Ground'] });

      const action = ai.chooseAction(battle, pokemon, [], {
        isTrainer: true,
        aiFlags: AI_FLAGS.CHECK_BAD_MOVE,
        trainerItems: []
      });

      // Should pick Surf (Ground is immune to Electric)
      expect(action.moveIndex).toBe(1);
    });

    it('should prioritize KO moves', () => {
      const ai = new AIEngine();
      const pokemon = createTestPokemon(['Tackle', 'Hyper Beam']);
      const target = createTestPokemon([], { hp: 10, maxHp: 100 });

      const action = ai.chooseAction(battle, pokemon, [], {
        isTrainer: true,
        aiFlags: AI_FLAGS.TRY_TO_FAINT,
        trainerItems: []
      });

      // Either move can KO, but Tackle avoids recharge
      // AI should still heavily favor the KO
    });
  });
});
```

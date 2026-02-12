---
title: AI Enhancement Proposals
status: reference
written_on: 2025-11-26
last_verified: 2026-01-13
---

# AI Enhancement Proposals

## Overview

The Pokemon Emerald AI system, while sophisticated for its time, has significant room for improvement. This document proposes enhancements to make battles more challenging and engaging.

## Current Limitations

### 1. Wild Pokemon Have No AI
Wild Pokemon select moves completely at random, making encounters trivial once players understand the mechanic.

### 2. No Damage Prediction
The AI doesn't calculate actual damage - it relies on type effectiveness and power comparisons, missing STAB, stat differences, and ability interactions.

### 3. Limited Move Synergy Awareness
The AI evaluates moves independently rather than considering combos or team strategies.

### 4. No Speed Tie Awareness
The AI doesn't account for speed ties or priority interactions.

### 5. Single-Turn Thinking
No lookahead or prediction of opponent actions.

---

## Enhancement Level 1: Basic Improvements

### 1.1 Wild Pokemon Basic AI

Add basic intelligence to wild Pokemon without making them too difficult.

```typescript
const WILD_AI_FLAGS = AI_FLAGS.CHECK_BAD_MOVE;  // Just avoid immunities

function selectWildMove(pokemon: BattlerState, target: BattlerState): AIAction {
  const scores = new Array(4).fill(50);  // Lower base score = more variance

  // Only avoid obviously bad moves
  for (let i = 0; i < 4; i++) {
    const move = getMove(pokemon.moves[i]);
    if (!move) continue;

    // Avoid immune moves
    if (isImmune(target, move.type)) {
      scores[i] = 0;
    }

    // Slight preference for damaging moves
    if (move.power > 0) {
      scores[i] += 10;
    }
  }

  return selectWeightedRandom(scores);
}
```

**Impact**: Wild encounters slightly more logical without being frustrating.

### 1.2 Actual Damage Calculation

Replace power comparisons with actual damage calculation.

```typescript
function scoreMoveByDamage(
  user: BattlerState,
  target: BattlerState,
  move: MoveData,
  battle: BattleState
): number {
  // Full damage formula
  const damage = calculateDamage({
    attacker: user,
    defender: target,
    move: move,
    weather: battle.weather,
    criticalHit: false,  // Average case
    randomFactor: 0.925  // Average roll
  });

  const hpPercent = (damage / target.hp) * 100;

  if (hpPercent >= 100) return 10;  // OHKO
  if (hpPercent >= 50) return 5;    // 2HKO
  if (hpPercent >= 33) return 3;    // 3HKO
  if (hpPercent >= 25) return 2;    // 4HKO
  return 0;
}
```

**Impact**: AI makes better damage-based decisions.

### 1.3 STAB Awareness

```typescript
function getSTABMultiplier(user: BattlerState, move: MoveData): number {
  if (user.types.includes(move.type)) {
    return 1.5;
  }
  return 1.0;
}

// In scoring
const effectivePower = move.power * getSTABMultiplier(user, move);
```

---

## Enhancement Level 2: Strategic Improvements

### 2.1 Speed Awareness with Prediction

```typescript
interface SpeedContext {
  userSpeed: number;
  targetSpeed: number;
  userPriority: number;
  targetExpectedPriority: number;  // Based on move history
  paralysisSlowChance: number;
}

function evaluateSpeedContext(
  user: BattlerState,
  target: BattlerState,
  move: MoveData,
  history: BattleHistory
): SpeedContext {
  const userSpeed = getEffectiveSpeed(user);
  const targetSpeed = getEffectiveSpeed(target);

  // Predict opponent's likely priority
  let expectedPriority = 0;
  const targetMoves = history.getKnownMoves(target);
  for (const knownMove of targetMoves) {
    if (knownMove.priority > expectedPriority) {
      expectedPriority = knownMove.priority;
    }
  }

  return {
    userSpeed,
    targetSpeed,
    userPriority: move.priority,
    targetExpectedPriority: expectedPriority,
    paralysisSlowChance: target.status1 & STATUS_PARALYSIS ? 0.25 : 0
  };
}
```

### 2.2 Move Synergy Detection

```typescript
const MOVE_SYNERGIES = {
  'RAIN_DANCE': {
    boosted: ['Thunder', 'Hurricane', 'Weather Ball'],
    weakened: ['Solar Beam', 'Fire moves'],
    abilities: ['Swift Swim', 'Rain Dish']
  },
  'SUBSTITUTE': {
    enables: ['Focus Punch', 'Belly Drum'],
    protectsFrom: ['Status moves']
  },
  'BATON_PASS': {
    passable: ['ATTACK_UP', 'SPEED_UP', 'SUBSTITUTE'],
    requires: ['Party with receivers']
  }
};

function scoreSynergyBonus(
  user: BattlerState,
  move: MoveData,
  party: Pokemon[]
): number {
  let bonus = 0;

  // Check if this move enables a combo
  const synergy = MOVE_SYNERGIES[move.effect];
  if (!synergy) return 0;

  // Example: Rain Dance with Swift Swim party member
  if (move.effect === 'RAIN_DANCE') {
    const hasSwiftSwim = party.some(p =>
      p.ability === ABILITY_SWIFT_SWIM && p.hp > 0
    );
    if (hasSwiftSwim) bonus += 3;
  }

  return bonus;
}
```

### 2.3 Threat Assessment

```typescript
interface ThreatLevel {
  canOHKO: boolean;
  can2HKO: boolean;
  superEffectiveMoves: number;
  setupPotential: number;  // How dangerous if they set up
}

function assessThreat(
  target: BattlerState,
  user: BattlerState,
  history: BattleHistory
): ThreatLevel {
  const knownMoves = history.getKnownMoves(target);

  let canOHKO = false;
  let can2HKO = false;
  let superEffectiveMoves = 0;
  let setupPotential = 0;

  for (const move of knownMoves) {
    const damage = estimateDamage(target, user, move);
    const effectiveness = getEffectiveness(move.type, user.types);

    if (damage >= user.hp) canOHKO = true;
    if (damage >= user.hp / 2) can2HKO = true;
    if (effectiveness > TYPE_EFFECTIVENESS.NORMAL) superEffectiveMoves++;

    if (isSetupMove(move)) {
      setupPotential += getSetupValue(move);
    }
  }

  return { canOHKO, can2HKO, superEffectiveMoves, setupPotential };
}
```

---

## Enhancement Level 3: Advanced AI

### 3.1 Multi-Turn Lookahead

```typescript
interface GameState {
  user: BattlerState;
  target: BattlerState;
  weather: Weather;
  terrain: Terrain;
  turn: number;
}

interface MoveOutcome {
  newState: GameState;
  probability: number;
  value: number;  // Positive = good for AI
}

function evaluateWithLookahead(
  state: GameState,
  depth: number
): number {
  if (depth === 0 || isBattleOver(state)) {
    return evaluatePosition(state);
  }

  const aiMoves = getValidMoves(state.user);
  let bestValue = -Infinity;

  for (const move of aiMoves) {
    // Simulate move
    const outcomes = simulateMove(state, move);

    // For each outcome, consider opponent's best response
    let moveValue = 0;
    for (const outcome of outcomes) {
      const opponentMoves = getValidMoves(outcome.newState.target);
      let worstCase = Infinity;

      for (const oppMove of opponentMoves) {
        const oppOutcomes = simulateMove(outcome.newState, oppMove);
        for (const oppOutcome of oppOutcomes) {
          const futureValue = evaluateWithLookahead(oppOutcome.newState, depth - 1);
          worstCase = Math.min(worstCase, futureValue);
        }
      }

      moveValue += outcome.probability * worstCase;
    }

    bestValue = Math.max(bestValue, moveValue);
  }

  return bestValue;
}
```

### 3.2 Opponent Move Prediction

```typescript
interface MovePrediction {
  move: MoveData;
  probability: number;
  reasoning: string;
}

function predictOpponentMove(
  opponent: BattlerState,
  user: BattlerState,
  history: BattleHistory
): MovePrediction[] {
  const predictions: MovePrediction[] = [];
  const knownMoves = history.getKnownMoves(opponent);

  // Check for obvious plays
  for (const move of knownMoves) {
    let probability = 0.25;  // Base probability
    let reasoning = 'Default';

    // Can they KO us?
    const damage = estimateDamage(opponent, user, move);
    if (damage >= user.hp) {
      probability += 0.4;
      reasoning = 'Can OHKO';
    }

    // Super effective?
    if (getEffectiveness(move.type, user.types) > TYPE_EFFECTIVENESS.NORMAL) {
      probability += 0.2;
      reasoning += ', Super effective';
    }

    // Are they low HP? Might use recovery
    if (opponent.hp < opponent.maxHp * 0.3 && isHealingMove(move)) {
      probability += 0.3;
      reasoning = 'Likely to heal';
    }

    // Are we setting up? They might use phazing
    if (user.statStages.attack > 0 || user.statStages.spAtk > 0) {
      if (move.effect === 'ROAR' || move.effect === 'WHIRLWIND') {
        probability += 0.3;
        reasoning = 'Counter our setup';
      }
    }

    predictions.push({ move, probability, reasoning });
  }

  // Normalize probabilities
  const total = predictions.reduce((sum, p) => sum + p.probability, 0);
  for (const p of predictions) {
    p.probability /= total;
  }

  return predictions.sort((a, b) => b.probability - a.probability);
}
```

### 3.3 Adaptive Difficulty

```typescript
interface DifficultySettings {
  level: 'easy' | 'normal' | 'hard' | 'expert';
  mistakeChance: number;  // Chance to make suboptimal play
  lookaheadDepth: number;
  useMovePrediction: boolean;
  useSynergyDetection: boolean;
  perfectTypeKnowledge: boolean;  // Know opponent's types
  perfectMoveKnowledge: boolean;  // Know opponent's moveset
}

const DIFFICULTY_PRESETS: Record<string, DifficultySettings> = {
  easy: {
    level: 'easy',
    mistakeChance: 0.3,
    lookaheadDepth: 0,
    useMovePrediction: false,
    useSynergyDetection: false,
    perfectTypeKnowledge: false,
    perfectMoveKnowledge: false
  },
  normal: {
    level: 'normal',
    mistakeChance: 0.1,
    lookaheadDepth: 1,
    useMovePrediction: true,
    useSynergyDetection: false,
    perfectTypeKnowledge: true,
    perfectMoveKnowledge: false
  },
  hard: {
    level: 'hard',
    mistakeChance: 0.05,
    lookaheadDepth: 2,
    useMovePrediction: true,
    useSynergyDetection: true,
    perfectTypeKnowledge: true,
    perfectMoveKnowledge: false
  },
  expert: {
    level: 'expert',
    mistakeChance: 0,
    lookaheadDepth: 3,
    useMovePrediction: true,
    useSynergyDetection: true,
    perfectTypeKnowledge: true,
    perfectMoveKnowledge: true  // "Omniscient" AI
  }
};
```

---

## Enhancement Level 4: Machine Learning Integration

### 4.1 Neural Network Move Selection

For truly advanced AI, train a neural network on competitive battle data.

```typescript
interface NeuralNetInput {
  // User Pokemon (normalized)
  userHpPercent: number;
  userTypes: number[];  // One-hot encoded
  userAbility: number;  // Embedding
  userStatStages: number[];
  userStatus: number[];  // One-hot

  // Target Pokemon
  targetHpPercent: number;
  targetTypes: number[];
  targetAbility: number;
  targetStatStages: number[];
  targetStatus: number[];

  // Battle context
  weather: number;
  terrain: number;
  turnCount: number;

  // Move info (for each of 4 moves)
  moveTypes: number[][];
  movePowers: number[];
  moveEffects: number[][];  // Embeddings
}

interface NeuralNetOutput {
  moveScores: [number, number, number, number];  // Softmax probabilities
  switchScore: number;  // Should switch?
  expectedValue: number;  // How good is this position?
}

class NeuralAI {
  private model: TensorFlowModel;

  async selectMove(state: BattleState): Promise<AIAction> {
    const input = this.encodeState(state);
    const output = await this.model.predict(input);

    // Select highest scoring move
    const moveIdx = output.moveScores.indexOf(Math.max(...output.moveScores));

    // Consider switching if switch score is high
    if (output.switchScore > 0.7) {
      return { type: 'switch', partyIndex: this.selectBestSwitch(state) };
    }

    return { type: 'move', moveIndex: moveIdx, target: 0 };
  }
}
```

### 4.2 Reinforcement Learning Training

```typescript
interface TrainingConfig {
  episodes: number;
  learningRate: number;
  discountFactor: number;  // Gamma
  explorationRate: number;  // Epsilon
}

async function trainAI(config: TrainingConfig): Promise<NeuralAI> {
  const ai = new NeuralAI();

  for (let episode = 0; episode < config.episodes; episode++) {
    // Self-play or play against baseline
    const battle = new BattleSimulator();
    const states: BattleState[] = [];
    const actions: AIAction[] = [];
    const rewards: number[] = [];

    while (!battle.isOver()) {
      const state = battle.getState();
      states.push(state);

      // Epsilon-greedy action selection
      let action: AIAction;
      if (Math.random() < config.explorationRate) {
        action = selectRandomAction(state);
      } else {
        action = await ai.selectMove(state);
      }

      actions.push(action);
      const reward = battle.executeAction(action);
      rewards.push(reward);
    }

    // Calculate returns and update network
    const returns = calculateDiscountedReturns(rewards, config.discountFactor);
    await ai.updateWeights(states, actions, returns, config.learningRate);

    // Decay exploration
    config.explorationRate *= 0.999;
  }

  return ai;
}
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 weeks)
1. Add basic wild Pokemon AI (CHECK_BAD_MOVE only)
2. Implement actual damage calculation
3. Fix known bugs (Counter/Mirror Coat, etc.)

### Phase 2: Core Improvements (2-4 weeks)
4. STAB awareness
5. Speed-based decision making
6. Better healing move evaluation

### Phase 3: Strategic AI (1-2 months)
7. Move synergy detection
8. Threat assessment
9. Simple 1-turn lookahead

### Phase 4: Advanced (Optional)
10. Multi-turn lookahead
11. Opponent prediction
12. Adaptive difficulty

### Phase 5: Research (Long-term)
13. Neural network integration
14. Reinforcement learning

---

## Configuration System

Allow players to customize AI difficulty:

```typescript
interface GameSettings {
  battle: {
    wildPokemonAI: 'none' | 'basic' | 'smart';
    trainerAIDifficulty: 'easy' | 'normal' | 'hard' | 'expert';
    enableMovePrediction: boolean;
    enablePerfectPlay: boolean;  // No RNG in AI decisions
  };
}

// In UI
<select onChange={setWildAI}>
  <option value="none">Classic (Random)</option>
  <option value="basic">Basic (Avoid immunities)</option>
  <option value="smart">Smart (Full AI)</option>
</select>
```

This allows:
- Nostalgic players to keep classic behavior
- Challenge-seekers to enable harder AI
- Speedrunners to use easier settings

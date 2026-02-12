---
title: React Implementation Guide
status: planned
written_on: 2025-11-26
last_verified: 2026-01-13
---

# React Implementation Guide

## Current Project Structure

Based on the existing `src/` structure:

```
src/
├── App.tsx              # Main application
├── components/
│   ├── MapRenderer.tsx  # Map rendering
│   ├── debug/
│   │   └── DebugPanel.tsx
│   └── dialog/          # Dialog system
│       ├── DialogContext.tsx
│       ├── DialogBox.tsx
│       ├── DialogFrame.tsx
│       ├── DialogText.tsx
│       └── OptionMenu.tsx
├── data/
│   ├── mapIndex.json
│   ├── items.ts
│   └── itemScripts.ts
├── game/
│   ├── FieldEffectManager.ts
│   ├── GameFlags.ts
│   ├── ObjectEventManager.ts
│   ├── PlayerController.ts
│   └── npc/
├── rendering/
├── save/
├── services/
├── types/
├── hooks/
└── utils/
```

## Proposed Battle System Structure

```
src/
├── battle/
│   ├── index.ts                    # Export all battle modules
│   ├── BattleContext.tsx           # Battle state context
│   ├── BattleManager.ts            # Core battle logic
│   │
│   ├── components/
│   │   ├── BattleScene.tsx         # Main battle container
│   │   ├── BattlefieldView.tsx     # Pokemon sprites layout
│   │   ├── BattlerSprite.tsx       # Individual Pokemon sprite
│   │   ├── HealthBar.tsx           # HP bar component
│   │   ├── StatusIcons.tsx         # Status condition icons
│   │   ├── MoveMenu.tsx            # Move selection UI
│   │   ├── ActionMenu.tsx          # Fight/Bag/Pokemon/Run
│   │   ├── TargetSelector.tsx      # Target selection (doubles)
│   │   └── BattleMessageBox.tsx    # Message display
│   │
│   ├── engine/
│   │   ├── BattleEngine.ts         # Turn execution
│   │   ├── DamageCalculator.ts     # Damage formula
│   │   ├── TypeCalculator.ts       # Type effectiveness
│   │   ├── MoveExecutor.ts         # Move script execution
│   │   ├── StatusHandler.ts        # Status effects
│   │   ├── AbilityHandler.ts       # Ability effects
│   │   └── TurnOrder.ts            # Speed/priority logic
│   │
│   ├── data/
│   │   ├── moves.ts                # Move definitions
│   │   ├── types.ts                # Type chart
│   │   ├── abilities.ts            # Ability definitions
│   │   └── messages.ts             # Battle messages
│   │
│   ├── animation/
│   │   ├── AnimationController.ts  # Animation queue
│   │   ├── MoveAnimations.ts       # Move animation data
│   │   └── SpriteAnimator.ts       # Sprite animations
│   │
│   └── types/
│       ├── battle.ts               # Battle interfaces
│       ├── pokemon.ts              # Pokemon interfaces
│       └── move.ts                 # Move interfaces
```

## Core Type Definitions

### `src/battle/types/pokemon.ts`

```typescript
export enum PokemonType {
  NORMAL = 0,
  FIGHTING = 1,
  FLYING = 2,
  POISON = 3,
  GROUND = 4,
  ROCK = 5,
  BUG = 6,
  GHOST = 7,
  STEEL = 8,
  MYSTERY = 9,
  FIRE = 10,
  WATER = 11,
  GRASS = 12,
  ELECTRIC = 13,
  PSYCHIC = 14,
  ICE = 15,
  DRAGON = 16,
  DARK = 17,
}

export enum Status {
  NONE = 0,
  SLEEP = 1,
  POISON = 2,
  BURN = 3,
  FREEZE = 4,
  PARALYSIS = 5,
  TOXIC = 6,
}

export interface BattlePokemon {
  species: number;
  nickname: string;
  level: number;

  // Stats
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  spAttack: number;
  spDefense: number;

  // Types
  types: [PokemonType, PokemonType?];

  // Battle state
  moves: [Move, Move?, Move?, Move?];
  pp: [number, number, number, number];
  ability: number;
  heldItem: number;

  // Status
  status: Status;
  statusTurns: number;  // Sleep counter, toxic counter
  statStages: StatStages;
  volatileStatus: VolatileStatus;
}

export interface StatStages {
  attack: number;   // -6 to +6
  defense: number;
  speed: number;
  spAttack: number;
  spDefense: number;
  accuracy: number;
  evasion: number;
}

export interface VolatileStatus {
  confusion: number;        // Turns remaining
  flinched: boolean;
  infatuatedWith: number | null;
  substitute: number;       // Substitute HP
  cursed: boolean;
  leechSeed: boolean;
  trapped: number;          // Bind/Wrap turns
  // ... more
}
```

### `src/battle/types/move.ts`

```typescript
export enum MoveTarget {
  SELECTED = 0,
  DEPENDS = 1,
  USER_OR_SELECTED = 2,
  RANDOM = 4,
  BOTH = 8,
  USER = 16,
  FOES_AND_ALLY = 32,
  OPPONENTS_FIELD = 64,
}

export enum MoveEffect {
  HIT = 0,
  SLEEP = 1,
  POISON_HIT = 2,
  ABSORB = 3,
  BURN_HIT = 4,
  FREEZE_HIT = 5,
  PARALYZE_HIT = 6,
  EXPLOSION = 7,
  // ... all effects from battle_move_effects.h
}

export interface Move {
  id: number;
  name: string;
  effect: MoveEffect;
  power: number;
  type: PokemonType;
  accuracy: number;
  pp: number;
  secondaryChance: number;
  target: MoveTarget;
  priority: number;
  flags: MoveFlags;
}

export interface MoveFlags {
  makesContact: boolean;
  protectAffected: boolean;
  magicCoatAffected: boolean;
  snatchAffected: boolean;
  mirrorMoveAffected: boolean;
  kingsRockAffected: boolean;
}
```

### `src/battle/types/battle.ts`

```typescript
export enum BattleType {
  WILD_SINGLE = 0,
  WILD_DOUBLE = 1,
  TRAINER_SINGLE = 2,
  TRAINER_DOUBLE = 3,
}

export enum BattlerPosition {
  PLAYER_LEFT = 0,
  OPPONENT_LEFT = 1,
  PLAYER_RIGHT = 2,
  OPPONENT_RIGHT = 3,
}

export interface BattleState {
  type: BattleType;
  turn: number;

  // Battlers
  battlers: {
    [BattlerPosition.PLAYER_LEFT]: BattlePokemon | null;
    [BattlerPosition.PLAYER_RIGHT]: BattlePokemon | null;
    [BattlerPosition.OPPONENT_LEFT]: BattlePokemon | null;
    [BattlerPosition.OPPONENT_RIGHT]: BattlePokemon | null;
  };

  // Teams
  playerTeam: BattlePokemon[];
  opponentTeam: BattlePokemon[];

  // Field conditions
  weather: Weather;
  weatherTurns: number;
  terrain: Terrain;
  fieldEffects: FieldEffects;

  // Side conditions
  playerSide: SideStatus;
  opponentSide: SideStatus;

  // Turn state
  phase: BattlePhase;
  currentAction: number;
  actionQueue: BattleAction[];

  // Messages
  messageQueue: string[];
}

export enum BattlePhase {
  INTRO = 'intro',
  ACTION_SELECTION = 'action_selection',
  MOVE_SELECTION = 'move_selection',
  TARGET_SELECTION = 'target_selection',
  TURN_EXECUTION = 'turn_execution',
  END_TURN = 'end_turn',
  BATTLE_END = 'battle_end',
}

export interface BattleAction {
  type: 'move' | 'switch' | 'item' | 'run';
  battler: BattlerPosition;
  move?: Move;
  target?: BattlerPosition;
  newPokemon?: number;  // Party index for switch
  item?: number;
}

export interface SideStatus {
  reflect: number;       // Turns remaining
  lightScreen: number;
  safeguard: number;
  mist: number;
  spikes: number;        // Layers (0-3)
  futureAttack: FutureAttack | null;
}

export enum Weather {
  NONE = 0,
  RAIN = 1,
  SUN = 2,
  SANDSTORM = 3,
  HAIL = 4,
}
```

## Battle Engine Implementation

### `src/battle/engine/DamageCalculator.ts`

```typescript
import { BattlePokemon, PokemonType } from '../types/pokemon';
import { Move } from '../types/move';
import { BattleState, SideStatus, Weather } from '../types/battle';
import { getTypeEffectiveness, isPhysicalType } from './TypeCalculator';

export interface DamageResult {
  damage: number;
  isCritical: boolean;
  effectiveness: 'immune' | 'not_effective' | 'neutral' | 'super_effective';
  messages: string[];
}

export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: Move,
  state: BattleState,
  defenderSide: SideStatus
): DamageResult {
  const messages: string[] = [];

  // Check immunity first
  const typeMultiplier = getTypeEffectiveness(move.type, defender.types);
  if (typeMultiplier === 0) {
    return {
      damage: 0,
      isCritical: false,
      effectiveness: 'immune',
      messages: [`It doesn't affect ${defender.nickname}...`],
    };
  }

  // Get attack and defense stats
  const isPhysical = isPhysicalType(move.type);
  let attack = isPhysical ? attacker.attack : attacker.spAttack;
  let defense = isPhysical ? defender.defense : defender.spDefense;

  // Apply stat stages
  attack = applyStatStage(attack, isPhysical
    ? attacker.statStages.attack
    : attacker.statStages.spAttack);
  defense = applyStatStage(defense, isPhysical
    ? defender.statStages.defense
    : defender.statStages.spDefense);

  // Apply ability modifiers
  attack = applyAbilityAttackModifiers(attacker, move, attack);
  defense = applyAbilityDefenseModifiers(defender, move, defense);

  // Critical hit check
  const isCritical = rollCriticalHit(attacker, move);
  if (isCritical) {
    messages.push('A critical hit!');
    // Crits ignore negative attack stages and positive defense stages
    if (isPhysical) {
      if (attacker.statStages.attack < 0) {
        attack = attacker.attack;
      }
      if (defender.statStages.defense > 0) {
        defense = defender.defense;
      }
    } else {
      if (attacker.statStages.spAttack < 0) {
        attack = attacker.spAttack;
      }
      if (defender.statStages.spDefense > 0) {
        defense = defender.spDefense;
      }
    }
  }

  // Base damage calculation
  let power = getEffectivePower(move, attacker, state);
  let damage = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * power * attack) / defense / 50
  ) + 2;

  // Critical hit doubles damage
  if (isCritical) {
    damage *= 2;
  }

  // Random factor (85-100%)
  const random = 85 + Math.floor(Math.random() * 16);
  damage = Math.floor(damage * random / 100);

  // STAB
  if (attacker.types.includes(move.type)) {
    damage = Math.floor(damage * 1.5);
  }

  // Type effectiveness
  damage = Math.floor(damage * typeMultiplier);

  // Burn halves physical damage
  if (isPhysical && attacker.status === Status.BURN) {
    // Unless ability is Guts
    if (attacker.ability !== ABILITY_GUTS) {
      damage = Math.floor(damage / 2);
    }
  }

  // Screen reduction
  if (!isCritical) {
    const screenActive = isPhysical
      ? defenderSide.reflect > 0
      : defenderSide.lightScreen > 0;

    if (screenActive) {
      if (isDoubleBattle(state) && countAliveOnSide(state, getDefenderSide(defender)) === 2) {
        damage = Math.floor(damage * 2 / 3);
      } else {
        damage = Math.floor(damage / 2);
      }
    }
  }

  // Weather modifiers (special moves only)
  if (!isPhysical) {
    if (state.weather === Weather.RAIN) {
      if (move.type === PokemonType.WATER) {
        damage = Math.floor(damage * 1.5);
      } else if (move.type === PokemonType.FIRE) {
        damage = Math.floor(damage / 2);
      }
    } else if (state.weather === Weather.SUN) {
      if (move.type === PokemonType.FIRE) {
        damage = Math.floor(damage * 1.5);
      } else if (move.type === PokemonType.WATER) {
        damage = Math.floor(damage / 2);
      }
    }
  }

  // Minimum 1 damage
  damage = Math.max(1, damage);

  // Determine effectiveness message
  let effectiveness: DamageResult['effectiveness'] = 'neutral';
  if (typeMultiplier > 1) {
    effectiveness = 'super_effective';
    messages.push("It's super effective!");
  } else if (typeMultiplier < 1) {
    effectiveness = 'not_effective';
    messages.push("It's not very effective...");
  }

  return {
    damage,
    isCritical,
    effectiveness,
    messages,
  };
}

function applyStatStage(stat: number, stage: number): number {
  const numerators = [10, 10, 10, 10, 10, 10, 10, 15, 20, 25, 30, 35, 40];
  const denominators = [40, 35, 30, 25, 20, 15, 10, 10, 10, 10, 10, 10, 10];
  const index = stage + 6;  // Convert -6..+6 to 0..12
  return Math.floor(stat * numerators[index] / denominators[index]);
}

function rollCriticalHit(attacker: BattlePokemon, move: Move): boolean {
  let stage = 0;

  // High crit moves
  if (move.effect === MoveEffect.HIGH_CRITICAL) {
    stage++;
  }

  // Focus Energy
  if (attacker.volatileStatus.focusEnergy) {
    stage++;
  }

  // Scope Lens / Razor Claw
  if (hasHoldEffect(attacker, HOLD_EFFECT_SCOPE_LENS)) {
    stage++;
  }

  const chances = [16, 8, 4, 3, 2];
  const chance = chances[Math.min(stage, 4)];
  return Math.floor(Math.random() * chance) === 0;
}
```

## Battle Context and Hooks

### `src/battle/BattleContext.tsx`

```typescript
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { BattleState, BattleAction, BattlePhase } from './types/battle';

type BattleDispatch = (action: BattleReducerAction) => void;

const BattleStateContext = createContext<BattleState | undefined>(undefined);
const BattleDispatchContext = createContext<BattleDispatch | undefined>(undefined);

type BattleReducerAction =
  | { type: 'SET_PHASE'; phase: BattlePhase }
  | { type: 'QUEUE_ACTION'; action: BattleAction }
  | { type: 'EXECUTE_ACTION' }
  | { type: 'UPDATE_HP'; battler: BattlerPosition; hp: number }
  | { type: 'SET_STATUS'; battler: BattlerPosition; status: Status }
  | { type: 'ADD_MESSAGE'; message: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_WEATHER'; weather: Weather; turns: number }
  | { type: 'END_TURN' };

function battleReducer(state: BattleState, action: BattleReducerAction): BattleState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'QUEUE_ACTION':
      return {
        ...state,
        actionQueue: [...state.actionQueue, action.action],
      };

    case 'UPDATE_HP':
      return {
        ...state,
        battlers: {
          ...state.battlers,
          [action.battler]: state.battlers[action.battler]
            ? { ...state.battlers[action.battler]!, hp: action.hp }
            : null,
        },
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messageQueue: [...state.messageQueue, action.message],
      };

    case 'END_TURN':
      return {
        ...state,
        turn: state.turn + 1,
        phase: BattlePhase.ACTION_SELECTION,
        actionQueue: [],
      };

    default:
      return state;
  }
}

export function BattleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(battleReducer, createInitialState());

  return (
    <BattleStateContext.Provider value={state}>
      <BattleDispatchContext.Provider value={dispatch}>
        {children}
      </BattleDispatchContext.Provider>
    </BattleStateContext.Provider>
  );
}

export function useBattleState(): BattleState {
  const context = useContext(BattleStateContext);
  if (!context) throw new Error('useBattleState must be used within BattleProvider');
  return context;
}

export function useBattleDispatch(): BattleDispatch {
  const context = useContext(BattleDispatchContext);
  if (!context) throw new Error('useBattleDispatch must be used within BattleProvider');
  return context;
}
```

### `src/battle/hooks/useBattleEngine.ts`

```typescript
import { useCallback } from 'react';
import { useBattleState, useBattleDispatch } from '../BattleContext';
import { calculateDamage } from '../engine/DamageCalculator';
import { determineTurnOrder } from '../engine/TurnOrder';

export function useBattleEngine() {
  const state = useBattleState();
  const dispatch = useBattleDispatch();

  const executeMove = useCallback(async (
    attacker: BattlerPosition,
    move: Move,
    target: BattlerPosition
  ) => {
    const attackerMon = state.battlers[attacker];
    const targetMon = state.battlers[target];
    if (!attackerMon || !targetMon) return;

    // Show move usage message
    dispatch({
      type: 'ADD_MESSAGE',
      message: `${attackerMon.nickname} used ${move.name}!`,
    });

    // Wait for message animation
    await delay(1000);

    // Calculate damage
    const defenderSide = getDefenderSide(target) === 'player'
      ? state.playerSide
      : state.opponentSide;

    const result = calculateDamage(
      attackerMon,
      targetMon,
      move,
      state,
      defenderSide
    );

    // Play animation
    await playMoveAnimation(move, attacker, target);

    // Apply damage
    const newHp = Math.max(0, targetMon.hp - result.damage);
    dispatch({ type: 'UPDATE_HP', battler: target, hp: newHp });

    // Show result messages
    for (const message of result.messages) {
      dispatch({ type: 'ADD_MESSAGE', message });
      await delay(800);
    }

    // Check faint
    if (newHp === 0) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: `${targetMon.nickname} fainted!`,
      });
      await delay(1000);
    }
  }, [state, dispatch]);

  const executeTurn = useCallback(async () => {
    dispatch({ type: 'SET_PHASE', phase: BattlePhase.TURN_EXECUTION });

    // Determine turn order
    const order = determineTurnOrder(state.actionQueue, state);

    // Execute actions in order
    for (const action of order) {
      if (action.type === 'move' && action.move && action.target !== undefined) {
        await executeMove(action.battler, action.move, action.target);
      }
      // Handle other action types...
    }

    dispatch({ type: 'END_TURN' });
  }, [state, dispatch, executeMove]);

  return {
    executeMove,
    executeTurn,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Battle Scene Component

### `src/battle/components/BattleScene.tsx`

```typescript
import React from 'react';
import { BattleProvider, useBattleState } from '../BattleContext';
import { BattlefieldView } from './BattlefieldView';
import { ActionMenu } from './ActionMenu';
import { MoveMenu } from './MoveMenu';
import { BattleMessageBox } from './BattleMessageBox';
import { BattlePhase } from '../types/battle';

export function BattleScene() {
  return (
    <BattleProvider>
      <BattleSceneContent />
    </BattleProvider>
  );
}

function BattleSceneContent() {
  const state = useBattleState();

  return (
    <div className="battle-scene">
      {/* Battlefield with Pokemon sprites */}
      <BattlefieldView />

      {/* Message box / Menu area */}
      <div className="battle-ui">
        {state.messageQueue.length > 0 && (
          <BattleMessageBox messages={state.messageQueue} />
        )}

        {state.phase === BattlePhase.ACTION_SELECTION && (
          <ActionMenu />
        )}

        {state.phase === BattlePhase.MOVE_SELECTION && (
          <MoveMenu />
        )}
      </div>
    </div>
  );
}
```

## Integration with Existing Dialog System

The existing `src/components/dialog/` system can be extended for battle messages:

```typescript
// In BattleMessageBox.tsx
import { useDialog } from '../dialog';

export function BattleMessageBox({ messages }: { messages: string[] }) {
  const { showText } = useDialog();

  useEffect(() => {
    if (messages.length > 0) {
      showText(messages[messages.length - 1]);
    }
  }, [messages, showText]);

  return (
    <DialogBox>
      <DialogText text={messages[messages.length - 1] || ''} />
    </DialogBox>
  );
}
```

## Key Implementation Notes

1. **State Management**: Use React Context + useReducer for predictable state updates
2. **Animation Timing**: Use async/await with promises for sequenced animations
3. **Type Safety**: Full TypeScript interfaces matching the original game data
4. **Separation of Concerns**: Engine logic separate from React components
5. **Reuse Existing Systems**: Leverage dialog system, save system, sprite loading

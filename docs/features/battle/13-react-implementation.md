---
title: React Implementation Plan
status: planned
written_on: 2025-11-26
last_verified: 2026-01-13
---

# React Implementation Plan

This document outlines a strategy for implementing the Pokemon Emerald battle system in React, based on the existing codebase patterns in `src/`.

## Existing Architecture Analysis

The current project uses:
- React with TypeScript
- Component-based architecture (`MapRenderer`, `DialogProvider`)
- Custom hooks and refs for game state
- CSS for styling
- JSON data files for map/tileset data

### Relevant Existing Patterns

From `src/App.tsx`:
```tsx
// State management via useState
const [selectedMapId, setSelectedMapId] = useState<string>(defaultMap?.id ?? '');

// Refs for imperative handles
const mapRendererRef = useRef<MapRendererHandle>(null);

// Save/load system via saveManager
import { saveManager } from './save';
```

## Proposed Battle System Architecture

```
src/
├── battle/
│   ├── components/
│   │   ├── BattleScreen.tsx       # Main battle container
│   │   ├── BattleField.tsx        # Pokemon sprites and animations
│   │   ├── HealthBox.tsx          # HP bars, status, level
│   │   ├── ActionMenu.tsx         # Fight/Bag/Pokemon/Run
│   │   ├── MoveMenu.tsx           # 4 move selection
│   │   ├── MessageBox.tsx         # Battle text display
│   │   └── PartyBalls.tsx         # Party status indicators
│   ├── hooks/
│   │   ├── useBattle.ts           # Main battle state machine
│   │   ├── useBattleAnimation.ts  # Animation sequencing
│   │   └── useBattleAI.ts         # AI move selection
│   ├── engine/
│   │   ├── BattleEngine.ts        # Core battle logic
│   │   ├── DamageCalculator.ts    # Damage formula
│   │   ├── TypeChart.ts           # Type effectiveness
│   │   ├── CaptureCalculator.ts   # Catch rate formula
│   │   ├── MoveExecutor.ts        # Move effect handlers
│   │   └── StatCalculator.ts      # Stat calculations
│   ├── data/
│   │   ├── moves.json             # Move data
│   │   ├── typeChart.json         # Type effectiveness table
│   │   └── abilities.json         # Ability effects
│   ├── types/
│   │   └── battle.ts              # TypeScript interfaces
│   └── index.ts
├── pokemon/
│   ├── types/
│   │   └── pokemon.ts             # Pokemon data structures
│   ├── data/
│   │   └── species.json           # Base stats, types, etc.
│   └── utils/
│       └── statCalculator.ts      # IV/EV/Nature calculations
```

## Core Types

```tsx
// src/battle/types/battle.ts

export interface BattlePokemon {
  // Identity
  species: number;
  nickname: string;
  level: number;

  // Stats (calculated)
  stats: {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
  };

  // Current state
  currentHp: number;
  status: StatusCondition | null;

  // Moves
  moves: Move[];
  pp: number[];

  // Battle modifiers
  statStages: StatStages;
  volatileStatus: VolatileStatus[];

  // Source data (for calculations)
  ivs: Stats;
  evs: Stats;
  nature: Nature;
  ability: number;
  heldItem: number;
}

export interface BattleState {
  // Battle configuration
  type: BattleType;
  flags: number;

  // Combatants
  player: BattlerState;
  enemy: BattlerState;

  // Field state
  weather: Weather | null;
  weatherTurns: number;
  terrain: Terrain | null;

  // Turn state
  turnNumber: number;
  phase: BattlePhase;

  // UI state
  currentMenu: MenuType;
  selectedMove: number;
  message: string;
  messageQueue: string[];
}

export type BattlePhase =
  | 'intro'           // Battle starting
  | 'action_select'   // Player choosing action
  | 'move_select'     // Player choosing move
  | 'target_select'   // For doubles
  | 'turn_execute'    // Processing turn
  | 'animation'       // Playing animations
  | 'message'         // Showing message
  | 'switch'          // Switching Pokemon
  | 'capture'         // Attempting capture
  | 'victory'         // Battle won
  | 'defeat'          // Battle lost
  | 'fled';           // Successfully fled

export interface TurnAction {
  type: 'move' | 'switch' | 'item' | 'run';
  moveIndex?: number;
  targetIndex?: number;
  switchIndex?: number;
  itemId?: number;
}
```

## Battle Engine

```tsx
// src/battle/engine/BattleEngine.ts

export class BattleEngine {
  private state: BattleState;
  private onStateChange: (state: BattleState) => void;

  constructor(config: BattleConfig) {
    this.state = this.initializeBattle(config);
  }

  // Turn execution
  async executeTurn(playerAction: TurnAction): Promise<void> {
    const enemyAction = this.determineEnemyAction();

    // Determine order
    const orderedActions = this.orderActions(playerAction, enemyAction);

    // Execute each action
    for (const action of orderedActions) {
      await this.executeAction(action);

      // Check for battle end
      if (this.checkBattleEnd()) break;
    }

    // End of turn effects
    await this.processEndOfTurn();
  }

  private orderActions(
    player: TurnAction,
    enemy: TurnAction
  ): OrderedAction[] {
    // Priority moves first
    // Then by speed (with random tie-breaker)
    const playerPriority = this.getActionPriority(player, 'player');
    const enemyPriority = this.getActionPriority(enemy, 'enemy');

    if (playerPriority !== enemyPriority) {
      return playerPriority > enemyPriority
        ? [{ ...player, battler: 'player' }, { ...enemy, battler: 'enemy' }]
        : [{ ...enemy, battler: 'enemy' }, { ...player, battler: 'player' }];
    }

    // Same priority - compare speed
    const playerSpeed = this.getEffectiveSpeed('player');
    const enemySpeed = this.getEffectiveSpeed('enemy');

    if (playerSpeed !== enemySpeed) {
      return playerSpeed > enemySpeed
        ? [{ ...player, battler: 'player' }, { ...enemy, battler: 'enemy' }]
        : [{ ...enemy, battler: 'enemy' }, { ...player, battler: 'player' }];
    }

    // Speed tie - random
    return Math.random() < 0.5
      ? [{ ...player, battler: 'player' }, { ...enemy, battler: 'enemy' }]
      : [{ ...enemy, battler: 'enemy' }, { ...player, battler: 'player' }];
  }

  private async executeAction(action: OrderedAction): Promise<void> {
    switch (action.type) {
      case 'move':
        await this.executeMove(action);
        break;
      case 'switch':
        await this.executeSwitch(action);
        break;
      case 'item':
        await this.useItem(action);
        break;
      case 'run':
        await this.attemptFlee(action);
        break;
    }
  }
}
```

## Damage Calculator

```tsx
// src/battle/engine/DamageCalculator.ts

export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: Move,
  battleState: BattleState
): DamageResult {
  // Base damage formula
  // ((2×Level/5+2) × Power × A/D / 50) + 2) × Modifiers

  const level = attacker.level;
  const power = getEffectivePower(move, attacker, defender, battleState);

  // Physical or Special?
  const isPhysical = isPhysicalType(move.type);
  const attackStat = isPhysical ? 'attack' : 'spAttack';
  const defenseStat = isPhysical ? 'defense' : 'spDefense';

  const A = getModifiedStat(attacker, attackStat);
  const D = getModifiedStat(defender, defenseStat);

  // Base calculation
  let damage = Math.floor((2 * level / 5 + 2) * power * A / D / 50) + 2;

  // Apply modifiers
  damage = applyModifiers(damage, {
    stab: hasSTAB(attacker, move),
    effectiveness: getTypeEffectiveness(move.type, defender.types),
    critical: rollCritical(move, attacker),
    weather: getWeatherModifier(move, battleState.weather),
    ability: getAbilityModifier(attacker.ability, move),
    item: getItemModifier(attacker.heldItem, move),
    random: 0.85 + Math.random() * 0.15, // 85-100%
  });

  return {
    damage: Math.max(1, Math.floor(damage)),
    effectiveness: getTypeEffectiveness(move.type, defender.types),
    critical: false, // Set by calculation
  };
}

function getModifiedStat(pokemon: BattlePokemon, stat: StatName): number {
  const base = pokemon.stats[stat];
  const stage = pokemon.statStages[stat];

  // Stage multipliers
  const multipliers = [2/8, 2/7, 2/6, 2/5, 2/4, 2/3, 2/2, 3/2, 4/2, 5/2, 6/2, 7/2, 8/2];
  const index = stage + 6; // -6 to +6 becomes 0 to 12

  return Math.floor(base * multipliers[index]);
}
```

## Type Chart

```tsx
// src/battle/engine/TypeChart.ts

// Type indices (same as GBA)
export const TYPE = {
  NORMAL: 0,
  FIGHTING: 1,
  FLYING: 2,
  POISON: 3,
  GROUND: 4,
  ROCK: 5,
  BUG: 6,
  GHOST: 7,
  STEEL: 8,
  MYSTERY: 9, // ???
  FIRE: 10,
  WATER: 11,
  GRASS: 12,
  ELECTRIC: 13,
  PSYCHIC: 14,
  ICE: 15,
  DRAGON: 16,
  DARK: 17,
} as const;

// Effectiveness multipliers
export const EFFECT = {
  IMMUNE: 0,
  NOT_VERY: 0.5,
  NORMAL: 1,
  SUPER: 2,
} as const;

// Type chart (attacker → defender)
const TYPE_CHART: Record<number, Record<number, number>> = {
  [TYPE.NORMAL]: {
    [TYPE.ROCK]: EFFECT.NOT_VERY,
    [TYPE.GHOST]: EFFECT.IMMUNE,
    [TYPE.STEEL]: EFFECT.NOT_VERY,
  },
  [TYPE.FIRE]: {
    [TYPE.FIRE]: EFFECT.NOT_VERY,
    [TYPE.WATER]: EFFECT.NOT_VERY,
    [TYPE.GRASS]: EFFECT.SUPER,
    [TYPE.ICE]: EFFECT.SUPER,
    [TYPE.BUG]: EFFECT.SUPER,
    [TYPE.ROCK]: EFFECT.NOT_VERY,
    [TYPE.DRAGON]: EFFECT.NOT_VERY,
    [TYPE.STEEL]: EFFECT.SUPER,
  },
  // ... complete chart
};

export function getTypeEffectiveness(
  attackType: number,
  defenderTypes: [number, number]
): number {
  let effectiveness = 1;

  for (const defType of defenderTypes) {
    if (defType === TYPE.MYSTERY) continue;

    const modifier = TYPE_CHART[attackType]?.[defType] ?? EFFECT.NORMAL;
    effectiveness *= modifier;
  }

  return effectiveness;
}
```

## Battle UI Components

```tsx
// src/battle/components/BattleScreen.tsx

interface BattleScreenProps {
  config: BattleConfig;
  onBattleEnd: (result: BattleResult) => void;
}

export function BattleScreen({ config, onBattleEnd }: BattleScreenProps) {
  const { state, dispatch, executeAction } = useBattle(config);

  return (
    <div className="battle-screen">
      <BattleBackground terrain={state.terrain} weather={state.weather} />

      <BattleField
        playerPokemon={state.player.activePokemon}
        enemyPokemon={state.enemy.activePokemon}
        animationState={state.animationState}
      />

      <div className="health-boxes">
        <HealthBox
          pokemon={state.enemy.activePokemon}
          isPlayer={false}
        />
        <HealthBox
          pokemon={state.player.activePokemon}
          isPlayer={true}
        />
      </div>

      <div className="bottom-panel">
        {state.phase === 'message' && (
          <MessageBox
            text={state.message}
            onComplete={() => dispatch({ type: 'MESSAGE_COMPLETE' })}
          />
        )}

        {state.phase === 'action_select' && (
          <ActionMenu
            onFight={() => dispatch({ type: 'SELECT_FIGHT' })}
            onBag={() => dispatch({ type: 'SELECT_BAG' })}
            onPokemon={() => dispatch({ type: 'SELECT_POKEMON' })}
            onRun={() => executeAction({ type: 'run' })}
            canRun={state.type !== 'trainer'}
          />
        )}

        {state.phase === 'move_select' && (
          <MoveMenu
            moves={state.player.activePokemon.moves}
            pp={state.player.activePokemon.pp}
            onSelect={(index) => executeAction({ type: 'move', moveIndex: index })}
            onCancel={() => dispatch({ type: 'CANCEL_MOVE_SELECT' })}
          />
        )}
      </div>
    </div>
  );
}
```

```tsx
// src/battle/components/HealthBox.tsx

interface HealthBoxProps {
  pokemon: BattlePokemon;
  isPlayer: boolean;
}

export function HealthBox({ pokemon, isPlayer }: HealthBoxProps) {
  const hpPercent = (pokemon.currentHp / pokemon.stats.hp) * 100;
  const hpColor = hpPercent > 50 ? 'green' : hpPercent > 20 ? 'yellow' : 'red';

  return (
    <div className={`health-box ${isPlayer ? 'player' : 'enemy'}`}>
      <div className="name-row">
        <span className="nickname">{pokemon.nickname}</span>
        <span className="level">Lv{pokemon.level}</span>
      </div>

      <div className="hp-bar">
        <span className="hp-label">HP</span>
        <div className="bar-container">
          <div
            className={`bar-fill ${hpColor}`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {isPlayer && (
        <div className="hp-numbers">
          {pokemon.currentHp} / {pokemon.stats.hp}
        </div>
      )}

      {pokemon.status && (
        <StatusIcon status={pokemon.status} />
      )}
    </div>
  );
}
```

## Battle Hook

```tsx
// src/battle/hooks/useBattle.ts

interface BattleActions {
  state: BattleState;
  dispatch: React.Dispatch<BattleAction>;
  executeAction: (action: TurnAction) => Promise<void>;
}

export function useBattle(config: BattleConfig): BattleActions {
  const [state, dispatch] = useReducer(battleReducer, config, initBattle);
  const engineRef = useRef<BattleEngine>();

  useEffect(() => {
    engineRef.current = new BattleEngine(config, (newState) => {
      dispatch({ type: 'UPDATE_STATE', state: newState });
    });
  }, [config]);

  const executeAction = useCallback(async (action: TurnAction) => {
    if (!engineRef.current) return;
    await engineRef.current.executeTurn(action);
  }, []);

  return { state, dispatch, executeAction };
}

function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'UPDATE_STATE':
      return action.state;
    case 'SELECT_FIGHT':
      return { ...state, phase: 'move_select' };
    case 'CANCEL_MOVE_SELECT':
      return { ...state, phase: 'action_select' };
    case 'MESSAGE_COMPLETE':
      return processMessageComplete(state);
    // ... more actions
  }
}
```

## Implementation Phases

### Phase 1: Core Battle Logic (No UI)
1. Type effectiveness calculation
2. Damage formula
3. Basic move execution (damaging moves)
4. HP tracking
5. Faint detection
6. Turn ordering by speed

### Phase 2: Basic UI
1. Battle screen layout
2. Health boxes (static)
3. Action menu
4. Move menu
5. Message display

### Phase 3: Animations
1. HP bar animations
2. Pokemon flash on damage
3. Basic move effects (CSS)
4. Faint animation

### Phase 4: Status Effects
1. Primary status (poison, burn, etc.)
2. Volatile status (confusion, etc.)
3. Status damage/effects per turn
4. Status icons

### Phase 5: Move Effects
1. Stat-changing moves
2. Status-inflicting moves
3. Multi-hit moves
4. Recoil moves
5. Priority moves

### Phase 6: Wild Battles
1. Wild encounter triggering
2. Flee calculation
3. Catch mechanics
4. Ball selection

### Phase 7: Trainer Battles
1. AI move selection
2. Trainer Pokemon switching
3. No flee/catch
4. Trainer messages

### Phase 8: Polish
1. Weather effects
2. Held items
3. Abilities (subset)
4. Sound effects
5. More animations

## Integration Points

### With Existing Map System

```tsx
// In MapRenderer or PlayerController
function handleGrassStep() {
  if (checkWildEncounter()) {
    const wildPokemon = generateWildPokemon(currentMap, grassType);
    onBattleStart({
      type: 'wild',
      opponent: wildPokemon,
    });
  }
}

function handleTrainerSpot(trainerId: number) {
  const trainer = getTrainerData(trainerId);
  onBattleStart({
    type: 'trainer',
    trainer,
    opponent: trainer.party,
  });
}
```

### With Save System

```tsx
// Battle result updates save data
function handleBattleEnd(result: BattleResult) {
  if (result.caught) {
    saveManager.addPokemon(result.caught);
  }
  if (result.victory) {
    saveManager.updateMoney(result.prize);
    saveManager.setTrainerDefeated(result.trainerId);
  }
  // Update party HP/PP/status
  saveManager.updateParty(result.partyState);
}
```

## Data Loading Strategy

```tsx
// Lazy load battle data
const battleData = {
  moves: null as MoveData[] | null,
  species: null as SpeciesData[] | null,
  typeChart: null as TypeChart | null,
};

export async function loadBattleData() {
  if (!battleData.moves) {
    battleData.moves = await import('../data/moves.json');
    battleData.species = await import('../data/species.json');
    battleData.typeChart = await import('../data/typeChart.json');
  }
  return battleData;
}
```

## Performance Considerations

1. **Memoize calculations**: Type effectiveness, stat modifiers
2. **Lazy sprite loading**: Load Pokemon sprites on battle start
3. **Animation pooling**: Reuse animation elements
4. **State batching**: Group state updates during turn execution
5. **Web Workers**: Consider for AI calculations

## Testing Strategy

```tsx
// Unit tests for core calculations
describe('DamageCalculator', () => {
  it('calculates base damage correctly', () => {
    const damage = calculateDamage(attacker, defender, thunderbolt, state);
    expect(damage.damage).toBeGreaterThan(0);
  });

  it('applies type effectiveness', () => {
    const damage = calculateDamage(pikachu, pidgey, thunderbolt, state);
    expect(damage.effectiveness).toBe(2); // Super effective
  });

  it('applies STAB bonus', () => {
    // Electric move from Electric Pokemon
    const withStab = calculateDamage(pikachu, target, thunderbolt, state);
    const withoutStab = calculateDamage(rattata, target, thunderbolt, state);
    expect(withStab.damage).toBeGreaterThan(withoutStab.damage);
  });
});
```

## Summary

This implementation plan follows React patterns already in use in the codebase:
- Component-based UI with TypeScript
- Hooks for state management
- Clean separation of engine logic and presentation
- Progressive enhancement from core mechanics to polish

The battle engine is designed to be testable independently of React, with UI components receiving state and dispatching actions.

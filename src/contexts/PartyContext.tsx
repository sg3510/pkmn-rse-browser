/**
 * Party Context
 *
 * Global state management for the player's Pokemon party.
 * Provides access to party data and actions throughout the app.
 */

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { PartyPokemon, PartyState } from '../pokemon/types';
import { PARTY_SIZE, createEmptyParty } from '../pokemon/types';

// ============================================================================
// Types
// ============================================================================

type PartyAction =
  | { type: 'SET_PARTY'; pokemon: (PartyPokemon | null)[] }
  | { type: 'ADD_POKEMON'; pokemon: PartyPokemon }
  | { type: 'REMOVE_POKEMON'; index: number }
  | { type: 'SWAP_POKEMON'; index1: number; index2: number }
  | { type: 'UPDATE_POKEMON'; index: number; pokemon: PartyPokemon }
  | { type: 'HEAL_ALL' }
  | { type: 'HEAL_POKEMON'; index: number }
  | { type: 'DAMAGE_POKEMON'; index: number; damage: number }
  | { type: 'SET_STATUS'; index: number; status: number }
  | { type: 'USE_PP'; index: number; moveIndex: number; amount: number }
  | { type: 'RESTORE_PP'; index: number; moveIndex: number; amount: number }
  | { type: 'CLEAR_PARTY' };

interface PartyContextValue {
  party: PartyState;
  dispatch: React.Dispatch<PartyAction>;
  // Helper methods
  addPokemon: (pokemon: PartyPokemon) => boolean;
  removePokemon: (index: number) => void;
  swapPokemon: (index1: number, index2: number) => void;
  updatePokemon: (index: number, pokemon: PartyPokemon) => void;
  healAll: () => void;
  healPokemon: (index: number) => void;
  damagePokemon: (index: number, damage: number) => void;
  setStatus: (index: number, status: number) => void;
  usePP: (index: number, moveIndex: number, amount?: number) => void;
  restorePP: (index: number, moveIndex: number, amount: number) => void;
  setParty: (pokemon: (PartyPokemon | null)[]) => void;
  clearParty: () => void;
  // Utility getters
  getPartyCount: () => number;
  getFirstConscious: () => number;
  isPartyFull: () => boolean;
  isPartyEmpty: () => boolean;
  hasConscious: () => boolean;
}

// ============================================================================
// Reducer
// ============================================================================

function partyReducer(state: PartyState, action: PartyAction): PartyState {
  switch (action.type) {
    case 'SET_PARTY': {
      const pokemon = action.pokemon.slice(0, PARTY_SIZE);
      // Pad to 6 slots
      while (pokemon.length < PARTY_SIZE) {
        pokemon.push(null);
      }
      return {
        pokemon,
        count: pokemon.filter(p => p !== null).length,
      };
    }

    case 'ADD_POKEMON': {
      // Find first empty slot
      const emptyIndex = state.pokemon.findIndex(p => p === null);
      if (emptyIndex === -1) {
        // Party is full
        return state;
      }
      const newPokemon = [...state.pokemon];
      newPokemon[emptyIndex] = action.pokemon;
      return {
        pokemon: newPokemon,
        count: state.count + 1,
      };
    }

    case 'REMOVE_POKEMON': {
      if (action.index < 0 || action.index >= PARTY_SIZE) return state;
      if (state.pokemon[action.index] === null) return state;

      // Compact the party (move all Pokemon up)
      const newPokemon: (PartyPokemon | null)[] = [];
      for (let i = 0; i < PARTY_SIZE; i++) {
        if (i !== action.index && state.pokemon[i] !== null) {
          newPokemon.push(state.pokemon[i]);
        }
      }
      // Pad with nulls
      while (newPokemon.length < PARTY_SIZE) {
        newPokemon.push(null);
      }
      return {
        pokemon: newPokemon,
        count: Math.max(0, state.count - 1),
      };
    }

    case 'SWAP_POKEMON': {
      const { index1, index2 } = action;
      if (index1 < 0 || index1 >= PARTY_SIZE) return state;
      if (index2 < 0 || index2 >= PARTY_SIZE) return state;
      if (index1 === index2) return state;

      const newPokemon = [...state.pokemon];
      [newPokemon[index1], newPokemon[index2]] = [newPokemon[index2], newPokemon[index1]];
      return {
        ...state,
        pokemon: newPokemon,
      };
    }

    case 'UPDATE_POKEMON': {
      if (action.index < 0 || action.index >= PARTY_SIZE) return state;
      const newPokemon = [...state.pokemon];
      newPokemon[action.index] = action.pokemon;
      return {
        pokemon: newPokemon,
        count: newPokemon.filter(p => p !== null).length,
      };
    }

    case 'HEAL_ALL': {
      const newPokemon = state.pokemon.map(p => {
        if (p === null) return null;
        return {
          ...p,
          status: 0,
          stats: {
            ...p.stats,
            hp: p.stats.maxHp,
          },
          // Restore all PP (simplified - would need move data for accurate max)
          pp: p.moves.map((moveId) => {
            if (moveId === 0) return 0;
            // Placeholder - real implementation would look up move's basePP and apply ppBonuses
            return 35; // Default max PP
          }) as [number, number, number, number],
        };
      });
      return {
        ...state,
        pokemon: newPokemon,
      };
    }

    case 'HEAL_POKEMON': {
      if (action.index < 0 || action.index >= PARTY_SIZE) return state;
      const pokemon = state.pokemon[action.index];
      if (pokemon === null) return state;

      const newPokemon = [...state.pokemon];
      newPokemon[action.index] = {
        ...pokemon,
        status: 0,
        stats: {
          ...pokemon.stats,
          hp: pokemon.stats.maxHp,
        },
      };
      return {
        ...state,
        pokemon: newPokemon,
      };
    }

    case 'DAMAGE_POKEMON': {
      if (action.index < 0 || action.index >= PARTY_SIZE) return state;
      const pokemon = state.pokemon[action.index];
      if (pokemon === null) return state;

      const newPokemon = [...state.pokemon];
      newPokemon[action.index] = {
        ...pokemon,
        stats: {
          ...pokemon.stats,
          hp: Math.max(0, pokemon.stats.hp - action.damage),
        },
      };
      return {
        ...state,
        pokemon: newPokemon,
      };
    }

    case 'SET_STATUS': {
      if (action.index < 0 || action.index >= PARTY_SIZE) return state;
      const pokemon = state.pokemon[action.index];
      if (pokemon === null) return state;

      const newPokemon = [...state.pokemon];
      newPokemon[action.index] = {
        ...pokemon,
        status: action.status,
      };
      return {
        ...state,
        pokemon: newPokemon,
      };
    }

    case 'USE_PP': {
      if (action.index < 0 || action.index >= PARTY_SIZE) return state;
      if (action.moveIndex < 0 || action.moveIndex >= 4) return state;
      const pokemon = state.pokemon[action.index];
      if (pokemon === null) return state;

      const newPP = [...pokemon.pp] as [number, number, number, number];
      newPP[action.moveIndex] = Math.max(0, newPP[action.moveIndex] - action.amount);

      const newPokemon = [...state.pokemon];
      newPokemon[action.index] = {
        ...pokemon,
        pp: newPP,
      };
      return {
        ...state,
        pokemon: newPokemon,
      };
    }

    case 'RESTORE_PP': {
      if (action.index < 0 || action.index >= PARTY_SIZE) return state;
      if (action.moveIndex < 0 || action.moveIndex >= 4) return state;
      const pokemon = state.pokemon[action.index];
      if (pokemon === null) return state;

      const newPP = [...pokemon.pp] as [number, number, number, number];
      // Would need move data for accurate max PP
      newPP[action.moveIndex] = Math.min(99, newPP[action.moveIndex] + action.amount);

      const newPokemon = [...state.pokemon];
      newPokemon[action.index] = {
        ...pokemon,
        pp: newPP,
      };
      return {
        ...state,
        pokemon: newPokemon,
      };
    }

    case 'CLEAR_PARTY': {
      return createEmptyParty();
    }

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const PartyContext = createContext<PartyContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface PartyProviderProps {
  children: ReactNode;
  initialParty?: PartyState;
}

export function PartyProvider({ children, initialParty }: PartyProviderProps) {
  const [party, dispatch] = useReducer(partyReducer, initialParty ?? createEmptyParty());

  // Helper methods
  const addPokemon = useCallback((pokemon: PartyPokemon): boolean => {
    const hasSpace = party.count < PARTY_SIZE;
    if (hasSpace) {
      dispatch({ type: 'ADD_POKEMON', pokemon });
    }
    return hasSpace;
  }, [party.count]);

  const removePokemon = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_POKEMON', index });
  }, []);

  const swapPokemon = useCallback((index1: number, index2: number) => {
    dispatch({ type: 'SWAP_POKEMON', index1, index2 });
  }, []);

  const updatePokemon = useCallback((index: number, pokemon: PartyPokemon) => {
    dispatch({ type: 'UPDATE_POKEMON', index, pokemon });
  }, []);

  const healAll = useCallback(() => {
    dispatch({ type: 'HEAL_ALL' });
  }, []);

  const healPokemon = useCallback((index: number) => {
    dispatch({ type: 'HEAL_POKEMON', index });
  }, []);

  const damagePokemon = useCallback((index: number, damage: number) => {
    dispatch({ type: 'DAMAGE_POKEMON', index, damage });
  }, []);

  const setStatus = useCallback((index: number, status: number) => {
    dispatch({ type: 'SET_STATUS', index, status });
  }, []);

  const usePP = useCallback((index: number, moveIndex: number, amount = 1) => {
    dispatch({ type: 'USE_PP', index, moveIndex, amount });
  }, []);

  const restorePP = useCallback((index: number, moveIndex: number, amount: number) => {
    dispatch({ type: 'RESTORE_PP', index, moveIndex, amount });
  }, []);

  const setParty = useCallback((pokemon: (PartyPokemon | null)[]) => {
    dispatch({ type: 'SET_PARTY', pokemon });
  }, []);

  const clearParty = useCallback(() => {
    dispatch({ type: 'CLEAR_PARTY' });
  }, []);

  // Utility getters
  const getPartyCount = useCallback(() => party.count, [party.count]);

  const getFirstConscious = useCallback(() => {
    return party.pokemon.findIndex(p => p !== null && p.stats.hp > 0);
  }, [party.pokemon]);

  const isPartyFull = useCallback(() => party.count >= PARTY_SIZE, [party.count]);

  const isPartyEmpty = useCallback(() => party.count === 0, [party.count]);

  const hasConscious = useCallback(() => {
    return party.pokemon.some(p => p !== null && p.stats.hp > 0);
  }, [party.pokemon]);

  const value: PartyContextValue = {
    party,
    dispatch,
    addPokemon,
    removePokemon,
    swapPokemon,
    updatePokemon,
    healAll,
    healPokemon,
    damagePokemon,
    setStatus,
    usePP,
    restorePP,
    setParty,
    clearParty,
    getPartyCount,
    getFirstConscious,
    isPartyFull,
    isPartyEmpty,
    hasConscious,
  };

  return (
    <PartyContext.Provider value={value}>
      {children}
    </PartyContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useParty(): PartyContextValue {
  const context = useContext(PartyContext);
  if (!context) {
    throw new Error('useParty must be used within a PartyProvider');
  }
  return context;
}

// Optional hook that returns null instead of throwing
export function usePartyOptional(): PartyContextValue | null {
  return useContext(PartyContext);
}

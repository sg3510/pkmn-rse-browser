/**
 * Party Menu Content
 *
 * Displays the 2x3 Pokemon party grid.
 * Embedded component without its own overlay - rendered inside MenuOverlay.
 * Clicking a Pokemon navigates to pokemonSummary via MenuStateManager.
 */

import { useCallback, useState, useEffect, useMemo } from 'react';
import { useMenuState, useMenuInput } from '../hooks/useMenuState';
import {
  getMenuDataFor,
  menuStateManager,
  type BattlePartyMenuOpenData,
  type FieldItemPartyMenuOpenData,
} from '../MenuStateManager';
import { navigateGrid } from '../types';
import { usePartyOptional } from '../../contexts/PartyContext';
import { PartySlot } from './PartySlot';
import { createTestParty } from '../../pokemon/testFactory';
import { saveManager } from '../../save/SaveManager';
import type { PartyPokemon } from '../../pokemon/types';
import '../styles/party-menu-content.css';

type PartyMode = 'select' | 'swap';

function isBattlePartyMenuData(data: unknown): data is BattlePartyMenuOpenData {
  return Boolean(data && typeof data === 'object' && 'mode' in data && (data as { mode?: unknown }).mode === 'battle');
}

function isFieldItemPartyMenuData(data: unknown): data is FieldItemPartyMenuOpenData {
  return Boolean(data && typeof data === 'object' && 'mode' in data && (data as { mode?: unknown }).mode === 'fieldItemUse');
}

export function PartyMenuContent() {
  const { cursorIndex, isOpen, currentMenu, data } = useMenuState();
  const partyContext = usePartyOptional();

  // Local state for modes
  const [mode, setMode] = useState<PartyMode>('select');
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);

  // Get party - priority: SaveManager > PartyContext > test data
  const [localParty, setLocalParty] = useState<(PartyPokemon | null)[]>([]);

  useEffect(() => {
    // Try to get party from SaveManager first (has imported .sav data)
    const saveParty = saveManager.getParty();
    if (saveParty.some(p => p !== null)) {
      setLocalParty(saveParty);
      return;
    }

    // Fall back to PartyContext if available
    if (partyContext && partyContext.party.count > 0) {
      setLocalParty(partyContext.party.pokemon);
      return;
    }

    // Fall back to test data for development
    const testPokemon = createTestParty();
    while (testPokemon.length < 6) {
      testPokemon.push(null as unknown as PartyPokemon);
    }
    setLocalParty(testPokemon);
  }, [partyContext, isOpen]);

  const party = localParty;
  const partyCount = party.filter(p => p !== null).length;
  const partyData = getMenuDataFor({ currentMenu, data }, 'party') ?? {};
  const battleData = isBattlePartyMenuData(partyData) ? partyData : null;
  const fieldData = isFieldItemPartyMenuData(partyData) ? partyData : null;
  const battleMode = battleData !== null;
  const fieldItemMode = fieldData !== null;
  const activePartyIndex = typeof battleData?.activePartyIndex === 'number' ? battleData.activePartyIndex : 0;
  const selectionReason = battleData?.selectionReason ?? 'manualSwitch';
  const allowBattleCancel = battleData?.allowCancel ?? true;
  const initialCursorIndex = battleData?.initialCursorIndex;
  const blockedPartyIndexes = battleData?.blockedPartyIndexes ?? [];
  const blockedSet = useMemo(() => new Set(blockedPartyIndexes), [blockedPartyIndexes]);
  const onBattlePartySelected = battleData?.onBattlePartySelected;
  const onFieldPartySelected = fieldData?.onFieldPartySelected;

  // Reset mode when menu opens
  useEffect(() => {
    if (isOpen && currentMenu === 'party') {
      setMode('select');
      setSwapSourceIndex(null);
    }
  }, [isOpen, currentMenu]);

  useEffect(() => {
    if (!isOpen || currentMenu !== 'party' || !battleMode) {
      return;
    }
    if (typeof initialCursorIndex === 'number') {
      menuStateManager.setCursor(Math.max(0, Math.min(5, initialCursorIndex)));
    }
  }, [isOpen, currentMenu, battleMode, initialCursorIndex]);

  const confirmAtIndex = useCallback((index: number) => {
    const pokemon = party[index];
    const liveParty = saveManager.getParty();
    const livePokemon = liveParty[index];

    if (mode === 'select') {
      if (battleMode) {
        if (
          !livePokemon
          || blockedSet.has(index)
          || index === activePartyIndex
          || livePokemon.stats.hp <= 0
        ) {
          return;
        }
        onBattlePartySelected?.(index);
        menuStateManager.resolveAsync(index);
        return;
      }
      if (fieldItemMode) {
        if (!livePokemon) {
          return;
        }
        onFieldPartySelected?.(index);
        menuStateManager.resolveAsync(index);
        return;
      }

      if (pokemon) {
        // Navigate to summary screen via MenuStateManager
        menuStateManager.open('pokemonSummary', {
          pokemon,
          partyIndex: index,
        });
      }
    } else if (mode === 'swap') {
      if (swapSourceIndex !== null && swapSourceIndex !== index) {
        // Perform swap in local state
        const newParty = [...localParty];
        [newParty[swapSourceIndex], newParty[index]] =
          [newParty[index], newParty[swapSourceIndex]];
        setLocalParty(newParty);

        // Also update SaveManager if it has the party
        if (saveManager.hasParty()) {
          saveManager.setParty(newParty);
        }
        // Also update PartyContext if available
        if (partyContext) {
          partyContext.swapPokemon(swapSourceIndex, index);
        }
      }
      setMode('select');
      setSwapSourceIndex(null);
    }
  }, [
    mode,
    swapSourceIndex,
    party,
    partyContext,
    localParty,
    battleMode,
    fieldItemMode,
    blockedSet,
    activePartyIndex,
    onBattlePartySelected,
    onFieldPartySelected,
  ]);

  // Handlers
  const handleConfirm = useCallback(() => {
    confirmAtIndex(cursorIndex);
  }, [confirmAtIndex, cursorIndex]);

  const handleCancel = useCallback(() => {
    if (mode === 'swap') {
      // Cancel swap mode
      setMode('select');
      setSwapSourceIndex(null);
    } else if (battleMode) {
      if (!allowBattleCancel) {
        return;
      }
      onBattlePartySelected?.(null);
      menuStateManager.resolveAsync(null);
    } else if (fieldItemMode) {
      onFieldPartySelected?.(null);
      menuStateManager.resolveAsync(null);
    } else {
      // Go back via MenuStateManager
      menuStateManager.back();
    }
  }, [mode, battleMode, fieldItemMode, allowBattleCancel, onBattlePartySelected, onFieldPartySelected]);

  const handleSelect = useCallback(() => {
    if (battleMode || fieldItemMode || mode === 'swap') {
      return;
    }
    if (!party[cursorIndex]) {
      return;
    }
    setMode('swap');
    setSwapSourceIndex(cursorIndex);
  }, [battleMode, fieldItemMode, mode, party, cursorIndex]);

  const handleUp = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'up', 2, 6);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex]);

  const handleDown = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'down', 2, 6);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex]);

  const handleLeft = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'left', 2, 6);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex]);

  const handleRight = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'right', 2, 6);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex]);

  // Input handling
  useMenuInput({
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    onSelect: handleSelect,
    onUp: handleUp,
    onDown: handleDown,
    onLeft: handleLeft,
    onRight: handleRight,
    enabled: isOpen && currentMenu === 'party',
  });

  return (
    <div className="party-content">
      {/* Header */}
      <div className="party-header">
        <h2 className="party-title">
          {mode === 'swap' ? 'Move to where?' : 'POKéMON'}
        </h2>
      </div>

      {/* Party Grid */}
      <div className="party-grid">
        {party.map((pokemon, index) => (
          <PartySlot
            key={index}
            pokemon={pokemon}
            index={index}
            isSelected={cursorIndex === index}
            isSwapTarget={mode === 'swap' && swapSourceIndex === index}
            onClick={() => {
              menuStateManager.setCursor(index);
              confirmAtIndex(index);
            }}
            onMouseEnter={() => {
              menuStateManager.setCursor(index);
            }}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="party-footer">
        {mode === 'swap' ? (
          <span className="party-hint">Select slot or B: Cancel</span>
        ) : (
          <span className="party-hint">
            {partyCount === 0 ? 'No POKéMON' : (
              battleMode
                ? (selectionReason === 'forcedFaint'
                  ? 'A: Send Out'
                  : `A: Switch  ${allowBattleCancel ? 'B: Cancel' : ''}`.trim())
                : fieldItemMode
                  ? 'A: Use  B: Cancel'
                  : 'A: View  SELECT: Swap  B: Back'
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export default PartyMenuContent;

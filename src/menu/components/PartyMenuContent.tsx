/**
 * Party Menu Content
 *
 * Displays the 2x3 Pokemon party grid.
 * Embedded component without its own overlay - rendered inside MenuOverlay.
 * Clicking a Pokemon navigates to pokemonSummary via MenuStateManager.
 */

import { useCallback, useState, useEffect } from 'react';
import { useMenuState, useMenuInput } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import { navigateGrid } from '../types';
import { usePartyOptional } from '../../contexts/PartyContext';
import { PartySlot } from './PartySlot';
import { createTestParty } from '../../pokemon/testFactory';
import { saveManager } from '../../save/SaveManager';
import type { PartyPokemon } from '../../pokemon/types';
import '../styles/party-menu-content.css';

type PartyMode = 'select' | 'swap';

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
  const battleMode = data.mode === 'battle';
  const fieldItemMode = data.mode === 'fieldItemUse';
  const activePartyIndex = typeof data.activePartyIndex === 'number' ? data.activePartyIndex : 0;
  const onBattlePartySelected = data.onBattlePartySelected as ((partyIndex: number | null) => void) | undefined;
  const onFieldPartySelected = data.onFieldPartySelected as ((partyIndex: number | null) => void) | undefined;

  // Reset mode when menu opens
  useEffect(() => {
    if (isOpen && currentMenu === 'party') {
      setMode('select');
      setSwapSourceIndex(null);
    }
  }, [isOpen, currentMenu]);

  // Handlers
  const handleConfirm = useCallback(() => {
    const pokemon = party[cursorIndex];

    if (mode === 'select') {
      if (pokemon) {
        if (battleMode) {
          if (cursorIndex === activePartyIndex || pokemon.stats.hp <= 0) {
            return;
          }
          onBattlePartySelected?.(cursorIndex);
          menuStateManager.close();
          return;
        }
        if (fieldItemMode) {
          onFieldPartySelected?.(cursorIndex);
          menuStateManager.close();
          return;
        }

        // Navigate to summary screen via MenuStateManager
        menuStateManager.open('pokemonSummary', {
          pokemon,
          partyIndex: cursorIndex,
        });
      }
    } else if (mode === 'swap') {
      if (swapSourceIndex !== null && swapSourceIndex !== cursorIndex) {
        // Perform swap in local state
        const newParty = [...localParty];
        [newParty[swapSourceIndex], newParty[cursorIndex]] =
          [newParty[cursorIndex], newParty[swapSourceIndex]];
        setLocalParty(newParty);

        // Also update SaveManager if it has the party
        if (saveManager.hasParty()) {
          saveManager.setParty(newParty);
        }
        // Also update PartyContext if available
        if (partyContext) {
          partyContext.swapPokemon(swapSourceIndex, cursorIndex);
        }
      }
      setMode('select');
      setSwapSourceIndex(null);
    }
  }, [
    mode,
    cursorIndex,
    swapSourceIndex,
    party,
    partyContext,
    localParty,
    battleMode,
    fieldItemMode,
    activePartyIndex,
    onBattlePartySelected,
    onFieldPartySelected,
  ]);

  const handleCancel = useCallback(() => {
    if (mode === 'swap') {
      // Cancel swap mode
      setMode('select');
      setSwapSourceIndex(null);
    } else if (battleMode) {
      onBattlePartySelected?.(null);
      menuStateManager.close();
    } else if (fieldItemMode) {
      onFieldPartySelected?.(null);
      menuStateManager.close();
    } else {
      // Go back via MenuStateManager
      menuStateManager.back();
    }
  }, [mode, battleMode, fieldItemMode, onBattlePartySelected, onFieldPartySelected]);

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
              handleConfirm();
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
                ? 'A: Switch  B: Cancel'
                : fieldItemMode
                  ? 'A: Use  B: Cancel'
                  : 'A: View  B: Back'
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export default PartyMenuContent;

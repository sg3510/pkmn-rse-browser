/**
 * Party Menu Component
 *
 * 2x3 grid displaying the player's Pokemon party.
 * Supports selection, swap mode, and navigation to Pokemon summary.
 */

import { useCallback, useState, useEffect } from 'react';
import { useMenuState, useMenuInput } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import { navigateGrid } from '../types';
import { usePartyOptional } from '../../contexts/PartyContext';
import { PartySlot } from './PartySlot';
import { PokemonSummary } from './PokemonSummary';
import { createTestParty } from '../../pokemon/testFactory';
import { saveManager } from '../../save/SaveManager';
import type { PartyPokemon } from '../../pokemon/types';
import '../styles/party-menu.css';

interface PartyMenuProps {
  zoom?: number;
}

type PartyMode = 'select' | 'swap' | 'submenu';

export function PartyMenu({ zoom = 1 }: PartyMenuProps) {
  const { cursorIndex, isOpen, currentMenu } = useMenuState();
  const partyContext = usePartyOptional();

  // Local state for modes
  const [mode, setMode] = useState<PartyMode>('select');
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);
  const [summaryPokemon, setSummaryPokemon] = useState<PartyPokemon | null>(null);

  // Get party - priority: SaveManager > PartyContext > test data
  const [localParty, setLocalParty] = useState<(PartyPokemon | null)[]>([]);

  useEffect(() => {
    // Try to get party from SaveManager first (has imported .sav data)
    const saveParty = saveManager.getParty();
    if (saveParty.some(p => p !== null)) {
      setLocalParty(saveParty);
      console.log('[PartyMenu] Using party from SaveManager');
      return;
    }

    // Fall back to PartyContext if available
    if (partyContext && partyContext.party.count > 0) {
      setLocalParty(partyContext.party.pokemon);
      console.log('[PartyMenu] Using party from PartyContext');
      return;
    }

    // Fall back to test data for development
    const testPokemon = createTestParty();
    while (testPokemon.length < 6) {
      testPokemon.push(null as unknown as PartyPokemon);
    }
    setLocalParty(testPokemon);
    console.log('[PartyMenu] Using test party data');
  }, [partyContext, isOpen]);

  const party = localParty;
  const partyCount = party.filter(p => p !== null).length;

  // Reset mode when menu opens
  useEffect(() => {
    if (isOpen && currentMenu === 'party') {
      setMode('select');
      setSwapSourceIndex(null);
      setSummaryPokemon(null);
    }
  }, [isOpen, currentMenu]);

  // Handlers
  const handleConfirm = useCallback(() => {
    const pokemon = party[cursorIndex];

    if (mode === 'select') {
      if (pokemon) {
        // Open summary screen
        console.log('[PartyMenu] Opening summary for:', cursorIndex, pokemon.species);
        setSummaryPokemon(pokemon);
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

        console.log('[PartyMenu] Swapped:', swapSourceIndex, '<->', cursorIndex);
      }
      setMode('select');
      setSwapSourceIndex(null);
    }
  }, [mode, cursorIndex, swapSourceIndex, party, partyContext, localParty]);

  const handleCancel = useCallback(() => {
    if (summaryPokemon) {
      // Close summary
      setSummaryPokemon(null);
    } else if (mode === 'swap') {
      // Cancel swap mode
      setMode('select');
      setSwapSourceIndex(null);
    } else {
      // Close menu
      menuStateManager.back();
    }
  }, [mode, summaryPokemon]);

  const handleCloseSummary = useCallback(() => {
    setSummaryPokemon(null);
  }, []);

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

  // Input handling (disabled when summary is open)
  useMenuInput({
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    onUp: handleUp,
    onDown: handleDown,
    onLeft: handleLeft,
    onRight: handleRight,
    enabled: isOpen && currentMenu === 'party' && !summaryPokemon,
  });

  if (!isOpen || currentMenu !== 'party') {
    return null;
  }

  return (
    <div className="party-menu-overlay" onClick={handleCancel}>
      <div
        className="party-menu-container"
        style={{ transform: `scale(${zoom})` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="party-menu-header">
          <h2 className="party-menu-title">
            {mode === 'swap' ? 'Move to where?' : 'Choose a POKéMON.'}
          </h2>
        </div>

        {/* Party Grid */}
        <div className="party-menu-grid">
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
        <div className="party-menu-footer">
          {mode === 'swap' ? (
            <span className="party-menu-hint">
              Select destination or press B to cancel
            </span>
          ) : (
            <span className="party-menu-hint">
              {partyCount === 0
                ? 'No POKéMON in party'
                : 'A: Select  B: Back'}
            </span>
          )}
        </div>

        {/* Cancel button */}
        <button
          className="party-menu-cancel-btn"
          onClick={handleCancel}
        >
          ✕
        </button>
      </div>

      {/* Pokemon Summary overlay */}
      {summaryPokemon && (
        <PokemonSummary
          pokemon={summaryPokemon}
          onClose={handleCloseSummary}
          zoom={zoom}
        />
      )}
    </div>
  );
}

export default PartyMenu;

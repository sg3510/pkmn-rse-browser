/**
 * Party Slot Component
 *
 * Displays a single Pokemon slot in the party menu.
 * Shows icon, name, level, HP bar, gender, status, and held item.
 * Uses CSS classes from party-menu-content.css (design system).
 */

import type { PartyPokemon } from '../../pokemon/types';
import { STATUS } from '../../pokemon/types';
import { getSpeciesName, getPokemonIconPath } from '../../data/species';
import { getSpeciesInfo } from '../../data/speciesInfo';
import { getGenderFromPersonality } from '../../pokemon/stats';
import { formatLevel } from '../../pokemon/icons';
import { HPBar } from './HPBar';

export interface PartySlotProps {
  pokemon: PartyPokemon | null;
  index: number;
  isSelected: boolean;
  isSwapTarget?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

/**
 * Get status condition name for display
 */
function getStatusName(status: number): string | null {
  if (status === 0) return null;
  if ((status & 0x07) !== 0) return 'SLP';
  if (status & STATUS.POISON) return 'PSN';
  if (status & STATUS.BURN) return 'BRN';
  if (status & STATUS.FREEZE) return 'FRZ';
  if (status & STATUS.PARALYSIS) return 'PAR';
  if (status & STATUS.TOXIC) return 'PSN';
  return null;
}

/**
 * Get status CSS class for color
 */
function getStatusClass(status: number): string {
  if ((status & 0x07) !== 0) return 'status-slp';
  if (status & STATUS.POISON) return 'status-psn';
  if (status & STATUS.BURN) return 'status-brn';
  if (status & STATUS.FREEZE) return 'status-frz';
  if (status & STATUS.PARALYSIS) return 'status-par';
  if (status & STATUS.TOXIC) return 'status-psn';
  return '';
}

export function PartySlot({
  pokemon,
  index: _index,
  isSelected,
  isSwapTarget = false,
  onClick,
  onMouseEnter,
}: PartySlotProps) {
  void _index;

  // Empty slot
  if (!pokemon) {
    return (
      <div
        className={`party-slot empty ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
      >
        <span className="party-slot-empty-text">Empty</span>
      </div>
    );
  }

  const displayName = pokemon.nickname || getSpeciesName(pokemon.species);
  const iconPath = getPokemonIconPath(pokemon.species);
  const info = getSpeciesInfo(pokemon.species);
  const gender = info ? getGenderFromPersonality(pokemon.personality, info.genderRatio) : 'genderless';
  const genderSymbol = gender === 'male' ? '♂' : gender === 'female' ? '♀' : '';
  const statusName = getStatusName(pokemon.status);
  const statusClass = getStatusClass(pokemon.status);
  const isFainted = pokemon.stats.hp === 0;

  const slotClasses = [
    'party-slot',
    isSelected && 'selected',
    isSwapTarget && 'swap-target',
    isFainted && 'fainted',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={slotClasses}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Pokemon Icon */}
      <div className="party-slot-icon-container">
        <div
          className={`party-slot-icon ${isFainted ? 'fainted' : ''}`}
          style={{ backgroundImage: `url(${iconPath})` }}
        />
        {pokemon.heldItem > 0 && (
          <div className="party-slot-item-indicator" title="Holding item">
            ●
          </div>
        )}
      </div>

      {/* Pokemon Info */}
      <div className="party-slot-info">
        {/* Name row */}
        <div className="party-slot-name-row">
          <span className="party-slot-name">{displayName}</span>
          {genderSymbol && (
            <span className={`party-slot-gender ${gender}`}>
              {genderSymbol}
            </span>
          )}
        </div>

        {/* Level and Status */}
        <div className="party-slot-level-row">
          <span className="party-slot-level">{formatLevel(pokemon.level)}</span>
          {statusName && (
            <span className={`party-slot-status ${statusClass}`}>
              {statusName}
            </span>
          )}
        </div>

        {/* HP Bar */}
        <div className="party-slot-hp">
          <HPBar
            currentHP={pokemon.stats.hp}
            maxHP={pokemon.stats.maxHp}
          />
        </div>
      </div>
    </div>
  );
}

export default PartySlot;

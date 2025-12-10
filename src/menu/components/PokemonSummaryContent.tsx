/**
 * Pokemon Summary Content
 *
 * Multi-page display showing Pokemon details.
 * Embedded component without its own overlay - rendered inside MenuOverlay.
 *
 * Pages:
 * - INFO: Sprite, species, nature, ability, OT
 * - STATS: Stat bars, EXP progress
 * - MOVES: 4 moves with type, PP, power, accuracy
 */

import { useState, useCallback, useEffect } from 'react';
import { useMenuState, useMenuInput } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import type { PartyPokemon } from '../../pokemon/types';
import { getSpeciesName } from '../../data/species';
import { getSpeciesInfo } from '../../data/speciesInfo';
import { getNatureName, getNatureStatEffect } from '../../data/natures';
import { ABILITY_NAMES } from '../../data/abilities';
import { MOVE_NAMES, getMoveInfo } from '../../data/moves';
import { getGenderFromPersonality, getExpProgress, getExpToNextLevel } from '../../pokemon/stats';
import { getTypeColor, getGenderColor } from '../../pokemon/icons';
import '../styles/pokemon-summary-content.css';

type SummaryPage = 'info' | 'stats' | 'moves';

interface PokemonSummaryContentProps {
  pokemon: PartyPokemon;
  partyIndex?: number;
}

export function PokemonSummaryContent({ pokemon, partyIndex: _partyIndex }: PokemonSummaryContentProps) {
  void _partyIndex; // Reserved for party navigation

  const { isOpen, currentMenu } = useMenuState();
  const [currentPage, setCurrentPage] = useState<SummaryPage>('info');
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(0);

  const pages: SummaryPage[] = ['info', 'stats', 'moves'];
  const pageIndex = pages.indexOf(currentPage);

  // Navigation handlers
  const handleLeft = useCallback(() => {
    const newIndex = (pageIndex - 1 + pages.length) % pages.length;
    setCurrentPage(pages[newIndex]);
  }, [pageIndex, pages]);

  const handleRight = useCallback(() => {
    const newIndex = (pageIndex + 1) % pages.length;
    setCurrentPage(pages[newIndex]);
  }, [pageIndex, pages]);

  const handleUp = useCallback(() => {
    if (currentPage === 'moves') {
      setSelectedMoveIndex(i => Math.max(0, i - 1));
    }
  }, [currentPage]);

  const handleDown = useCallback(() => {
    if (currentPage === 'moves') {
      setSelectedMoveIndex(i => Math.min(3, i + 1));
    }
  }, [currentPage]);

  const handleCancel = useCallback(() => {
    menuStateManager.back();
  }, []);

  // Reset move selection when page changes
  useEffect(() => {
    if (currentPage !== 'moves') {
      setSelectedMoveIndex(0);
    }
  }, [currentPage]);

  // Input handling
  useMenuInput({
    onLeft: handleLeft,
    onRight: handleRight,
    onUp: handleUp,
    onDown: handleDown,
    onCancel: handleCancel,
    enabled: isOpen && currentMenu === 'pokemonSummary',
  });

  // Get Pokemon info
  const speciesInfo = getSpeciesInfo(pokemon.species);
  const speciesName = getSpeciesName(pokemon.species);
  const displayName = pokemon.nickname || speciesName;
  const gender = speciesInfo ? getGenderFromPersonality(pokemon.personality, speciesInfo.genderRatio) : 'genderless';
  const genderSymbol = gender === 'male' ? '♂' : gender === 'female' ? '♀' : '';
  const natureId = pokemon.personality % 25;
  const natureName = getNatureName(natureId);
  const abilityIndexRaw = speciesInfo?.abilities[pokemon.abilityNum as 0 | 1] ?? 0;
  const abilityIndex = typeof abilityIndexRaw === 'string' ? parseInt(abilityIndexRaw, 10) : abilityIndexRaw;
  const abilityName = ABILITY_NAMES[abilityIndex as keyof typeof ABILITY_NAMES] || 'Unknown';
  const types = speciesInfo?.types || ['NORMAL', 'NORMAL'];
  const uniqueTypes = types[0] === types[1] ? [types[0]] : types;

  // Sprite path
  const iconFolder = speciesName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const spritePath = `/pokeemerald/graphics/pokemon/${iconFolder}/front.png`;

  return (
    <div className="summary-content-wrapper">
      {/* Page tabs */}
      <div className="summary-tabs-bar">
        {pages.map((page) => (
          <button
            key={page}
            className={`summary-tab-btn ${currentPage === page ? 'active' : ''}`}
            onClick={() => setCurrentPage(page)}
          >
            {page.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Pokemon identity bar */}
      <div className="summary-identity-bar">
        <span className="summary-poke-name">{displayName}</span>
        {genderSymbol && (
          <span className="summary-poke-gender" style={{ color: getGenderColor(gender) }}>
            {genderSymbol}
          </span>
        )}
        <span className="summary-poke-level">Lv.{pokemon.level}</span>
        <div className="summary-type-list">
          {uniqueTypes.map(type => (
            <span
              key={type}
              className="summary-type-tag"
              style={{ backgroundColor: getTypeColor(type) }}
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="summary-page-content">
        {currentPage === 'info' && (
          <InfoPage
            pokemon={pokemon}
            speciesName={speciesName}
            natureName={natureName}
            abilityName={abilityName}
            spritePath={spritePath}
          />
        )}
        {currentPage === 'stats' && (
          <StatsPage
            pokemon={pokemon}
            speciesInfo={speciesInfo}
            natureId={natureId}
          />
        )}
        {currentPage === 'moves' && (
          <MovesPage
            pokemon={pokemon}
            selectedIndex={selectedMoveIndex}
            onSelectMove={setSelectedMoveIndex}
          />
        )}
      </div>

      {/* Page indicator dots */}
      <div className="summary-dots">
        {pages.map((page) => (
          <span
            key={page}
            className={`summary-dot-item ${currentPage === page ? 'active' : ''}`}
          />
        ))}
      </div>

      {/* Navigation hint */}
      <div className="summary-nav-hint">
        ◄ ► Page | B: Back
      </div>
    </div>
  );
}

// ============================================================================
// INFO Page
// ============================================================================

interface InfoPageProps {
  pokemon: PartyPokemon;
  speciesName: string;
  natureName: string;
  abilityName: string;
  spritePath: string;
}

function InfoPage({ pokemon, speciesName, natureName, abilityName, spritePath }: InfoPageProps) {
  return (
    <div className="info-page">
      {/* Pokemon sprite */}
      <div className="info-sprite-box">
        <img
          src={spritePath}
          alt={speciesName}
          className="info-sprite-img"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `/pokeemerald/graphics/pokemon/egg/front.png`;
          }}
        />
      </div>

      {/* Info details */}
      <div className="info-details">
        <div className="info-row">
          <span className="info-label">Species</span>
          <span className="info-value">{speciesName}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Nature</span>
          <span className="info-value">{natureName}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Ability</span>
          <span className="info-value">{abilityName}</span>
        </div>
        <div className="info-row">
          <span className="info-label">OT</span>
          <span className="info-value">{pokemon.otName}</span>
        </div>
        <div className="info-row">
          <span className="info-label">ID No.</span>
          <span className="info-value">{String(pokemon.otId & 0xFFFF).padStart(5, '0')}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Item</span>
          <span className="info-value">{pokemon.heldItem > 0 ? `Item #${pokemon.heldItem}` : 'None'}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STATS Page
// ============================================================================

interface StatsPageProps {
  pokemon: PartyPokemon;
  speciesInfo: ReturnType<typeof getSpeciesInfo>;
  natureId: number;
}

function StatsPage({ pokemon, speciesInfo, natureId }: StatsPageProps) {
  const stats = [
    { name: 'HP', value: pokemon.stats.maxHp, index: -1 },
    { name: 'ATK', value: pokemon.stats.attack, index: 0 },
    { name: 'DEF', value: pokemon.stats.defense, index: 1 },
    { name: 'SPA', value: pokemon.stats.spAttack, index: 3 },
    { name: 'SPD', value: pokemon.stats.spDefense, index: 4 },
    { name: 'SPE', value: pokemon.stats.speed, index: 2 },
  ];

  const growthRate = speciesInfo?.growthRate || 'MEDIUM_FAST';
  const expProgress = getExpProgress(growthRate, pokemon.level, pokemon.experience);
  const expToNext = getExpToNextLevel(growthRate, pokemon.level, pokemon.experience);

  return (
    <div className="stats-page">
      {/* Stat bars */}
      <div className="stats-list">
        {stats.map(stat => {
          const natureEffect = stat.index >= 0 ? getNatureStatEffect(natureId, stat.index) : 0;
          const maxStat = 400;
          const barWidth = Math.min(100, (stat.value / maxStat) * 100);

          return (
            <div key={stat.name} className="stat-row">
              <span className={`stat-name ${
                natureEffect > 0 ? 'nature-up' : natureEffect < 0 ? 'nature-down' : ''
              }`}>
                {stat.name}
              </span>
              <div className="stat-bar-bg">
                <div className="stat-bar-fill" style={{ width: `${barWidth}%` }} />
              </div>
              <span className="stat-val">{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* EXP bar */}
      <div className="exp-section">
        <div className="exp-row">
          <span className="exp-label">EXP</span>
          <span className="exp-value">{pokemon.experience.toLocaleString()}</span>
        </div>
        <div className="exp-row">
          <span className="exp-label">Next</span>
          <span className="exp-value">{expToNext.toLocaleString()}</span>
        </div>
        <div className="exp-bar-bg">
          <div className="exp-bar-fill" style={{ width: `${expProgress}%` }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MOVES Page
// ============================================================================

interface MovesPageProps {
  pokemon: PartyPokemon;
  selectedIndex: number;
  onSelectMove: (index: number) => void;
}

function MovesPage({ pokemon, selectedIndex, onSelectMove }: MovesPageProps) {
  const moves = pokemon.moves.map((moveId, i) => {
    const info = getMoveInfo(moveId);
    return {
      id: moveId,
      name: MOVE_NAMES[moveId] || (moveId === 0 ? '—' : `Move #${moveId}`),
      pp: pokemon.pp[i],
      maxPp: info?.pp ?? 0,
      type: info?.type ?? 'NORMAL',
      power: info?.power ?? 0,
      accuracy: info?.accuracy ?? 0,
    };
  });

  const selectedMove = moves[selectedIndex];

  return (
    <div className="moves-page">
      <div className="moves-list">
        {moves.map((move, i) => {
          const ppPercent = move.maxPp > 0 ? move.pp / move.maxPp : 1;
          const ppColor = ppPercent > 0.5 ? '#fff' : ppPercent > 0.25 ? '#f8d030' : '#f85888';

          return (
            <div
              key={i}
              className={`move-row ${selectedIndex === i ? 'selected' : ''} ${move.id === 0 ? 'empty' : ''}`}
              onClick={() => onSelectMove(i)}
            >
              {move.id !== 0 ? (
                <>
                  <span className="move-name">{move.name}</span>
                  <span className="move-pp" style={{ color: ppColor }}>
                    {move.pp}/{move.maxPp}
                  </span>
                </>
              ) : (
                <span className="move-empty">—</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Move details */}
      {selectedMove?.id !== 0 && (
        <div className="move-details">
          <div className="move-detail-row">
            <span className="move-detail-label">Type</span>
            <span
              className="move-type-tag"
              style={{ backgroundColor: getTypeColor(selectedMove.type) }}
            >
              {selectedMove.type}
            </span>
          </div>
          <div className="move-detail-row">
            <span className="move-detail-label">Power</span>
            <span className="move-detail-value">
              {selectedMove.power > 0 ? selectedMove.power : '—'}
            </span>
          </div>
          <div className="move-detail-row">
            <span className="move-detail-label">Acc</span>
            <span className="move-detail-value">
              {selectedMove.accuracy > 0 ? `${selectedMove.accuracy}%` : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PokemonSummaryContent;

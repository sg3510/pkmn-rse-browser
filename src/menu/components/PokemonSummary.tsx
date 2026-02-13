/**
 * Pokemon Summary Screen
 *
 * Multi-page display showing Pokemon details:
 * - INFO: Sprite, species, nature, ability, OT
 * - STATS: Stat bars, IVs/EVs, EXP progress
 * - MOVES: 4 moves with type, PP, power, accuracy
 */

import { useState, useCallback, useEffect } from 'react';
import { useMenuInput } from '../hooks/useMenuState';
import type { PartyPokemon } from '../../pokemon/types';
import { getSpeciesName } from '../../data/species';
import { getSpeciesInfo } from '../../data/speciesInfo';
import { getNatureName, getNatureStatEffect } from '../../data/natures';
import { ABILITY_NAMES } from '../../data/abilities';
import { MOVE_NAMES, getMoveInfo } from '../../data/moves';
import { getGenderFromPersonality, getExpProgress, getExpToNextLevel } from '../../pokemon/stats';
import { getTypeColor, getGenderColor } from '../../pokemon/icons';
import { toPublicAssetUrl } from '../../utils/publicAssetUrl';
import '../styles/pokemon-summary.css';

type SummaryPage = 'info' | 'stats' | 'moves';

interface PokemonSummaryProps {
  pokemon: PartyPokemon;
  onClose: () => void;
  zoom?: number;
}

export function PokemonSummary({ pokemon, onClose, zoom = 1 }: PokemonSummaryProps) {
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
    onClose();
  }, [onClose]);

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
    enabled: true,
  });

  // Get Pokemon info
  const speciesInfo = getSpeciesInfo(pokemon.species);
  const speciesName = getSpeciesName(pokemon.species);
  const displayName = pokemon.nickname || speciesName;
  const gender = speciesInfo ? getGenderFromPersonality(pokemon.personality, speciesInfo.genderRatio) : 'genderless';
  const genderSymbol = gender === 'male' ? '♂' : gender === 'female' ? '♀' : '';
  const natureId = pokemon.personality % 25;
  const natureName = getNatureName(natureId);
  const abilityIndex = speciesInfo?.abilities[pokemon.abilityNum as 0 | 1] ?? 0;
  const abilityName = ABILITY_NAMES[abilityIndex] || 'Unknown';
  const types = speciesInfo?.types || ['NORMAL', 'NORMAL'];
  const uniqueTypes = types[0] === types[1] ? [types[0]] : types;

  // Sprite path
  const iconFolder = speciesName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const spritePath = toPublicAssetUrl(`/pokeemerald/graphics/pokemon/${iconFolder}/front.png`);
  const fallbackSpritePath = toPublicAssetUrl('/pokeemerald/graphics/pokemon/egg/front.png');

  return (
    <div className="summary-overlay" onClick={handleCancel}>
      <div
        className="summary-container"
        style={{ transform: `scale(${zoom})` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with page tabs */}
        <div className="summary-header">
          <div className="summary-tabs">
            {pages.map((page) => (
              <button
                key={page}
                className={`summary-tab ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="summary-close" onClick={handleCancel}>✕</button>
        </div>

        {/* Pokemon identity bar */}
        <div className="summary-identity">
          <span className="summary-name">{displayName}</span>
          {genderSymbol && (
            <span className="summary-gender" style={{ color: getGenderColor(gender) }}>
              {genderSymbol}
            </span>
          )}
          <span className="summary-level">Lv.{pokemon.level}</span>
          <div className="summary-types">
            {uniqueTypes.map(type => (
              <span
                key={type}
                className="summary-type-badge"
                style={{ backgroundColor: getTypeColor(type) }}
              >
                {type}
              </span>
            ))}
          </div>
        </div>

        {/* Page content */}
        <div className="summary-content">
          {currentPage === 'info' && (
            <InfoPage
              pokemon={pokemon}
              speciesName={speciesName}
              natureName={natureName}
              abilityName={abilityName}
              spritePath={spritePath}
              fallbackSpritePath={fallbackSpritePath}
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
        <div className="summary-page-dots">
          {pages.map((page) => (
            <span
              key={page}
              className={`summary-dot ${currentPage === page ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Navigation hint */}
        <div className="summary-hint">
          ◄ ► Switch page | B: Back
        </div>
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
  fallbackSpritePath: string;
}

function InfoPage({
  pokemon,
  speciesName,
  natureName,
  abilityName,
  spritePath,
  fallbackSpritePath,
}: InfoPageProps) {
  return (
    <div className="summary-info-page">
      {/* Pokemon sprite */}
      <div className="summary-sprite-container">
        <img
          src={spritePath}
          alt={speciesName}
          className="summary-sprite"
          onError={(e) => {
            // Fallback to icon if front sprite missing
            (e.target as HTMLImageElement).src = fallbackSpritePath;
          }}
        />
      </div>

      {/* Info details */}
      <div className="summary-info-details">
        <div className="summary-info-row">
          <span className="summary-label">Species</span>
          <span className="summary-value">{speciesName}</span>
        </div>
        <div className="summary-info-row">
          <span className="summary-label">Nature</span>
          <span className="summary-value">{natureName}</span>
        </div>
        <div className="summary-info-row">
          <span className="summary-label">Ability</span>
          <span className="summary-value">{abilityName}</span>
        </div>
        <div className="summary-info-row">
          <span className="summary-label">OT</span>
          <span className="summary-value">{pokemon.otName}</span>
        </div>
        <div className="summary-info-row">
          <span className="summary-label">ID No.</span>
          <span className="summary-value">{String(pokemon.otId & 0xFFFF).padStart(5, '0')}</span>
        </div>
        <div className="summary-info-row">
          <span className="summary-label">Item</span>
          <span className="summary-value">{pokemon.heldItem > 0 ? `Item #${pokemon.heldItem}` : 'None'}</span>
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
    { name: 'HP', value: pokemon.stats.maxHp, iv: pokemon.ivs.hp, ev: pokemon.evs.hp, index: -1 },
    { name: 'Attack', value: pokemon.stats.attack, iv: pokemon.ivs.attack, ev: pokemon.evs.attack, index: 0 },
    { name: 'Defense', value: pokemon.stats.defense, iv: pokemon.ivs.defense, ev: pokemon.evs.defense, index: 1 },
    { name: 'Sp.Atk', value: pokemon.stats.spAttack, iv: pokemon.ivs.spAttack, ev: pokemon.evs.spAttack, index: 3 },
    { name: 'Sp.Def', value: pokemon.stats.spDefense, iv: pokemon.ivs.spDefense, ev: pokemon.evs.spDefense, index: 4 },
    { name: 'Speed', value: pokemon.stats.speed, iv: pokemon.ivs.speed, ev: pokemon.evs.speed, index: 2 },
  ];

  const growthRate = speciesInfo?.growthRate || 'MEDIUM_FAST';
  const expProgress = getExpProgress(growthRate, pokemon.level, pokemon.experience);
  const expToNext = getExpToNextLevel(growthRate, pokemon.level, pokemon.experience);

  return (
    <div className="summary-stats-page">
      {/* Stat bars */}
      <div className="summary-stats-list">
        {stats.map(stat => {
          const natureEffect = stat.index >= 0 ? getNatureStatEffect(natureId, stat.index) : 0;
          const maxStat = 400; // Reasonable max for bar scaling
          const barWidth = Math.min(100, (stat.value / maxStat) * 100);

          return (
            <div key={stat.name} className="summary-stat-row">
              <span className={`summary-stat-name ${
                natureEffect > 0 ? 'nature-plus' : natureEffect < 0 ? 'nature-minus' : ''
              }`}>
                {stat.name}
              </span>
              <div className="summary-stat-bar-container">
                <div
                  className="summary-stat-bar"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="summary-stat-value">{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* EXP bar */}
      <div className="summary-exp-section">
        <div className="summary-exp-row">
          <span className="summary-label">EXP. Points</span>
          <span className="summary-value">{pokemon.experience.toLocaleString()}</span>
        </div>
        <div className="summary-exp-row">
          <span className="summary-label">To Next Lv.</span>
          <span className="summary-value">{expToNext.toLocaleString()}</span>
        </div>
        <div className="summary-exp-bar-container">
          <div className="summary-exp-bar" style={{ width: `${expProgress}%` }} />
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

  return (
    <div className="summary-moves-page">
      <div className="summary-moves-list">
        {moves.map((move, i) => {
          const ppPercent = move.maxPp > 0 ? move.pp / move.maxPp : 1;
          const ppColor = ppPercent > 0.5 ? '#fff' : ppPercent > 0.25 ? '#f8d030' : '#f85888';

          return (
            <div
              key={i}
              className={`summary-move-slot ${selectedIndex === i ? 'selected' : ''} ${move.id === 0 ? 'empty' : ''}`}
              onClick={() => onSelectMove(i)}
            >
              {move.id !== 0 ? (
                <>
                  <span className="summary-move-name">{move.name}</span>
                  <span className="summary-move-pp" style={{ color: ppColor }}>
                    PP {move.pp}/{move.maxPp}
                  </span>
                </>
              ) : (
                <span className="summary-move-empty">—</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Move details (for selected move) */}
      {moves[selectedIndex]?.id !== 0 && (
        <div className="summary-move-details">
          <div className="summary-move-detail-row">
            <span className="summary-label">Type</span>
            <span
              className="summary-type-badge"
              style={{ backgroundColor: getTypeColor(moves[selectedIndex].type) }}
            >
              {moves[selectedIndex].type}
            </span>
          </div>
          <div className="summary-move-detail-row">
            <span className="summary-label">Power</span>
            <span className="summary-value">
              {moves[selectedIndex].power > 0 ? moves[selectedIndex].power : '—'}
            </span>
          </div>
          <div className="summary-move-detail-row">
            <span className="summary-label">Accuracy</span>
            <span className="summary-value">
              {moves[selectedIndex].accuracy > 0 ? `${moves[selectedIndex].accuracy}%` : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PokemonSummary;

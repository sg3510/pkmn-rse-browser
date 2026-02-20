/**
 * Pokemon Summary Content - Emerald Style
 *
 * Authentic GBA Pokemon Emerald summary screen.
 * Three pages: INFO (Profile), SKILLS (Stats), MOVES
 *
 * Based on reference: public/emerald-dex-summary
 */

import { useState, useCallback, useEffect } from 'react';
import { useMenuState, useMenuInput } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import type { PartyPokemon } from '../../pokemon/types';
import { getSpeciesName } from '../../data/species';
import { getSpeciesInfo } from '../../data/speciesInfo';
import { getNatureName, getNatureStatEffect } from '../../data/natures';
import { ABILITY_NAMES, getAbilityDescription } from '../../data/abilities';
import { getMoveInfo } from '../../data/moves';
import { getGenderFromPersonality, getExpProgress, getExpToNextLevel } from '../../pokemon/stats';
import { loadTransparentSprite } from '../../utils/transparentSprite';
import { toPublicAssetUrl } from '../../utils/publicAssetUrl';
import { createMoveListModel } from '../moves/MoveListModel';
import { useMoveListNavigation } from '../moves/useMoveListNavigation';
import { MoveRowFields } from '../moves/MoveRow';
// Type images loaded via transparentSprite utility (keys out black background)
import '../styles/pokemon-summary-emerald.css';

type SummaryPage = 'info' | 'skills' | 'moves';

interface PokemonSummaryContentProps {
  pokemon: PartyPokemon;
  partyIndex?: number;
}

export function PokemonSummaryContent({ pokemon, partyIndex: _partyIndex }: PokemonSummaryContentProps) {
  void _partyIndex; // Reserved for party navigation

  const { isOpen, currentMenu } = useMenuState();
  const [currentPage, setCurrentPage] = useState<SummaryPage>('info');
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(0);
  const { moveUp, moveDown } = useMoveListNavigation({
    selectedIndex: selectedMoveIndex,
    setSelectedIndex: setSelectedMoveIndex,
    maxIndex: 3,
  });

  const pages: SummaryPage[] = ['info', 'skills', 'moves'];
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
      moveUp();
    }
  }, [currentPage, moveUp]);

  const handleDown = useCallback(() => {
    if (currentPage === 'moves') {
      moveDown();
    }
  }, [currentPage, moveDown]);

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

  // Determine primary and secondary names based on game logic
  const hasDistinctNickname = pokemon.nickname && pokemon.nickname !== speciesName;
  const primaryName = hasDistinctNickname ? pokemon.nickname! : speciesName;
  // Secondary name is /SpeciesName if any nickname exists (even if same as species, per RALTS /RALTS screenshot)
  const secondaryName = pokemon.nickname ? `/${speciesName}` : '';
  const gender = speciesInfo ? getGenderFromPersonality(pokemon.personality, speciesInfo.genderRatio) : 'genderless';
  const genderSymbol = gender === 'male' ? '♂' : gender === 'female' ? '♀' : '';
  const natureId = pokemon.personality % 25;
  const natureName = getNatureName(natureId);
  const abilityIndex = speciesInfo?.abilities[pokemon.abilityNum as 0 | 1] ?? 0;
  const abilityName = ABILITY_NAMES[abilityIndex] || 'Unknown';
  const abilityDesc = getAbilityDescription(abilityIndex);
  const types = speciesInfo?.types || ['NORMAL', 'NORMAL'];
  const uniqueTypes = types[0] === types[1] ? [types[0]] : types;

  // Sprite path
  const iconFolder = speciesName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const spritePath = toPublicAssetUrl(`/pokeemerald/graphics/pokemon/${iconFolder}/front.png`);
  const fallbackSpritePath = toPublicAssetUrl('/pokeemerald/graphics/pokemon/egg/front.png');

  // Get header title based on current page
  const getHeaderTitle = () => {
    switch (currentPage) {
      case 'info': return 'POKéMON INFO';
      case 'skills': return 'POKéMON SKILLS';
      case 'moves': return 'KNOWN MOVES';
      default: return 'POKéMON INFO';
    }
  };

  // Get Pokedex number
  const dexNumber = pokemon.species.toString().padStart(3, '0');

  // Get selected move for left panel (moves page)
  const selectedMove = pokemon.moves[selectedMoveIndex];
  const selectedMoveInfo = getMoveInfo(selectedMove);

  return (
    <div className="summary-emerald">
      {/* Header */}
      <div className="summary-emerald-header">
        <div className="summary-header-title-bg" />
        <div className="summary-header-title">{getHeaderTitle()}</div>
        <div className="summary-header-controls">
          <div className="summary-dots-container">
            {pages.map((page) => (
              <button
                key={page}
                className={`summary-dot ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              />
            ))}
          </div>
          {/* Back button handled by MenuOverlay triangle */}
        </div>
      </div>

      {/* Content Area */}
      <div className="summary-emerald-content">
        {/* Left Panel */}
        <div className="summary-left-panel">
          {/* Header: No. and Markings */}
          <div className="summary-left-header">
            <div className="summary-poke-number">
              <span className="summary-poke-number-label">No</span>{dexNumber}
            </div>
            <div className="summary-markings">
              <span className={`summary-marking ${pokemon.markings.circle ? 'active' : ''}`}>●</span>
              <span className={`summary-marking ${pokemon.markings.square ? 'active' : ''}`}>■</span>
              <span className={`summary-marking ${pokemon.markings.triangle ? 'active' : ''}`}>▲</span>
              <span className={`summary-marking ${pokemon.markings.heart ? 'active' : ''}`}>♥</span>
            </div>
          </div>

          {/* Sprite */}
          <div className="summary-sprite-container">
            <img
              src={spritePath}
              alt={speciesName}
              className="summary-sprite-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src = fallbackSpritePath;
              }}
            />
          </div>

          {/* Info section - changes based on page */}
          {currentPage === 'moves' ? (
            /* Moves view: Show name at top, EFFECT box at bottom (full width) */
            <>
              <div className="summary-left-info">
                <div className="summary-poke-name-display">{displayName}</div>
              </div>
              <div className="summary-left-effect">
                <div className="summary-effect-header">
                  <span className="summary-effect-header-text">EFFECT</span>
                </div>
                <div className="summary-effect-table">
                  <div className="summary-effect-row">
                    <span className="summary-effect-label">POWER</span>
                    <span className="summary-effect-value">
                      {selectedMoveInfo?.power && selectedMoveInfo.power > 0 ? selectedMoveInfo.power : '---'}
                    </span>
                  </div>
                  <div className="summary-effect-row">
                    <span className="summary-effect-label">ACCURACY</span>
                    <span className="summary-effect-value">
                      {selectedMoveInfo?.accuracy && selectedMoveInfo.accuracy > 0 ? selectedMoveInfo.accuracy : '---'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Normal view: Name, nickname, level, gender */
            <div className="summary-left-info">
              {/* Name Display: Primary name, and secondary if applicable */}
              <div className="summary-poke-name-display">{primaryName}</div>
              {secondaryName && (
                <div className="summary-poke-nickname">{secondaryName}</div>
              )}
              <div className="summary-level-row">
                <div className="summary-level-info">
                  <div className="summary-pokeball-icon" />
                  <span className="summary-level-text">
                    L<span className="summary-level-v">v</span>{pokemon.level}
                  </span>
                </div>
                {genderSymbol && (
                  <span className={`summary-gender-symbol ${gender}`}>
                    {genderSymbol}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="summary-right-panel">
          <div className="summary-right-content">
            {currentPage === 'info' && (
              <ProfilePage
                pokemon={pokemon}
                speciesName={speciesName}
                natureName={natureName}
                abilityName={abilityName}
                abilityDesc={abilityDesc}
                uniqueTypes={uniqueTypes}
              />
            )}
            {currentPage === 'skills' && (
              <SkillsPage
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
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROFILE Page (Tab 0: INFO)
// ============================================================================

interface ProfilePageProps {
  pokemon: PartyPokemon;
  speciesName: string;
  natureName: string;
  abilityName: string;
  abilityDesc: string;
  uniqueTypes: string[];
}

function ProfilePage({ pokemon, natureName, abilityName, abilityDesc, uniqueTypes }: ProfilePageProps) {
  return (
    <div className="summary-profile">
      {/* Profile Section */}
      <div className="summary-section-header blue">
        <span className="summary-section-title">PROFILE</span>
      </div>

      <div className="summary-profile-ot-row">
        <span className="summary-profile-ot-label">OT/</span>
        <span className="summary-profile-ot-name">{pokemon.otName}</span>
        <span className="summary-profile-id">
          <span className="summary-profile-id-label">IDNo.</span>
          {String(pokemon.otId & 0xFFFF).padStart(5, '0')}
        </span>
      </div>

      <div className="summary-type-row">
        <span className="summary-type-label">TYPE/</span>
        <div className="summary-type-tags">
          {uniqueTypes.map(type => (
            <TypeBadge key={type} type={type} className="summary-type-img" />
          ))}
        </div>
      </div>

      {/* Ability Section */}
      <div className="summary-section-header blue">
        <span className="summary-section-title">ABILITY</span>
      </div>

      <div className="summary-ability-section">
        <div className="summary-ability-name">{abilityName}</div>
        {abilityDesc && (
          <div className="summary-ability-desc-box">
            <div className="summary-ability-desc">{abilityDesc}</div>
          </div>
        )}
      </div>

      {/* Trainer Memo Section */}
      <div className="summary-section-header blue">
        <span className="summary-section-title">TRAINER MEMO</span>
      </div>

      <div className="summary-memo-section">
        <div className="summary-memo-text">
          <span className="summary-memo-nature">{natureName}</span>
          {' '}nature,
          <br />
          met at L<span className="summary-level-v">v</span>{pokemon.metLevel},
          <br />
          <span className="summary-memo-location">
            {getLocationName(pokemon.metLocation)}.
          </span>
        </div>
        {/* Flavor text removed - would need generator for pokedex_text.h */}
      </div>
    </div>
  );
}

// ============================================================================
// SKILLS Page (Tab 1: Stats)
// ============================================================================

interface SkillsPageProps {
  pokemon: PartyPokemon;
  speciesInfo: ReturnType<typeof getSpeciesInfo>;
  natureId: number;
}

function SkillsPage({ pokemon, speciesInfo, natureId }: SkillsPageProps) {
  const stats = [
    { name: 'ATTACK', value: pokemon.stats.attack, index: 0 },
    { name: 'DEFENSE', value: pokemon.stats.defense, index: 1 },
    { name: 'SP. ATK', value: pokemon.stats.spAttack, index: 3 },
    { name: 'SP. DEF', value: pokemon.stats.spDefense, index: 4 },
    { name: 'SPEED', value: pokemon.stats.speed, index: 2 },
  ];

  const growthRate = speciesInfo?.growthRate || 'MEDIUM_FAST';
  const expProgress = getExpProgress(growthRate, pokemon.level, pokemon.experience);
  const expToNext = getExpToNextLevel(growthRate, pokemon.level, pokemon.experience);

  // Get item name (placeholder - would need items data)
  const itemName = pokemon.heldItem > 0 ? `Item #${pokemon.heldItem}` : 'NONE';

  // Count ribbons
  const ribbonCount = countRibbons(pokemon.ribbons);

  return (
    <div className="summary-skills">
      {/* Item/Ribbon row */}
      <div className="summary-skills-top-row">
        <div className="summary-skills-top-item">
          <div className="summary-section-header yellow">
            <span className="summary-section-title">ITEM</span>
          </div>
          <div className="summary-skills-item-value">{itemName}</div>
        </div>
        <div className="summary-skills-top-item">
          <div className="summary-section-header yellow">
            <span className="summary-section-title">RIBBON</span>
          </div>
          <div className="summary-skills-item-value">
            {ribbonCount > 0 ? `${ribbonCount}` : 'NONE'}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="summary-section-header yellow">
        <span className="summary-section-title">STATS</span>
      </div>

      <div className="summary-stats-list">
        {/* HP special row */}
        <div className="summary-stat-row">
          <span className="summary-stat-name">HP</span>
          <div className="summary-hp-values">
            <span>{pokemon.stats.hp}/</span>
            <span>{pokemon.stats.maxHp}</span>
          </div>
        </div>

        {/* Other stats */}
        {stats.map(stat => {
          const natureEffect = getNatureStatEffect(natureId, stat.index);
          return (
            <div key={stat.name} className="summary-stat-row">
              <span className={`summary-stat-name ${
                natureEffect > 0 ? 'nature-up' : natureEffect < 0 ? 'nature-down' : ''
              }`}>
                {stat.name}
              </span>
              <span className="summary-stat-value">{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* EXP Section */}
      <div className="summary-exp-section">
        <div className="summary-section-header yellow">
          <span className="summary-section-title">EXP.</span>
        </div>
        <div className="summary-exp-row">
          <span className="summary-exp-label">EXP. POINTS</span>
          <span className="summary-exp-value">{pokemon.experience.toLocaleString()}</span>
        </div>
        <div className="summary-exp-row">
          <span className="summary-exp-label">NEXT LV.</span>
          <span className="summary-exp-value">{expToNext.toLocaleString()}</span>
        </div>
        <div className="summary-exp-bar-container">
          <span className="summary-exp-bar-label">EXP</span>
          <div className="summary-exp-bar">
            <div className="summary-exp-bar-fill" style={{ width: `${expProgress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MOVES Page (Tab 2)
// ============================================================================

interface MovesPageProps {
  pokemon: PartyPokemon;
  selectedIndex: number;
  onSelectMove: (index: number) => void;
}

function MovesPage({ pokemon, selectedIndex, onSelectMove }: MovesPageProps) {
  const moves = createMoveListModel(pokemon);

  const selectedMoveDesc = moves[selectedIndex]?.description || 'Select a move to see details.';

  return (
    <div className="summary-moves">
      {/* Moves Header */}
      <div className="summary-section-header purple">
        <span className="summary-section-title">MOVES</span>
      </div>

      {/* Moves List */}
      <div className="summary-moves-list">
        {moves.map((move, i) => (
          <div
            key={i}
            className={`summary-move-row ${selectedIndex === i ? 'selected' : ''} ${move.isEmpty ? 'empty' : ''}`}
            onClick={() => !move.isEmpty && onSelectMove(i)}
          >
            {!move.isEmpty ? (
              <>
                <MoveRowFields
                  move={move}
                  renderType={(type) => <TypeBadge type={type} className="summary-move-type-img" />}
                  nameClassName="summary-move-name"
                  ppClassName="summary-move-pp"
                  ppLabelClassName="summary-move-pp-label"
                  showPpLabel
                />
              </>
            ) : (
              <>
                <div className="summary-move-empty-type" />
                <div className="summary-move-empty-name" />
                <div className="summary-move-empty-pp" />
              </>
            )}
          </div>
        ))}

        {/* Fill empty slots if less than 4 moves */}
        {[...Array(4 - moves.length)].map((_, i) => (
          <div key={`empty-${i}`} className="summary-move-row empty">
            <div className="summary-move-empty-type" />
            <div className="summary-move-empty-name" />
            <div className="summary-move-empty-pp" />
          </div>
        ))}
      </div>

      {/* Description Section */}
      <div className="summary-move-desc-section">
        <div className="summary-section-header purple">
          <span className="summary-section-title">DESCRIPTION</span>
        </div>
        <div className="summary-move-desc-box">
          <p className="summary-move-desc-text">{selectedMoveDesc}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get location name from location ID (placeholder)
 */
function getLocationName(locationId: number): string {
  // TODO: Import location data from pokeemerald
  // For now, return a generic name
  const locationNames: Record<number, string> = {
    0: 'Unknown',
    // Add more as needed
  };
  return locationNames[locationId] || `Route ${locationId}`;
}


/**
 * Count total ribbons
 */
function countRibbons(ribbons: PartyPokemon['ribbons']): number {
  let count = 0;
  // Contest ribbons (each rank counts as 1)
  count += ribbons.coolRank;
  count += ribbons.beautyRank;
  count += ribbons.cuteRank;
  count += ribbons.smartRank;
  count += ribbons.toughRank;
  // Achievement ribbons
  if (ribbons.champion) count++;
  if (ribbons.winning) count++;
  if (ribbons.victory) count++;
  if (ribbons.artist) count++;
  if (ribbons.effort) count++;
  if (ribbons.marine) count++;
  if (ribbons.land) count++;
  if (ribbons.sky) count++;
  if (ribbons.country) count++;
  if (ribbons.national) count++;
  if (ribbons.earth) count++;
  if (ribbons.world) count++;
  return count;
}

/**
 * Hook to load a transparent type image
 */
function useTransparentTypeImage(type: string): string | undefined {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    const typeLower = type.toLowerCase();
    const path = toPublicAssetUrl(`/pokeemerald/graphics/types/${typeLower}.png`);
    loadTransparentSprite(path).then(setSrc).catch(() => {
      // Fallback: don't set src, component will use colored badge
    });
  }, [type]);

  return src;
}

/**
 * Type badge component - uses transparent PNG if available, falls back to colored badge
 */
function TypeBadge({ type, className }: { type: string; className?: string }) {
  const transparentSrc = useTransparentTypeImage(type);

  if (transparentSrc) {
    return (
      <img
        src={transparentSrc}
        alt={type}
        className={className || 'summary-type-img'}
      />
    );
  }

  // Fallback to colored text badge (shouldn't happen if PNGs exist)
  return (
    <span className={className || 'summary-type-tag'} style={{ backgroundColor: getTypeColorFallback(type) }}>
      {type}
    </span>
  );
}

/**
 * Fallback type colors (used if PNG doesn't load)
 */
function getTypeColorFallback(type: string): string {
  const colors: Record<string, string> = {
    NORMAL: '#A8A878', FIRE: '#F08030', WATER: '#6890F0', GRASS: '#78C850',
    ELECTRIC: '#F8D030', ICE: '#98D8D8', FIGHTING: '#C03028', POISON: '#A040A0',
    GROUND: '#E0C068', FLYING: '#A890F0', PSYCHIC: '#F85888', BUG: '#A8B820',
    ROCK: '#B8A038', GHOST: '#705898', DRAGON: '#7038F8', STEEL: '#B8B8D0',
    DARK: '#705848', FAIRY: '#EE99AC',
  };
  return colors[type.toUpperCase()] || '#A8A878';
}

export default PokemonSummaryContent;

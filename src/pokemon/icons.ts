/**
 * Pokemon Icon Utilities
 *
 * Helpers for displaying Pokemon icons in the UI.
 * Icons are 32x64 PNG files (2 animation frames stacked vertically).
 */

import { getPokemonIconPath as getIconPath, hasSpeciesIcon } from '../data/species';
import { getSpeciesInfo } from '../data/speciesInfo';
import { getGenderFromPersonality } from './stats';
import { toPublicAssetUrl } from '../utils/publicAssetUrl';

// Re-export the basic icon path function
export { getPokemonIconPath, hasSpeciesIcon } from '../data/species';

/**
 * Icon display configuration
 */
export interface IconConfig {
  animated?: boolean;      // Enable frame animation
  grayscale?: boolean;     // Fainted/disabled appearance
  size?: number;           // Display size (default 32)
}

/**
 * Get CSS styles for a Pokemon icon
 */
export function getPokemonIconStyle(
  speciesId: number,
  config: IconConfig = {}
): React.CSSProperties {
  const { animated = true, grayscale = false, size = 32 } = config;

  const iconPath = toPublicAssetUrl(getIconPath(speciesId));

  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url(${iconPath})`,
    backgroundSize: `${size}px ${size * 2}px`,
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    filter: grayscale ? 'grayscale(1) brightness(0.7)' : undefined,
    animation: animated ? 'pokemon-icon-bounce 0.5s steps(2) infinite' : undefined,
  };
}

/**
 * CSS keyframes for icon animation
 * Add this to your global CSS or component styles:
 *
 * @keyframes pokemon-icon-bounce {
 *   0%, 100% { background-position-y: 0; }
 *   50% { background-position-y: -32px; }
 * }
 */
export const ICON_ANIMATION_CSS = `
@keyframes pokemon-icon-bounce {
  0%, 100% { background-position-y: 0; }
  50% { background-position-y: -32px; }
}
`;

/**
 * Get gender symbol for display
 */
export function getGenderSymbol(
  personality: number,
  speciesId: number
): string {
  const info = getSpeciesInfo(speciesId);
  if (!info) return '';

  const gender = getGenderFromPersonality(personality, info.genderRatio);

  switch (gender) {
    case 'male': return '♂';
    case 'female': return '♀';
    case 'genderless': return '';
  }
}

/**
 * Get gender color for display
 */
export function getGenderColor(gender: 'male' | 'female' | 'genderless'): string {
  switch (gender) {
    case 'male': return '#6890F0';      // Blue
    case 'female': return '#F85888';    // Pink
    case 'genderless': return '#A8A8A8'; // Gray
  }
}

/**
 * Check if an icon exists for a species
 */
export function hasIcon(speciesId: number): boolean {
  return hasSpeciesIcon(speciesId);
}

/**
 * Fallback icon path (egg icon)
 */
export const FALLBACK_ICON = toPublicAssetUrl('/pokeemerald/graphics/pokemon/egg/icon.png');

/**
 * Get type color for display
 */
export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    NORMAL: '#A8A878',
    FIGHTING: '#C03028',
    FLYING: '#A890F0',
    POISON: '#A040A0',
    GROUND: '#E0C068',
    ROCK: '#B8A038',
    BUG: '#A8B820',
    GHOST: '#705898',
    STEEL: '#B8B8D0',
    FIRE: '#F08030',
    WATER: '#6890F0',
    GRASS: '#78C850',
    ELECTRIC: '#F8D030',
    PSYCHIC: '#F85888',
    ICE: '#98D8D8',
    DRAGON: '#7038F8',
    DARK: '#705848',
  };
  return colors[type] || '#68A090';  // Default teal for unknown
}

/**
 * Get HP bar color based on percentage
 */
export function getHPBarColor(currentHP: number, maxHP: number): string {
  if (maxHP <= 0) return '#48d048';  // Green if unknown

  const percentage = (currentHP / maxHP) * 100;

  if (percentage > 50) return '#48d048';   // Green
  if (percentage > 20) return '#f8d030';   // Yellow
  return '#f85888';                         // Red
}

/**
 * Format HP display text
 */
export function formatHP(current: number, max: number): string {
  return `${current}/${max}`;
}

/**
 * Format level display
 */
export function formatLevel(level: number): string {
  return `Lv.${level}`;
}

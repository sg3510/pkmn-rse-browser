/**
 * HP Bar Component
 *
 * Reusable HP bar with GBA-accurate colors.
 * Uses design system CSS variables for sizing.
 */

import { getHPBarColor } from '../../pokemon/icons';
import '../styles/hp-bar.css';

export interface HPBarProps {
  currentHP: number;
  maxHP: number;
  showNumbers?: boolean;
  compact?: boolean;
}

export function HPBar({
  currentHP,
  maxHP,
  showNumbers = true,
  compact = false,
}: HPBarProps) {
  const percentage = maxHP > 0 ? Math.max(0, Math.min(100, (currentHP / maxHP) * 100)) : 0;
  const color = getHPBarColor(currentHP, maxHP);

  const containerClass = `hp-bar-container ${compact ? 'compact' : ''}`;

  return (
    <div className={containerClass}>
      <div className="hp-bar-wrapper">
        <div className="hp-bar-background" />
        <div
          className="hp-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
        <span className="hp-bar-label">HP</span>
      </div>
      {showNumbers && (
        <span className="hp-bar-numbers">
          {currentHP}/{maxHP}
        </span>
      )}
    </div>
  );
}

/**
 * EXP Bar Component
 */
export interface EXPBarProps {
  currentEXP: number;
  expToNextLevel: number;
}

export function EXPBar({ currentEXP, expToNextLevel }: EXPBarProps) {
  const total = currentEXP + expToNextLevel;
  const percentage = total > 0 ? (currentEXP / total) * 100 : 0;

  return (
    <div className="exp-bar-container">
      <div className="exp-bar-wrapper">
        <div className="exp-bar-background" />
        <div
          className="exp-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default HPBar;

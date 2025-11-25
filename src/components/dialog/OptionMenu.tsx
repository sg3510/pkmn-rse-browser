/**
 * OptionMenu - Yes/No and multi-choice menu renderer
 *
 * Pokemon Emerald style option menu:
 * - Positioned above dialog box, right-aligned
 * - Uses same frame style as dialog
 * - Cursor indicator for selected option
 *
 * GBA Specs:
 * - Yes/No menu: 6 tiles wide x 4 tiles high (48x32px at 1x)
 * - Right-pointing triangle cursor
 * - 1 tile (8px) padding inside frame
 */

import React from 'react';
import { TILE_SIZE, YESNO_DIMENSIONS, TEXT_SPECS } from './types';
import type { DialogChoice } from './types';
import { DialogFrame } from './DialogFrame';

interface OptionMenuProps<T = unknown> {
  /** Available choices */
  choices: DialogChoice<T>[];
  /** Currently selected index */
  selectedIndex: number;
  /** Frame style (1-20) */
  frameStyle?: number;
  /** Zoom level */
  zoom?: number;
  /** Text color */
  textColor?: string;
  /** Shadow color */
  shadowColor?: string;
  /** Callback when selection changes */
  onSelect?: (index: number) => void;
  /** Callback when option is confirmed */
  onConfirm?: (value: T) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
}

export function OptionMenu<T = unknown>({
  choices,
  selectedIndex,
  frameStyle = 1,
  zoom = 1,
  textColor = '#303030',
  shadowColor = '#a8a8a8',
}: OptionMenuProps<T>): React.ReactElement {
  const scaledTile = TILE_SIZE * zoom;

  // Calculate menu dimensions
  // Find longest label to determine width
  const longestLabel = choices.reduce(
    (max, choice) => Math.max(max, choice.label.length),
    0
  );

  // Width: cursor (1 tile) + text + padding
  // Minimum 6 tiles for Yes/No style menu
  const widthTiles = Math.max(
    YESNO_DIMENSIONS.widthTiles,
    Math.ceil(longestLabel * 0.8) + 3 // Rough char width + cursor + padding
  );

  // Height: 2 tiles for frame + 1 tile per choice
  const heightTiles = Math.max(
    YESNO_DIMENSIONS.heightTiles,
    choices.length + 2
  );

  const menuWidth = widthTiles * scaledTile;
  const menuHeight = heightTiles * scaledTile;

  // Font and text sizing
  const fontSize = TEXT_SPECS.fontSizePx * zoom;
  const lineHeight = TILE_SIZE * TEXT_SPECS.lineHeightMultiplier * zoom;
  const shadowOffset = 1; // Always 1px

  return (
    <DialogFrame
      width={menuWidth}
      height={menuHeight}
      style={frameStyle}
      zoom={zoom}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          padding: 0,
        }}
      >
        {choices.map((choice, index) => {
          const isSelected = index === selectedIndex;
          const isDisabled = choice.disabled;

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: lineHeight,
                fontFamily: '"Pokemon Emerald", "Pokemon RS", monospace',
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}px`,
                color: isDisabled ? '#808080' : textColor,
                textShadow: `${shadowOffset}px ${shadowOffset}px 0 ${shadowColor}`,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                WebkitFontSmoothing: 'none',
              }}
            >
              {/* Cursor indicator */}
              <span
                style={{
                  width: scaledTile,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  visibility: isSelected ? 'visible' : 'hidden',
                }}
              >
                ▶
              </span>
              {/* Choice label */}
              <span>{choice.label}</span>
            </div>
          );
        })}
      </div>
    </DialogFrame>
  );
}

/**
 * Pre-configured Yes/No menu
 */
interface YesNoMenuProps {
  /** Currently selected: true = YES, false = NO */
  selectedYes: boolean;
  /** Frame style (1-20) */
  frameStyle?: number;
  /** Zoom level */
  zoom?: number;
  /** Text color */
  textColor?: string;
  /** Shadow color */
  shadowColor?: string;
}

export const YesNoMenu: React.FC<YesNoMenuProps> = ({
  selectedYes,
  frameStyle = 1,
  zoom = 1,
  textColor,
  shadowColor,
}) => {
  const choices: DialogChoice<boolean>[] = [
    { label: 'YES', value: true },
    { label: 'NO', value: false },
  ];

  return (
    <OptionMenu
      choices={choices}
      selectedIndex={selectedYes ? 0 : 1}
      frameStyle={frameStyle}
      zoom={zoom}
      textColor={textColor}
      shadowColor={shadowColor}
    />
  );
};

export default OptionMenu;

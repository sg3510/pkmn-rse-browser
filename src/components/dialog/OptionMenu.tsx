import React from 'react';
import { DialogFrame } from './DialogFrame';
import type { DialogConfig, DialogOptions } from './types';
import { TILE_SIZE } from './types';

interface OptionMenuProps {
  options: DialogOptions;
  selectedIndex: number;
  config: DialogConfig;
  zoom: number;
  onSelect: (index: number) => void;
  onConfirm: () => void;
}

/**
 * OptionMenu - Renders Yes/No and multichoice menus
 *
 * Positioned above the dialog box, to the right.
 * Uses the same frame style as the main dialog.
 */
export const OptionMenu: React.FC<OptionMenuProps> = ({
  options,
  selectedIndex,
  config,
  zoom,
  onSelect,
  onConfirm,
}) => {
  const { choices } = options;

  // Calculate sizes based on zoom
  const fontSize = config.fontSizeBase * zoom;
  const lineHeight = config.fontSizeBase * config.lineHeightMultiplier * zoom;
  const padding = TILE_SIZE * zoom;
  const cursorWidth = 12 * zoom;

  // Calculate menu dimensions
  // Width: longest label + cursor space + padding
  // Using a minimum width for consistency
  const minWidthChars = 6; // "YES" / "NO" need some space
  const maxLabelLength = Math.max(
    minWidthChars,
    ...choices.map(c => c.label.length)
  );
  const contentWidth = (maxLabelLength * fontSize * 0.7) + cursorWidth + padding;

  return (
    <div
      className="option-menu"
      style={{
        position: 'absolute',
        right: padding,
        bottom: `calc(100% + ${TILE_SIZE * zoom}px)`,
        zIndex: 10,
      }}
    >
      <DialogFrame
        frameStyle={config.frameStyle}
        zoom={zoom}
        style={{
          minWidth: contentWidth,
        }}
      >
        <div
          style={{
            padding: `${padding / 2}px ${padding}px`,
          }}
        >
          {choices.map((choice, index) => (
            <div
              key={index}
              className={`option-item ${index === selectedIndex ? 'selected' : ''} ${choice.disabled ? 'disabled' : ''}`}
              onClick={() => {
                if (!choice.disabled) {
                  onSelect(index);
                  // Small delay before confirming to show selection
                  setTimeout(() => onConfirm(), 100);
                }
              }}
              onMouseEnter={() => {
                if (!choice.disabled) {
                  onSelect(index);
                }
              }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                height: lineHeight,
                paddingLeft: cursorWidth,
                fontFamily: "'Pokemon Emerald', monospace",
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}px`,
                color: choice.disabled ? '#808080' : config.textColor,
                textShadow: `1px 1px 0 ${config.shadowColor}`,
                cursor: choice.disabled ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            >
              {/* Selection cursor */}
              {index === selectedIndex && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    fontSize: `${fontSize}px`,
                    color: config.textColor,
                  }}
                >
                  {'\u25B6'} {/* Right-pointing triangle */}
                </span>
              )}
              {choice.label}
            </div>
          ))}
        </div>
      </DialogFrame>
    </div>
  );
};

export default OptionMenu;

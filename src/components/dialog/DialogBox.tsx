import React, { useMemo } from 'react';
import { DialogFrame } from './DialogFrame';
import { DialogText } from './DialogText';
import { DialogArrow } from './DialogArrow';
import { OptionMenu } from './OptionMenu';
import type { DialogConfig, DialogMessage, DialogOptions, DialogState } from './types';
import { TILE_SIZE } from './types';

interface DialogBoxProps {
  state: DialogState;
  messages: DialogMessage[];
  options: DialogOptions | null;
  config: DialogConfig;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  onAdvance?: () => void;
  onSelect?: (index: number) => void;
  onConfirm?: () => void;
}

/**
 * DialogBox - Main dialog container
 *
 * Renders the message box at the bottom of the viewport.
 * Handles:
 * - Responsive width (scales with viewport, respects min/max)
 * - Zoom-aware sizing
 * - Text display with typewriter effect
 * - Option menu positioning
 */
export const DialogBox: React.FC<DialogBoxProps> = ({
  state,
  messages,
  options,
  config,
  zoom,
  viewportWidth,
  viewportHeight,
  onAdvance,
  onSelect,
  onConfirm,
}) => {
  // Calculate dimensions
  const dimensions = useMemo(() => {
    // Convert tile-based config to pixels
    const maxWidthPx = config.maxWidthTiles * TILE_SIZE * zoom;
    const minWidthPx = config.minWidthTiles * TILE_SIZE * zoom;
    const paddingPx = config.paddingTiles * TILE_SIZE * zoom;
    const bottomOffsetPx = config.bottomOffsetTiles * TILE_SIZE * zoom;

    // Calculate width (80% of viewport, clamped to min/max)
    let width = viewportWidth * 0.9;
    width = Math.min(width, maxWidthPx);
    width = Math.max(width, minWidthPx);

    // Calculate height based on visible lines + padding + frame
    const lineHeight = config.fontSizeBase * config.lineHeightMultiplier * zoom;
    const textHeight = config.linesVisible * lineHeight;
    const frameSize = TILE_SIZE * zoom * 2; // Top + bottom frame
    const height = textHeight + (paddingPx * 2) + frameSize;

    // Position (centered horizontally, at bottom)
    const x = (viewportWidth - width) / 2;
    const y = viewportHeight - height - bottomOffsetPx;

    return { width, height, x, y, paddingPx, lineHeight };
  }, [config, zoom, viewportWidth, viewportHeight]);

  // Don't render if closed
  if (state.type === 'closed') {
    return null;
  }

  // Get current message info
  const messageIndex = 'messageIndex' in state ? state.messageIndex : 0;
  const currentMessage = messages[messageIndex];
  const charIndex = state.type === 'printing' ? state.charIndex : -1;

  // Determine if we should show the arrow
  const hasMoreMessages = messageIndex < messages.length - 1;
  const showArrow = state.type === 'waiting' && (hasMoreMessages || !options);

  // Determine if we should show options
  const showOptions = state.type === 'choosing' && options;
  const selectedIndex = state.type === 'choosing' ? state.selectedIndex : 0;

  return (
    <div
      className="dialog-box-container"
      style={{
        position: 'absolute',
        left: dimensions.x,
        top: dimensions.y,
        width: dimensions.width,
        height: dimensions.height,
        zIndex: 100,
      }}
    >
      <DialogFrame
        frameStyle={config.frameStyle}
        zoom={zoom}
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <div
          className="dialog-content"
          onClick={() => {
            // Click to advance (only if waiting or printing)
            if (state.type === 'waiting' && onAdvance) {
              onAdvance();
            } else if (state.type === 'printing') {
              // Skip printing animation
              onAdvance?.();
            }
          }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            padding: dimensions.paddingPx,
            boxSizing: 'border-box',
            overflow: 'hidden',
            cursor: (state.type === 'waiting' || state.type === 'printing') ? 'pointer' : 'default',
          }}
        >
          {/* Speaker name (if provided) */}
          {currentMessage?.speaker && (
            <div
              className="dialog-speaker"
              style={{
                position: 'absolute',
                top: -dimensions.paddingPx - (TILE_SIZE * zoom),
                left: dimensions.paddingPx,
                fontFamily: "'Pokemon Emerald', monospace",
                fontSize: `${config.fontSizeBase * zoom}px`,
                color: config.textColor,
                textShadow: `1px 1px 0 ${config.shadowColor}`,
              }}
            >
              {currentMessage.speaker}
            </div>
          )}

          {/* Main text */}
          {currentMessage && (
            <DialogText
              text={currentMessage.text}
              charIndex={charIndex}
              config={config}
              zoom={zoom}
            />
          )}

          {/* Continue arrow */}
          <DialogArrow
            visible={showArrow}
            zoom={zoom}
            color={config.textColor}
          />
        </div>
      </DialogFrame>

      {/* Option menu (Yes/No, multichoice) */}
      {showOptions && options && onSelect && onConfirm && (
        <OptionMenu
          options={options}
          selectedIndex={selectedIndex}
          config={config}
          zoom={zoom}
          onSelect={onSelect}
          onConfirm={onConfirm}
        />
      )}
    </div>
  );
};

export default DialogBox;

/**
 * DialogBox - Main dialog box component
 *
 * Renders the complete Pokemon Emerald style dialog:
 * - 9-slice frame
 * - Text with typewriter effect
 * - Continuation arrow
 * - Yes/No or choice menu when needed
 *
 * Positioned at bottom of viewport, centered horizontally.
 */

import React from 'react';
import { useDialogContext } from './DialogContext';
import { DialogFrame } from './DialogFrame';
import { DialogText, DialogArrow } from './DialogText';
import { YesNoMenu, OptionMenu } from './OptionMenu';
import { DIALOG_DIMENSIONS, YESNO_DIMENSIONS, TILE_SIZE, TEXT_SPECS, tilesToPx } from './types';

interface DialogBoxProps {
  /** Viewport width in pixels */
  viewportWidth: number;
  /** Viewport height in pixels */
  viewportHeight: number;
}

export const DialogBox: React.FC<DialogBoxProps> = ({
  viewportWidth,
  viewportHeight,
}) => {
  const context = useDialogContext();
  const { state, messages, options, config, zoom } = context;

  // Don't render if closed
  if (state.type === 'closed') {
    return null;
  }

  // Calculate dimensions
  // Dialog box dimensions
  const dialogWidth = tilesToPx(DIALOG_DIMENSIONS.widthTiles, zoom);
  const dialogHeight = tilesToPx(DIALOG_DIMENSIONS.heightTiles, zoom);

  // Position: centered horizontally, near bottom
  const dialogX = Math.floor((viewportWidth - dialogWidth) / 2);
  const dialogY = viewportHeight - dialogHeight - tilesToPx(DIALOG_DIMENSIONS.bottomOffsetTiles, zoom);

  // Get current message
  const currentMessage = messages[state.messageIndex] ?? { text: '' };

  // Line height for scroll offset calculation
  const lineHeight = TILE_SIZE * TEXT_SPECS.lineHeightMultiplier * zoom;

  // Compute scroll offset and display text for scrolling state
  let renderedText: string;
  let visibleChars: number;
  let scrollOffset = 0;

  if (state.type === 'scrolling') {
    // During scroll: just scroll the current 2 lines up.
    // Line 1 gets clipped at the top by overflow:hidden.
    // After FINISH_SCROLL, the next message starts with the carried line
    // already prefilled and the new line typewriters in.
    renderedText = currentMessage.text;
    visibleChars = renderedText.length;
    scrollOffset = state.scrollProgress * lineHeight;
  } else if (state.type === 'editing') {
    renderedText = `${currentMessage.text}\n${state.value}_`;
    visibleChars = renderedText.length;
  } else {
    renderedText = currentMessage.text;
    if (state.type === 'printing') {
      visibleChars = state.charIndex;
    } else {
      visibleChars = currentMessage.text.length;
    }
  }

  // Show arrow when waiting for input (not during choosing or scrolling)
  const showArrow = state.type === 'waiting' && !options;

  // Determine if we're showing a Yes/No menu
  const isYesNoMenu = options && options.choices.length === 2 &&
    options.choices[0].label === 'YES' &&
    options.choices[1].label === 'NO';

  // Get selected index for menu
  const selectedIndex = state.type === 'choosing' ? state.selectedIndex : 0;

  const menuGeometry = options ? (() => {
    const scaledTile = TILE_SIZE * zoom;
    const longestLabel = options.choices.reduce(
      (max, choice) => Math.max(max, choice.label.length),
      0
    );
    const widthTiles = Math.max(
      YESNO_DIMENSIONS.widthTiles,
      Math.ceil(longestLabel * 0.8) + 3
    );
    const heightTiles = Math.max(
      YESNO_DIMENSIONS.heightTiles,
      options.choices.length + 2
    );
    return {
      width: widthTiles * scaledTile,
      height: heightTiles * scaledTile,
    };
  })() : null;

  const menuStyle = (() => {
    if (!menuGeometry) {
      return undefined;
    }

    const inferredBirchGenderMenu = options?.choices.length === 2
      && options.choices[0]?.label === 'BOY'
      && options.choices[1]?.label === 'GIRL';
    if (inferredBirchGenderMenu) {
      const rawLeft = tilesToPx(3, zoom);
      const rawTop = tilesToPx(2, zoom);
      const left = Math.max(0, Math.min(rawLeft, viewportWidth - menuGeometry.width));
      const top = Math.max(0, Math.min(rawTop, viewportHeight - menuGeometry.height));
      return {
        position: 'absolute' as const,
        left,
        top,
        pointerEvents: 'auto' as const,
      };
    }

    const customPosition = options?.menuPosition
      ?? undefined;
    if (customPosition) {
      const rawLeft = Math.floor(viewportWidth * customPosition.leftRatio);
      const rawTop = Math.floor(viewportHeight * customPosition.topRatio);
      const left = Math.max(0, Math.min(rawLeft, viewportWidth - menuGeometry.width));
      const top = Math.max(0, Math.min(rawTop, viewportHeight - menuGeometry.height));
      return {
        position: 'absolute' as const,
        left,
        top,
        pointerEvents: 'auto' as const,
      };
    }

    return {
      position: 'absolute' as const,
      right: dialogX,
      top: dialogY - tilesToPx((options?.choices.length ?? 0) + 3, zoom),
      pointerEvents: 'auto' as const,
    };
  })();

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: viewportWidth,
        height: viewportHeight,
        pointerEvents: 'none', // Allow clicks to pass through overlay
        zIndex: 1000,
      }}
    >
      {/* Main dialog box */}
      <div
        style={{
          position: 'absolute',
          left: dialogX,
          top: dialogY,
          pointerEvents: 'auto',
        }}
      >
        <DialogFrame
          width={dialogWidth}
          height={dialogHeight}
          style={config.frameStyle}
          zoom={zoom}
        >
          <DialogText
            text={renderedText}
            visibleChars={visibleChars}
            zoom={zoom}
            color={config.textColor}
            shadowColor={config.shadowColor}
            fontFamily={config.fontFamily}
            scrollOffset={scrollOffset}
          />
          <DialogArrow visible={showArrow} zoom={zoom} />
        </DialogFrame>
      </div>

      {/* Option menu (if showing choices) */}
      {state.type === 'choosing' && options && (
        <div style={menuStyle}>
          {isYesNoMenu ? (
            <YesNoMenu
              selectedYes={selectedIndex === 0}
              frameStyle={config.frameStyle}
              zoom={zoom}
              textColor={config.textColor}
              shadowColor={config.shadowColor}
            />
          ) : (
            <OptionMenu
              choices={options.choices}
              selectedIndex={selectedIndex}
              frameStyle={config.frameStyle}
              zoom={zoom}
              textColor={config.textColor}
              shadowColor={config.shadowColor}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DialogBox;

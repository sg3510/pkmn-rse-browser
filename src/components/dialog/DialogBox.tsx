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
import { DIALOG_DIMENSIONS, tilesToPx } from './types';

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

  // Calculate visible characters for typewriter effect
  let visibleChars = currentMessage.text.length;
  if (state.type === 'printing') {
    visibleChars = state.charIndex;
  }

  // Show arrow when waiting for input (not during choosing)
  const showArrow = state.type === 'waiting' && !options;

  // Determine if we're showing a Yes/No menu
  const isYesNoMenu = options && options.choices.length === 2 &&
    options.choices[0].label === 'YES' &&
    options.choices[1].label === 'NO';

  // Get selected index for menu
  const selectedIndex = state.type === 'choosing' ? state.selectedIndex : 0;

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
            text={currentMessage.text}
            visibleChars={visibleChars}
            zoom={zoom}
            color={config.textColor}
            shadowColor={config.shadowColor}
            fontFamily={config.fontFamily}
          />
          <DialogArrow visible={showArrow} zoom={zoom} />
        </DialogFrame>
      </div>

      {/* Option menu (if showing choices) */}
      {state.type === 'choosing' && options && (
        <div
          style={{
            position: 'absolute',
            // Position above dialog box, right-aligned
            right: dialogX,
            top: dialogY - tilesToPx(options.choices.length + 3, zoom),
            pointerEvents: 'auto',
          }}
        >
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

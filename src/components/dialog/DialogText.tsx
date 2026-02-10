/**
 * DialogText - Text renderer with typewriter effect
 *
 * Renders text with Pokemon Emerald style:
 * - Character-by-character reveal (typewriter effect)
 * - 1px shadow offset (does NOT scale with zoom)
 * - Proper line wrapping at tile boundaries
 * - Support for \n newlines
 */

import React, { useMemo } from 'react';
import { TILE_SIZE, TEXT_SPECS } from './types';

interface DialogTextProps {
  /** Full text to display */
  text: string;
  /** Number of characters to show (for typewriter effect) */
  visibleChars: number;
  /** Zoom level */
  zoom?: number;
  /** Text color */
  color?: string;
  /** Shadow color */
  shadowColor?: string;
  /** Font family */
  fontFamily?: string;
  /** Maximum width in pixels (for line wrapping calculation) */
  maxWidth?: number;
  /** Vertical scroll offset in pixels (for scroll animation) */
  scrollOffset?: number;
}

export const DialogText: React.FC<DialogTextProps> = ({
  text,
  visibleChars,
  zoom = 1,
  color = '#303030',
  shadowColor = '#a8a8a8',
  fontFamily = '"Pokemon Emerald", "Pokemon RS", monospace',
  maxWidth,
  scrollOffset = 0,
}) => {
  // Calculate font size (base 8px scaled by zoom)
  const fontSize = TEXT_SPECS.fontSizePx * zoom;
  // Line height: 2 tiles per line (16px at 1x)
  const lineHeight = TILE_SIZE * TEXT_SPECS.lineHeightMultiplier * zoom;

  // Shadow offset is ALWAYS 1px - this is crucial for pixel-perfect rendering
  // GBA text shadow doesn't scale, it's always 1 pixel offset
  const shadowOffset = 1;

  // Get the visible portion of text
  const visibleText = useMemo(() => {
    return text.substring(0, visibleChars);
  }, [text, visibleChars]);

  // Split into lines for rendering
  const lines = useMemo(() => {
    return visibleText.split('\n');
  }, [visibleText]);

  return (
    <div
      style={{
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}px`,
        color: color,
        textShadow: `${shadowOffset}px ${shadowOffset}px 0 ${shadowColor}`,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        // Prevent text selection during dialog
        userSelect: 'none',
        // Pixel-perfect text rendering
        WebkitFontSmoothing: 'none',
        textRendering: 'optimizeSpeed',
        imageRendering: 'pixelated',
        maxWidth: maxWidth ? `${maxWidth}px` : undefined,
        // Scroll animation offset — translateY shifts text up during scroll
        transform: scrollOffset ? `translateY(-${scrollOffset}px)` : undefined,
      }}
    >
      {lines.map((line, index) => (
        <div key={index}>
          {line || '\u00A0'} {/* Non-breaking space for empty lines */}
        </div>
      ))}
    </div>
  );
};

/**
 * Continuation arrow component (bouncing down arrow)
 * Shown when text is complete and waiting for input
 */
interface DialogArrowProps {
  /** Zoom level */
  zoom?: number;
  /** Whether arrow is visible */
  visible: boolean;
}

export const DialogArrow: React.FC<DialogArrowProps> = ({
  zoom = 1,
  visible,
}) => {
  if (!visible) return null;

  const size = TILE_SIZE * zoom;

  return (
    <div
      style={{
        position: 'absolute',
        right: TILE_SIZE * zoom,
        bottom: TILE_SIZE * 0.5 * zoom,
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'dialogArrowBounce 0.5s ease-in-out infinite',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 8 8"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Simple down arrow - 8x8 pixel art style */}
        <path
          d="M1 2 L4 5 L7 2 L7 4 L4 7 L1 4 Z"
          fill="#303030"
        />
      </svg>
    </div>
  );
};

// CSS for font and arrow animation (inject into document)
const dialogCSS = `
@font-face {
  font-family: 'Pokemon Emerald';
  src: url('/fonts/pokemon-emerald.otf') format('opentype'),
       url('/fonts/pokemon-emerald-pro.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Pokemon RS';
  src: url('/fonts/pokemon-rs.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'PKMN RSEU';
  src: url('/fonts/PKMNRSEU.FON') format('truetype'); 
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@keyframes dialogArrowBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(2px); }
}
`;

// Inject CSS once
if (typeof document !== 'undefined') {
  const styleId = 'dialog-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = dialogCSS;
    document.head.appendChild(style);
  }
}

export default DialogText;

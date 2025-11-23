import React from 'react';
import type { DialogConfig } from './types';

interface DialogTextProps {
  text: string;
  charIndex: number;          // Current visible character count (-1 for all)
  config: DialogConfig;
  zoom: number;
  linesVisible?: number;      // Override config.linesVisible
}

/**
 * DialogText - Renders text with typewriter effect
 *
 * Handles:
 * - Character-by-character reveal
 * - Line wrapping and overflow (shows last N lines)
 * - Text shadow for authentic Pokemon style
 */
export const DialogText: React.FC<DialogTextProps> = ({
  text,
  charIndex,
  config,
  zoom,
  linesVisible,
}) => {
  // Get visible text based on char index
  const isComplete = charIndex < 0 || charIndex >= text.length;
  const visibleText = isComplete ? text : text.slice(0, charIndex);

  // Split into lines
  const allLines = visibleText.split('\n');

  // Only show last N lines if we have more
  const maxLines = linesVisible ?? config.linesVisible;
  const displayLines = allLines.length > maxLines
    ? allLines.slice(-maxLines)
    : allLines;

  // Calculate font size based on zoom
  const fontSize = config.fontSizeBase * zoom;
  const lineHeight = config.fontSizeBase * config.lineHeightMultiplier * zoom;
  const shadowOffset = Math.max(1, Math.floor(zoom));

  return (
    <div
      className="dialog-text"
      style={{
        fontFamily: "'Pokemon Emerald', monospace",
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}px`,
        color: config.textColor,
        textShadow: `${shadowOffset}px ${shadowOffset}px 0 ${config.shadowColor}`,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'hidden',
        imageRendering: 'pixelated',
        // Prevent text selection during dialog
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {displayLines.map((line, i) => (
        <div key={i} style={{ minHeight: lineHeight }}>
          {line || '\u00A0' /* Non-breaking space for empty lines */}
        </div>
      ))}
    </div>
  );
};

export default DialogText;

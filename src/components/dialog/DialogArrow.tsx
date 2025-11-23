import React, { useState, useEffect } from 'react';

interface DialogArrowProps {
  visible: boolean;
  zoom: number;
  color?: string;
}

/**
 * DialogArrow - Animated down arrow indicating more text
 *
 * Bounces up and down in a 4-frame animation cycle.
 * Based on pokeemerald's down_arrow.png animation.
 */
export const DialogArrow: React.FC<DialogArrowProps> = ({
  visible,
  zoom,
  color = '#303030',
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!visible) {
      setFrame(0);
      return;
    }

    // 4-frame animation: 0 -> 1 -> 2 -> 1 -> repeat
    // Each frame lasts ~125ms (8 frames at 60fps)
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 4);
    }, 125);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  // Y offsets for bounce animation (in base pixels)
  const yOffsets = [0, 1, 2, 1];
  const yOffset = yOffsets[frame] * zoom;

  // Arrow size scales with zoom
  const size = 8 * zoom;

  return (
    <div
      className="dialog-arrow"
      style={{
        position: 'absolute',
        right: 8 * zoom,
        bottom: 4 * zoom,
        transform: `translateY(${yOffset}px)`,
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${size}px`,
        lineHeight: 1,
        color,
        pointerEvents: 'none',
        imageRendering: 'pixelated',
      }}
    >
      {/* Unicode down-pointing triangle */}
      <span style={{
        display: 'block',
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
      }}>
        {'\u25BC'}
      </span>
    </div>
  );
};

export default DialogArrow;

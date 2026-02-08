/**
 * Bag Menu Component
 *
 * GBA-style bag menu with animated bag image, pocket tabs, and item list.
 * Uses design system CSS variables for sizing.
 *
 * SPRITE REFERENCE (see docs/features/menu/assets-reference.md):
 * - bag-icon-pockets.png: 472×61, 8 frames × 59px (positions: frame * 59)
 * - bag-icons.png: 208×52, 8 cols × 2 rows × 26px (positions: col * 26)
 */

import { useState, useCallback, useMemo } from 'react';
import { useMenuInput } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import { bagManager } from '../../game/BagManager';
import { getItemName, getItemIconPath, getItemDescription } from '../../data/items';
import type { BagState } from '../../save/types';
import '../styles/bag-menu.css';

type PocketType = keyof BagState;

interface PocketConfig {
  id: PocketType;
  label: string;
  bagFrame: number;  // Frame index in bag-icon-pockets.png (0-7)
  iconIndex: number; // Column index in bag-icons.png (0-7)
}

/**
 * Pocket configurations
 * bag-icon-pockets.png frames: 0=items, 1=medicine, 2=pokeballs, 3=tm/hm, 4=berries, 5=mail, 6=special, 7=key
 * bag-icons.png columns: same order as above
 */
const POCKETS: PocketConfig[] = [
  { id: 'items', label: 'ITEMS', bagFrame: 0, iconIndex: 0 },
  { id: 'keyItems', label: 'KEY ITEMS', bagFrame: 7, iconIndex: 7 },
  { id: 'pokeBalls', label: 'POKé BALLS', bagFrame: 2, iconIndex: 2 },
  { id: 'tmHm', label: 'TMs & HMs', bagFrame: 3, iconIndex: 3 },
  { id: 'berries', label: 'BERRIES', bagFrame: 4, iconIndex: 4 },
];

// Native sprite sizes (CSS handles scaling)
const BAG_FRAME_WIDTH = 59;  // bag-icon-pockets.png frame width
const ICON_NATIVE_SIZE = 26; // bag-icons.png icon size

export function BagMenu({ isEmbedded = true }: { isEmbedded?: boolean }) {
  const [currentPocket, setCurrentPocket] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number[]>([0, 0, 0, 0, 0]);
  const [scrollPosition, setScrollPosition] = useState<number[]>([0, 0, 0, 0, 0]);

  const MAX_VISIBLE_ITEMS = 6;

  // Get bag state
  const bagState = useMemo(() => bagManager.getBagState(), []);
  const pocket = POCKETS[currentPocket];
  const items = bagState[pocket.id];
  const cursor = cursorPosition[currentPocket];
  const scroll = scrollPosition[currentPocket];
  const selectedItem = items[cursor] ?? null;

  // Calculate visible items
  const visibleItems = useMemo(() => {
    return items.slice(scroll, scroll + MAX_VISIBLE_ITEMS);
  }, [items, scroll]);

  // Switch pocket with wrapping and shake animation
  const switchPocket = useCallback((delta: number) => {
    setCurrentPocket((prev) => {
      let next = prev + delta;
      if (next < 0) next = POCKETS.length - 1;
      if (next >= POCKETS.length) next = 0;
      return next;
    });
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }, []);

  // Move cursor with scroll adjustment
  const moveCursor = useCallback((delta: number) => {
    const currentCursor = cursorPosition[currentPocket];
    let newCursor = currentCursor + delta;

    if (newCursor < 0) newCursor = 0;
    if (newCursor >= items.length) newCursor = Math.max(0, items.length - 1);

    setCursorPosition((prev) => {
      const newPositions = [...prev];
      newPositions[currentPocket] = newCursor;
      return newPositions;
    });

    setScrollPosition((prev) => {
      const newScrolls = [...prev];
      const currentScroll = newScrolls[currentPocket];

      if (newCursor < currentScroll) {
        newScrolls[currentPocket] = newCursor;
      } else if (newCursor >= currentScroll + MAX_VISIBLE_ITEMS) {
        newScrolls[currentPocket] = newCursor - MAX_VISIBLE_ITEMS + 1;
      }

      return newScrolls;
    });
  }, [currentPocket, items.length, cursorPosition]);

  const handleClose = useCallback(() => {
    menuStateManager.back();
  }, []);

  const handleSelectItem = useCallback((index: number) => {
    setCursorPosition((prev) => {
      const newPos = [...prev];
      newPos[currentPocket] = scroll + index;
      return newPos;
    });
  }, [currentPocket, scroll]);

  // Keyboard input
  useMenuInput({
    onUp: () => moveCursor(-1),
    onDown: () => moveCursor(1),
    onLeft: () => switchPocket(-1),
    onRight: () => switchPocket(1),
    onCancel: handleClose,
    onConfirm: () => {
      if (selectedItem) {
        console.log('[BagMenu] Selected item:', getItemName(selectedItem.itemId));
      }
    },
    enabled: true,
  });

  // Calculate sprite positions using native sizes (CSS scales via background-size)
  const bagImageStyle = {
    backgroundPositionX: `${-pocket.bagFrame * BAG_FRAME_WIDTH}px`,
  };

  // Icon position uses native 26px size, CSS scales proportionally
  const getIconStyle = (iconIndex: number) => ({
    backgroundPositionX: `${-iconIndex * ICON_NATIVE_SIZE}px`,
  });

  const content = (
    <div className="bag-content">
      {/* Header row: bag image left, icons + name right */}
      <div className="bag-header">
        {/* Bag image */}
        <div className="bag-image-container">
          <div
            className={`bag-image ${isShaking ? 'bag-shake' : ''}`}
            style={bagImageStyle}
          />
        </div>

        {/* Icons and pocket name */}
        <div className="bag-header-right">
          {/* Pocket tabs - centered */}
          <div className="pocket-tabs">
            {POCKETS.map((p, i) => (
              <button
                key={p.id}
                className={`pocket-tab ${i === currentPocket ? 'active' : ''}`}
                onClick={() => {
                  if (i !== currentPocket) {
                    setCurrentPocket(i);
                    setIsShaking(true);
                    setTimeout(() => setIsShaking(false), 500);
                  }
                }}
                title={p.label}
              >
                <div
                  className={`pocket-tab-icon ${i === currentPocket ? 'selected' : ''}`}
                  style={getIconStyle(p.iconIndex)}
                />
              </button>
            ))}
          </div>
          {/* Pocket label - centered */}
          <div className="pocket-label">{pocket.label}</div>
        </div>
      </div>

      {/* Item list - full width */}
      <div className="bag-items">
        <div className="item-list">
          {items.length === 0 ? (
            <div className="empty-pocket">No items</div>
          ) : (
            visibleItems.map((item, i) => {
              const actualIndex = scroll + i;
              const isSelected = actualIndex === cursor;
              return (
                <div
                  key={`${item.itemId}-${actualIndex}`}
                  className={`item-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(i)}
                  onMouseEnter={() => handleSelectItem(i)}
                >
                  <img
                    className="item-icon"
                    src={getItemIconPath(item.itemId) ?? '/pokeemerald/graphics/items/icons/question_mark.png'}
                    alt=""
                  />
                  <span className="item-name">{getItemName(item.itemId)}</span>
                  <span className="item-quantity">×{item.quantity}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Scroll indicators */}
        {items.length > MAX_VISIBLE_ITEMS && (
          <div className="scroll-indicators">
            <span className={`scroll-arrow up ${scroll > 0 ? 'visible' : ''}`}>▲</span>
            <span className={`scroll-arrow down ${scroll + MAX_VISIBLE_ITEMS < items.length ? 'visible' : ''}`}>▼</span>
          </div>
        )}
      </div>

      {/* Description - full width */}
      <div className="bag-description">
        <div className="item-description">
          {selectedItem ? getItemDescription(selectedItem.itemId) : 'Select an item'}
        </div>
      </div>
    </div>
  );

  // BagMenu is now always embedded in MenuOverlay
  if (!isEmbedded) {
    console.warn('[BagMenu] Standalone mode deprecated, use MenuOverlay');
  }

  return content;
}

export default BagMenu;

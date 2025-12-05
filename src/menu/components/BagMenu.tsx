/**
 * Bag Menu Component
 *
 * GBA-style bag menu with animated bag image, pocket tabs, and item list.
 * Based on Pokemon Emerald's bag menu design.
 */

import { useState, useCallback, useMemo } from 'react';
import { useMenuInput } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import { bagManager } from '../../game/BagManager';
import { saveManager } from '../../save/SaveManager';
import { getItemName, getItemIconPath, getItemDescription } from '../../data/items';
import type { BagState } from '../../save/types';
import '../styles/bag-menu.css';

type PocketType = keyof BagState;

interface BagMenuProps {
  zoom?: number;
}

interface PocketConfig {
  id: PocketType;
  label: string;
  bagFrame: number; // Frame index in bag-icon-pockets.png (0-7)
  iconIndex: number; // Index in bag-icons.png
}

// Pocket configs with bag frame mappings
// bag-icon-pockets.png: 8 frames showing different pockets open
// 0=items, 1=medicine, 2=pokeballs, 3=tm/hm, 4=berries, 5=mail, 6=special, 7=key
const POCKETS: PocketConfig[] = [
  { id: 'items', label: 'ITEMS', bagFrame: 0, iconIndex: 0 },
  { id: 'keyItems', label: 'KEY ITEMS', bagFrame: 7, iconIndex: 7 },
  { id: 'pokeBalls', label: 'POKé BALLS', bagFrame: 2, iconIndex: 2 },
  { id: 'tmHm', label: 'TMs & HMs', bagFrame: 3, iconIndex: 3 },
  { id: 'berries', label: 'BERRIES', bagFrame: 4, iconIndex: 4 },
];

export function BagMenu({ zoom = 1 }: BagMenuProps) {
  const [currentPocket, setCurrentPocket] = useState<number>(0);
  const [isShaking, setIsShaking] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number[]>([0, 0, 0, 0, 0]);
  const [scrollPosition, setScrollPosition] = useState<number[]>([0, 0, 0, 0, 0]);

  const MAX_VISIBLE_ITEMS = 5;

  // Get bag state
  const bagState = useMemo(() => bagManager.getBagState(), []);
  const money = saveManager.getProfile().money ?? 0;

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
    // Trigger shake animation
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }, []);

  // Move cursor with scroll adjustment
  const moveCursor = useCallback(
    (delta: number) => {
      const currentCursor = cursorPosition[currentPocket];
      let newCursor = currentCursor + delta;

      // Clamp to valid range
      if (newCursor < 0) newCursor = 0;
      if (newCursor >= items.length) newCursor = Math.max(0, items.length - 1);

      // Update cursor
      setCursorPosition((prev) => {
        const newPositions = [...prev];
        newPositions[currentPocket] = newCursor;
        return newPositions;
      });

      // Adjust scroll if needed
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
    },
    [currentPocket, items.length, cursorPosition]
  );

  // Handle close
  const handleClose = useCallback(() => {
    menuStateManager.back();
  }, []);

  // Input handling
  useMenuInput({
    onUp: () => moveCursor(-1),
    onDown: () => moveCursor(1),
    onLeft: () => switchPocket(-1),
    onRight: () => switchPocket(1),
    onCancel: handleClose,
    onConfirm: () => {
      if (selectedItem) {
        console.log('[BagMenu] Selected item:', getItemName(selectedItem.itemId));
        // TODO: Show context menu
      }
    },
    enabled: true,
  });

  return (
    <div className="bag-menu-overlay" onClick={handleClose}>
      <div
        className="bag-menu"
        style={{ transform: `scale(${zoom})` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left side - Bag image */}
        <div className="bag-left">
          <div
            className={`bag-image ${isShaking ? 'bag-shake' : ''}`}
            style={{ backgroundPositionX: `${-pocket.bagFrame * 59}px` }}
          />
          <div className="pocket-label">{pocket.label}</div>
        </div>

        {/* Right side - Items */}
        <div className="bag-right">
          {/* Pocket tabs */}
          <div className="pocket-tabs">
            {POCKETS.map((p, i) => (
              <button
                key={p.id}
                className={`pocket-tab ${i === currentPocket ? 'active' : ''}`}
                onClick={() => setCurrentPocket(i)}
                title={p.label}
              >
                <div
                  className={`pocket-tab-icon ${i === currentPocket ? 'selected' : ''}`}
                  style={{ backgroundPositionX: `${-p.iconIndex * 18}px` }}
                />
              </button>
            ))}
          </div>

          {/* Item list */}
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
                    onClick={() => {
                      setCursorPosition((prev) => {
                        const newPos = [...prev];
                        newPos[currentPocket] = actualIndex;
                        return newPos;
                      });
                    }}
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

          {/* Scroll arrows */}
          {items.length > MAX_VISIBLE_ITEMS && (
            <div className="scroll-arrows">
              {scroll > 0 && <span className="arrow-up">▲</span>}
              {scroll + MAX_VISIBLE_ITEMS < items.length && <span className="arrow-down">▼</span>}
            </div>
          )}
        </div>

        {/* Bottom - Description */}
        <div className="bag-bottom">
          <div className="item-description">
            {selectedItem ? getItemDescription(selectedItem.itemId) : 'Select an item'}
          </div>
          <div className="bag-money">¥{money.toLocaleString()}</div>
        </div>

        {/* Controls hint */}
        <div className="bag-controls">
          <span>←→ Pocket</span>
          <span>↑↓ Select</span>
          <span>X Confirm</span>
          <span>Z Back</span>
        </div>
      </div>
    </div>
  );
}

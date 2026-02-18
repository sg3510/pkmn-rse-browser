/**
 * Start Menu Component
 *
 * Adaptive grid overlay menu that appears over the game map.
 * - Landscape viewports (e.g., GBA 240×160): 3 cols × 2 rows
 * - Portrait/square viewports: 2 cols × 3 rows
 * Accessible via Enter key or Menu button when in OVERWORLD.
 */

import { useCallback, useMemo } from 'react';
import { useMenuState, useMenuInput } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import { navigateGrid } from '../types';
import { gameFlags } from '../../game/GameFlags';
import { saveManager } from '../../save/SaveManager';
import '../styles/start-menu.css';

interface StartMenuProps {
  zoom?: number;
  viewport?: { width: number; height: number };
}

interface MenuTileData {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
  enabled: boolean;
  onSelect: () => void;
}

export function StartMenu({ zoom = 1, viewport = { width: 240, height: 160 } }: StartMenuProps) {
  const { cursorIndex, isOpen, currentMenu, data } = useMenuState();
  const onSaveToBrowser = data.onSaveToBrowser as (() => Promise<void> | void) | undefined;

  // Determine grid layout based on viewport aspect ratio
  // Landscape (wider than tall): 3 cols × 2 rows
  // Portrait/square: 2 cols × 3 rows
  const isLandscape = viewport.width > viewport.height;
  const gridCols = isLandscape ? 3 : 2;

  // Build menu tiles based on game flags
  const tiles = useMemo((): MenuTileData[] => {
    const hasPokedex = gameFlags.isSet('FLAG_SYS_POKEDEX_GET');
    const hasPokemon = gameFlags.isSet('FLAG_SYS_POKEMON_GET');

    return [
      {
        id: 'pokedex',
        label: 'POKéDEX',
        icon: 'pokedex',
        visible: true,
        enabled: hasPokedex,
        onSelect: () => {
          console.log('[StartMenu] Pokedex selected');
          // TODO: menuStateManager.open('pokedex');
        },
      },
      {
        id: 'pokemon',
        label: 'POKéMON',
        icon: 'pokemon',
        visible: true,
        enabled: hasPokemon,
        onSelect: () => {
          console.log('[StartMenu] Pokemon selected');
          menuStateManager.open('party');
        },
      },
      {
        id: 'bag',
        label: 'BAG',
        icon: 'bag',
        visible: true,
        enabled: true,
        onSelect: () => {
          console.log('[StartMenu] Bag selected');
          menuStateManager.open('bag', { ...data, mode: 'field' });
        },
      },
      {
        id: 'player',
        label: saveManager.getPlayerName(),
        icon: 'trainerCard',
        visible: true,
        enabled: true,
        onSelect: () => {
          console.log('[StartMenu] Trainer Card selected');
          menuStateManager.open('trainerCard');
        },
      },
      {
        id: 'save',
        label: 'SAVE',
        icon: 'save',
        visible: true,
        enabled: true,
        onSelect: () => {
          console.log('[StartMenu] Save selected');
          if (onSaveToBrowser) {
            menuStateManager.close();
            void Promise.resolve(onSaveToBrowser());
            return;
          }
          menuStateManager.open('save');
        },
      },
      {
        id: 'option',
        label: 'OPTION',
        icon: 'option',
        visible: true,
        enabled: true,
        onSelect: () => {
          console.log('[StartMenu] Options selected');
          menuStateManager.open('options');
        },
      },
    ];
  }, [data, onSaveToBrowser]);

  const visibleTiles = tiles.filter((t) => t.visible);
  const handleConfirm = useCallback(() => {
    const tile = visibleTiles[cursorIndex];
    if (tile?.enabled) {
      tile.onSelect();
    }
  }, [visibleTiles, cursorIndex]);

  const handleCancel = useCallback(() => {
    menuStateManager.close();
  }, []);

  const handleUp = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'up', gridCols, visibleTiles.length);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex, gridCols, visibleTiles.length]);

  const handleDown = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'down', gridCols, visibleTiles.length);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex, gridCols, visibleTiles.length]);

  const handleLeft = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'left', gridCols, visibleTiles.length);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex, gridCols, visibleTiles.length]);

  const handleRight = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'right', gridCols, visibleTiles.length);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex, gridCols, visibleTiles.length]);

  // Input handling
  useMenuInput({
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    onUp: handleUp,
    onDown: handleDown,
    onLeft: handleLeft,
    onRight: handleRight,
    enabled: isOpen && currentMenu === 'start',
  });

  if (!isOpen || currentMenu !== 'start') {
    return null;
  }

  // Grid class for CSS styling
  const gridClass = isLandscape ? 'start-menu-grid landscape' : 'start-menu-grid portrait';

  return (
    <div className="start-menu-overlay" onClick={handleCancel}>
      <div
        className={gridClass}
        style={{
          '--zoom': zoom,
          '--grid-cols': gridCols,
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        {visibleTiles.map((tile, index) => (
          <button
            key={tile.id}
            className={`menu-tile ${cursorIndex === index ? 'selected' : ''} ${
              !tile.enabled ? 'disabled' : ''
            }`}
            onClick={() => {
              if (tile.enabled) {
                menuStateManager.setCursor(index);
                tile.onSelect();
              }
            }}
            onMouseEnter={() => {
              if (tile.enabled) {
                menuStateManager.setCursor(index);
              }
            }}
            disabled={!tile.enabled}
          >
            <div className={`menu-tile-icon icon-${tile.icon}`} />
            <span className="menu-tile-label">{tile.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

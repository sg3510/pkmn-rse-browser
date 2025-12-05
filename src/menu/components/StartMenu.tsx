/**
 * Start Menu Component
 *
 * 2x3 grid overlay menu that appears over the game map.
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
}

interface MenuTileData {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
  enabled: boolean;
  onSelect: () => void;
}

export function StartMenu({ zoom = 1 }: StartMenuProps) {
  const { cursorIndex, isOpen, currentMenu } = useMenuState();

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
          menuStateManager.open('bag');
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
  }, []);

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
    const newIndex = navigateGrid(cursorIndex, 'up', 2, visibleTiles.length);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex, visibleTiles.length]);

  const handleDown = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'down', 2, visibleTiles.length);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex, visibleTiles.length]);

  const handleLeft = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'left', 2, visibleTiles.length);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex, visibleTiles.length]);

  const handleRight = useCallback(() => {
    const newIndex = navigateGrid(cursorIndex, 'right', 2, visibleTiles.length);
    menuStateManager.setCursor(newIndex);
  }, [cursorIndex, visibleTiles.length]);

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

  return (
    <div className="start-menu-overlay" onClick={handleCancel}>
      <div
        className="start-menu-grid"
        style={{ transform: `scale(${zoom})` }}
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

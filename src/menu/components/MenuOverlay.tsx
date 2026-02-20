/**
 * Menu Overlay Component
 *
 * Unified container for all menus. Renders ONE menu at a time,
 * switching content based on MenuStateManager. No stacking overlays.
 *
 * Design principles:
 * - Single overlay container that persists while any menu is open
 * - Content switches based on currentMenu, no nested overlays
 * - RESPONSIVE sizing: GBA viewport = fullscreen, larger = up to 21×16 tiles with padding
 * - Content scales with zoom via --zoom CSS variable
 * - Switching menus does NOT change container size
 */

import { useMenuState } from '../hooks/useMenuState';
import {
  menuStateManager,
  type AnyMenuData,
  getMenuDataFor,
  type MenuType,
} from '../MenuStateManager';
import { useDialogContext } from '../../components/dialog/DialogContext';
import { useMenuLayout } from '../hooks/useMenuLayout';
import { StartMenu } from './StartMenu';
import { BagMenu } from './BagMenu';
import { PartyMenuContent } from './PartyMenuContent';
import { PokemonSummaryContent } from './PokemonSummaryContent';
import { MoveForgetMenuContent } from './MoveForgetMenuContent';
import '../styles/menu-overlay.css';

export function MenuOverlay() {
  const { isOpen, currentMenu, data } = useMenuState();
  const dialogContext = useDialogContext();
  const zoom = dialogContext?.zoom ?? 1;
  const viewport = dialogContext?.viewport ?? { width: 240, height: 160 };

  // Calculate responsive menu layout based on viewport
  const layout = useMenuLayout({ viewport, zoom });

  if (!isOpen || !currentMenu) {
    return null;
  }

  // Start menu is a small popup, not fullscreen
  if (currentMenu === 'start') {
    return <StartMenu zoom={zoom} viewport={viewport} />;
  }

  // Set CSS variables for responsive sizing
  // --zoom: scale factor for transform
  // --menu-width/height: native pixel dimensions (before zoom)
  const containerStyle = {
    '--zoom': zoom,
    '--menu-width': `${layout.menuWidth}px`,
    '--menu-height': `${layout.menuHeight}px`,
  } as React.CSSProperties;

  // Container classes
  const containerClasses = [
    'menu-container',
    layout.isFullscreen ? 'menu-container--fullscreen' : '',
  ].filter(Boolean).join(' ');
  const showBackButton = currentMenu !== 'moveForget';

  // All other menus use the unified fullscreen container
  return (
    <div className="menu-overlay" onClick={() => menuStateManager.back()}>
      <div
        className={containerClasses}
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Back button - corner triangle, consistent across all menus */}
        {showBackButton ? (
          <button
            className="menu-back-btn"
            onClick={() => menuStateManager.back()}
            title="Back (B)"
            aria-label="Back"
          />
        ) : null}

        {/* Menu content - switches based on currentMenu */}
        <MenuContent
          currentMenu={currentMenu}
          data={data}
        />
      </div>
    </div>
  );
}

interface MenuContentProps {
  currentMenu: MenuType;
  data: AnyMenuData;
}

function MenuContent({ currentMenu, data }: MenuContentProps) {
  switch (currentMenu) {
    case 'bag':
      return <BagMenu />;

    case 'party':
      return <PartyMenuContent />;

    case 'moveForget':
      return <MoveForgetMenuContent />;

    case 'pokemonSummary': {
      const summaryData = getMenuDataFor({ currentMenu, data }, 'pokemonSummary');
      const pokemon = summaryData?.pokemon;
      const partyIndex = summaryData?.partyIndex;
      if (!pokemon) {
        return <div className="menu-placeholder">No Pokemon selected</div>;
      }
      return <PokemonSummaryContent pokemon={pokemon} partyIndex={partyIndex} />;
    }

    case 'trainerCard':
      return <PlaceholderContent title="TRAINER CARD" />;

    case 'save':
      return <PlaceholderContent title="SAVE" />;

    case 'options':
      return <PlaceholderContent title="OPTIONS" />;

    case 'pokedex':
      return <PlaceholderContent title="POKéDEX" />;

    default:
      return <PlaceholderContent title={currentMenu.toUpperCase()} />;
  }
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <div className="menu-placeholder">
      <h2>{title}</h2>
      <p>Coming soon...</p>
    </div>
  );
}

export default MenuOverlay;

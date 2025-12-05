/**
 * Menu Overlay Component
 *
 * Renders the appropriate menu based on current menu state.
 * Respects zoom level from DialogContext for consistent scaling.
 */

import { useMenuState } from '../hooks/useMenuState';
import { menuStateManager } from '../MenuStateManager';
import { useDialogContext } from '../../components/dialog/DialogContext';
import { StartMenu } from './StartMenu';
import { BagMenu } from './BagMenu';
// Future imports:
// import { PartyMenu } from './PartyMenu';
// import { TrainerCard } from './TrainerCard';
// import { SaveMenu } from './SaveMenu';
// import { OptionsMenu } from './OptionsMenu';

interface MenuProps {
  zoom: number;
}

function PlaceholderMenu({ title, zoom }: { title: string; zoom: number }) {
  return (
    <div className="menu-overlay" onClick={() => menuStateManager.back()}>
      <div
        className="placeholder-menu"
        style={{ transform: `scale(${zoom})` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>Coming soon...</p>
        <button onClick={() => menuStateManager.back()}>Back</button>
      </div>
    </div>
  );
}

export function MenuOverlay() {
  const { isOpen, currentMenu } = useMenuState();
  const dialogContext = useDialogContext();
  const zoom = dialogContext?.zoom ?? 1;

  if (!isOpen) {
    return null;
  }

  // Render the appropriate menu component
  switch (currentMenu) {
    case 'start':
      return <StartMenu zoom={zoom} />;

    case 'bag':
      return <BagMenu zoom={zoom} />;

    case 'party':
      return <PlaceholderMenu title="POKéMON" zoom={zoom} />;

    case 'trainerCard':
      return <PlaceholderMenu title="TRAINER CARD" zoom={zoom} />;

    case 'save':
      return <PlaceholderMenu title="SAVE" zoom={zoom} />;

    case 'options':
      return <PlaceholderMenu title="OPTIONS" zoom={zoom} />;

    default:
      return null;
  }
}

// Placeholder styles
const placeholderStyle = `
.menu-overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.placeholder-menu {
  background: var(--menu-window-bg, #3890f8);
  border: 4px solid var(--menu-window-border, #f8f8f8);
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  color: white;
  font-family: 'Pokemon Emerald', monospace;
  transform-origin: center;
}

.placeholder-menu h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.placeholder-menu p {
  margin: 0 0 16px;
  opacity: 0.8;
}

.placeholder-menu button {
  background: white;
  border: none;
  padding: 8px 24px;
  border-radius: 4px;
  font-family: inherit;
  font-weight: bold;
  cursor: pointer;
}

.placeholder-menu button:hover {
  background: #e8e8e8;
}
`;

// Inject placeholder styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = placeholderStyle;
  document.head.appendChild(styleEl);
}

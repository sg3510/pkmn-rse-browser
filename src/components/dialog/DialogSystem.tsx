import React from 'react';
import { DialogProvider, useDialogContext } from './DialogContext';
import { DialogBox } from './DialogBox';
import { DialogDemo } from './DialogDemo';
import type { DialogConfig } from './types';
import './dialog.css';

interface DialogSystemProps {
  children: React.ReactNode;
  config?: Partial<DialogConfig>;
  zoom?: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * DialogSystemInner - Renders the dialog UI
 * Must be inside DialogProvider to access context
 */
const DialogSystemInner: React.FC<{
  viewportWidth: number;
  viewportHeight: number;
  enableDemo?: boolean;
}> = ({ viewportWidth, viewportHeight, enableDemo = true }) => {
  const { state, messages, options, config, zoom, _dispatch, _setResolve, _getResolve } = useDialogContext();

  const isOpen = state.type !== 'closed';

  // Callbacks for mouse interaction
  const handleAdvance = () => {
    if (state.type === 'printing') {
      _dispatch({ type: 'COMPLETE_TEXT' });
    } else if (state.type === 'waiting') {
      _dispatch({ type: 'NEXT_MESSAGE' });
    }
  };

  const handleSelect = (index: number) => {
    _dispatch({ type: 'SELECT_OPTION', index });
  };

  const handleConfirm = () => {
    console.log('[DIALOG] handleConfirm called, state:', state.type, 'options:', !!options);
    // Resolve the promise with the selected value before closing
    if (state.type === 'choosing' && options) {
      const selectedChoice = options.choices[state.selectedIndex];
      const resolve = _getResolve(); // Get current resolve function
      console.log('[DIALOG] selectedChoice:', selectedChoice, '_resolve:', !!resolve);
      if (selectedChoice && !selectedChoice.disabled) {
        if (resolve) {
          console.log('[DIALOG] Resolving with:', selectedChoice.value);
          resolve(selectedChoice.value);
          _setResolve(null);
        } else {
          console.log('[DIALOG] WARNING: _resolve is null!');
        }
      }
    }
    _dispatch({ type: 'CONFIRM_OPTION' });
  };

  return (
    <>
      {/* Demo trigger (press T to test) - only in dev or when enabled */}
      {enableDemo && <DialogDemo />}

      <div
        className={`dialog-system ${isOpen ? 'open' : ''}`}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          zIndex: 1000,
        }}
      >
        {/* Optional backdrop for visual focus */}
        {isOpen && (
          <div
            className="dialog-backdrop"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'transparent',
              // Uncomment for dim effect:
              // background: 'rgba(0, 0, 0, 0.1)',
            }}
          />
        )}

        {/* Dialog box */}
        <DialogBox
          state={state}
          messages={messages}
          options={options}
          config={config}
          zoom={zoom}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
          onAdvance={handleAdvance}
          onSelect={handleSelect}
          onConfirm={handleConfirm}
        />
      </div>
    </>
  );
};

/**
 * DialogSystem - Complete dialog system wrapper
 *
 * Wrap your game content with this component to enable dialogs.
 * The dialog will render inside the viewport area, scaled appropriately.
 *
 * Usage:
 * ```tsx
 * <DialogSystem
 *   zoom={zoom}
 *   viewportWidth={canvasWidth}
 *   viewportHeight={canvasHeight}
 *   config={{ frameStyle: 1, textSpeed: 'medium' }}
 * >
 *   <YourGameContent />
 * </DialogSystem>
 * ```
 */
export const DialogSystem: React.FC<DialogSystemProps> = ({
  children,
  config,
  zoom = 1,
  viewportWidth,
  viewportHeight,
}) => {
  return (
    <DialogProvider config={config} zoom={zoom}>
      <div
        className="dialog-system-container"
        style={{
          position: 'relative',
          width: viewportWidth,
          height: viewportHeight,
          overflow: 'hidden',
        }}
      >
        {children}
        <DialogSystemInner
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
        />
      </div>
    </DialogProvider>
  );
};

// Re-export hooks and types for convenience
export { useDialog } from './DialogContext';
export type { DialogConfig, DialogMessage, DialogChoice, DialogOptions } from './types';
export { DEFAULT_DIALOG_CONFIG } from './types';

export default DialogSystem;

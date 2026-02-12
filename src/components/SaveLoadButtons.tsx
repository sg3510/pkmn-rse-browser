/**
 * SaveLoadButtons Component
 *
 * Provides Save and Load buttons for the game UI.
 * - Save: Opens dropdown with "Save to Browser", "Export .json"
 * - Load: Opens file picker for .json or .sav files
 */

import { useCallback, useRef, useState } from 'react';
import { saveManager } from '../save/SaveManager';
import type { LocationState } from '../save/types';
import type { ObjectEventRuntimeState } from '../types/objectEvents';

interface SaveLoadButtonsProps {
  /** Whether the game is ready for saving (in overworld, player loaded) */
  canSave: boolean;
  /** Get current location state for saving */
  getLocationState: () => LocationState | null;
  /** Get current object-event runtime state for saving */
  getObjectEventRuntimeState?: () => ObjectEventRuntimeState | null;
  /** Callback after successful save */
  onSave?: () => void;
  /** Callback after successful load */
  onLoad?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export function SaveLoadButtons({
  canSave,
  getLocationState,
  getObjectEventRuntimeState,
  onSave,
  onLoad,
  onError,
}: SaveLoadButtonsProps) {
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle save to browser
  const handleSaveToBrowser = useCallback(() => {
    setShowSaveMenu(false);

    if (!canSave) {
      onError?.('Cannot save in current state');
      return;
    }

    const locationState = getLocationState();
    if (!locationState) {
      onError?.('No location data to save');
      return;
    }

    setSaveStatus('saving');
    const runtimeState = getObjectEventRuntimeState?.() ?? undefined;
    const result = saveManager.save(0, locationState, runtimeState);

    if (result.success) {
      setSaveStatus('success');
      onSave?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
      onError?.(result.error ?? 'Save failed');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [canSave, getLocationState, getObjectEventRuntimeState, onSave, onError]);

  // Handle export to JSON
  const handleExportJson = useCallback(() => {
    setShowSaveMenu(false);

    // When gameplay is in a saveable state, capture current runtime state
    // before exporting so the file reflects latest map/flags/vars.
    if (canSave) {
      const locationState = getLocationState();
      if (!locationState) {
        onError?.('No location data to export');
        return;
      }

      const runtimeState = getObjectEventRuntimeState?.() ?? undefined;
      const snapshotResult = saveManager.save(0, locationState, runtimeState);
      if (!snapshotResult.success) {
        onError?.(snapshotResult.error ?? 'Failed to capture current state before export');
        return;
      }
    }

    const result = saveManager.exportToFile(0);
    if (!result.success) {
      onError?.(result.error ?? 'Export failed');
    }
  }, [canSave, getLocationState, getObjectEventRuntimeState, onError]);

  // Handle file input change (load)
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await saveManager.importFromFile(file, 0);

    if (result.success) {
      onLoad?.();
    } else {
      onError?.(result.error ?? 'Import failed');
    }

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onLoad, onError]);

  // Handle load button click
  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Status indicator
  const getStatusColor = () => {
    switch (saveStatus) {
      case 'saving': return '#ffcc00';
      case 'success': return '#44cc44';
      case 'error': return '#ff4444';
      default: return 'transparent';
    }
  };

  const buttonStyle: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: 11,
    background: '#2a3a4a',
    color: '#9fb0cc',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    position: 'relative',
  };

  const buttonHoverStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#3a4a5a',
  };

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: '#1a2a3a',
    border: '1px solid #4a5a6a',
    borderRadius: 4,
    padding: 4,
    zIndex: 100,
    minWidth: 140,
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    fontSize: 11,
    background: 'transparent',
    color: '#9fb0cc',
    border: 'none',
    borderRadius: 2,
    cursor: 'pointer',
    textAlign: 'left',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      {/* Status indicator */}
      {saveStatus !== 'idle' && (
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: getStatusColor(),
          animation: saveStatus === 'saving' ? 'pulse 1s infinite' : undefined,
        }} />
      )}

      {/* Save button with dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          style={buttonStyle}
          onClick={() => setShowSaveMenu(!showSaveMenu)}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
          disabled={!canSave && saveStatus === 'idle'}
          title={canSave ? 'Save game' : 'Cannot save in current state'}
        >
          Save
        </button>

        {showSaveMenu && (
          <div style={menuStyle}>
            <button
              style={menuItemStyle}
              onClick={handleSaveToBrowser}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2a3a4a'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Save to Browser
            </button>
            <button
              style={menuItemStyle}
              onClick={handleExportJson}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2a3a4a'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Export .json
            </button>
            <button
              style={{ ...menuItemStyle, color: '#666', cursor: 'not-allowed' }}
              disabled
              title="Coming soon"
            >
              Export .sav
            </button>
          </div>
        )}
      </div>

      {/* Load button */}
      <button
        style={buttonStyle}
        onClick={handleLoadClick}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
        title="Load .json or .sav file"
      >
        Load
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.sav"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Click outside to close menu */}
      {showSaveMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99,
          }}
          onClick={() => setShowSaveMenu(false)}
        />
      )}
    </div>
  );
}

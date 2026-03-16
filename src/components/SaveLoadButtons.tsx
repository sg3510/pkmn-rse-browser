/**
 * SaveLoadButtons Component
 *
 * Provides Save and Load buttons for the game UI.
 * - Save: Opens dropdown with "Save to Browser", "Export .json"
 * - Load: Opens dropdown with sample saves + "Load from File"
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveManager } from '../save/SaveManager';
import type { LocationState } from '../save/types';
import type { ObjectEventRuntimeState } from '../types/objectEvents';

interface SampleSave {
  file: string;
  name: string;
  description: string;
}

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
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [sampleSaves, setSampleSaves] = useState<SampleSave[]>([]);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch sample save manifest once
  useEffect(() => {
    const base = import.meta.env.BASE_URL ?? '/';
    fetch(`${base}sample_save/manifest.json`)
      .then((res) => res.json())
      .then((data: SampleSave[]) => setSampleSaves(data))
      .catch(() => { /* manifest not available, no sample saves shown */ });
  }, []);

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

  // Handle file input change (load from file)
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await saveManager.importFromFile(file, 0);

    if (result.success) {
      onLoad?.();
    } else {
      onError?.(result.error ?? 'Import failed');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onLoad, onError]);

  // Handle "Load from File" click
  const handleLoadFromFile = useCallback(() => {
    setShowLoadMenu(false);
    fileInputRef.current?.click();
  }, []);

  // Handle loading a sample save
  const handleLoadSample = useCallback(async (sample: SampleSave) => {
    setLoadingSample(sample.file);
    try {
      const base = import.meta.env.BASE_URL ?? '/';
      const res = await fetch(`${base}sample_save/${sample.file}`);
      if (!res.ok) {
        onError?.(`Failed to fetch ${sample.name}`);
        return;
      }
      const text = await res.text();
      const result = saveManager.importFromJson(text, 0);
      if (result.success) {
        onLoad?.();
      } else {
        onError?.(result.error ?? 'Import failed');
      }
    } catch {
      onError?.(`Failed to load ${sample.name}`);
    } finally {
      setLoadingSample(null);
      setShowLoadMenu(false);
    }
  }, [onLoad, onError]);

  // Close any open menu
  const closeMenus = useCallback(() => {
    setShowSaveMenu(false);
    setShowLoadMenu(false);
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
          className="header-btn"
          onClick={() => { setShowLoadMenu(false); setShowSaveMenu(!showSaveMenu); }}
          disabled={!canSave && saveStatus === 'idle'}
          title={canSave ? 'Save game' : 'Cannot save in current state'}
        >
          Save
        </button>

        {showSaveMenu && (
          <div className="header-dropdown">
            <button className="header-dropdown__item" onClick={handleSaveToBrowser}>
              Save to Browser
            </button>
            <button className="header-dropdown__item" onClick={handleExportJson}>
              Export .json
            </button>
            <button className="header-dropdown__item" disabled title="Coming soon">
              Export .sav
            </button>
          </div>
        )}
      </div>

      {/* Load button with dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          className="header-btn"
          onClick={() => { setShowSaveMenu(false); setShowLoadMenu(!showLoadMenu); }}
          title="Load a save file"
        >
          Load
        </button>

        {showLoadMenu && (
          <div className="header-dropdown header-dropdown--right">
            <button className="header-dropdown__item" onClick={handleLoadFromFile}>
              Load from File...
            </button>
            {sampleSaves.length > 0 && (
              <>
                <div className="header-dropdown__divider" />
                <div className="header-dropdown__heading">Sample Saves</div>
                {sampleSaves.map((sample) => (
                  <button
                    key={sample.file}
                    className="header-dropdown__item"
                    onClick={() => void handleLoadSample(sample)}
                    disabled={loadingSample !== null}
                  >
                    <span className="header-dropdown__item-name">{sample.name}</span>
                    <span className="header-dropdown__item-desc">{sample.description}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.sav"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Click outside to close menus */}
      {(showSaveMenu || showLoadMenu) && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99,
          }}
          onClick={closeMenus}
        />
      )}
    </div>
  );
}

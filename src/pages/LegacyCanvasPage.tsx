/**
 * Legacy Canvas Page
 *
 * Original Canvas 2D renderer. Kept for compatibility testing
 * and as a fallback for browsers without WebGL2 support.
 *
 * Access via /#/legacy
 */

import { useMemo, useState, useRef, useCallback, type ChangeEvent } from 'react';
import './LegacyCanvasPage.css';
import { MapRenderer, type MapRendererHandle } from '../components/MapRenderer';
import { DialogProvider } from '../components/dialog';
import type { MapIndexEntry } from '../types/maps';
import mapIndex from '../data/mapIndex.json';
import { saveManager } from '../save';

const mapIndexData = mapIndex as MapIndexEntry[];

const simplifyTilesetName = (id: string) => id.replace('gTileset_', '');

export function LegacyCanvasPage() {
  const renderableMaps = useMemo(
    () =>
      mapIndexData.filter(
        (map) => map.layoutPath && map.primaryTilesetPath && map.secondaryTilesetPath
      ),
    []
  );

  const defaultMap =
    renderableMaps.find((map) => map.name === 'LittlerootTown') || renderableMaps[0];

  const [selectedMapId, setSelectedMapId] = useState<string>(defaultMap?.id ?? '');
  const [zoom, setZoom] = useState<number>(1);
  const mapRendererRef = useRef<MapRendererHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedMap =
    renderableMaps.find((map) => map.id === selectedMapId) || defaultMap || renderableMaps[0];

  const handleSave = useCallback(() => {
    if (mapRendererRef.current) {
      const result = mapRendererRef.current.saveGame();
      if (result.success) {
        console.log('[LegacyCanvas] Game saved successfully');
      } else {
        console.error('[LegacyCanvas] Save failed:', result.error);
      }
    }
  }, []);

  const handleLoad = useCallback(() => {
    if (mapRendererRef.current) {
      const result = mapRendererRef.current.loadGame();
      if (result) {
        // Update selected map if it changed
        const loadedMapId = result.location.location.mapId;
        if (loadedMapId !== selectedMapId) {
          setSelectedMapId(loadedMapId);
        }
        console.log('[LegacyCanvas] Game loaded successfully');
      } else {
        console.log('[LegacyCanvas] No save data found');
      }
    }
  }, [selectedMapId]);

  const handleReset = useCallback(() => {
    if (confirm('Reset all progress? This will clear all collected items and flags.')) {
      saveManager.newGame();
      // Reload the page to reset all state
      window.location.reload();
    }
  }, []);

  const handleSaveToFile = useCallback(() => {
    // First save current state, then export to file
    if (mapRendererRef.current) {
      mapRendererRef.current.saveGame();
    }
    const result = saveManager.exportToFile(0);
    if (result.success) {
      console.log('[LegacyCanvas] Save exported to file');
    } else {
      console.error('[LegacyCanvas] Export failed:', result.error);
      alert('Export failed: ' + result.error);
    }
  }, []);

  const handleLoadFromFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await saveManager.importFromFile(file, 0);
    if (result.success) {
      console.log('[LegacyCanvas] Save loaded from file');
      // Reload to apply imported state
      window.location.reload();
    } else {
      console.error('[LegacyCanvas] Import failed:', result.error);
      alert('Load failed: ' + result.error);
    }

    // Reset file input so same file can be selected again
    e.target.value = '';
  }, []);

  if (!selectedMap) {
    return (
      <div className="legacy-canvas-page">
        <h1>Pkmn RSE Browser (Legacy)</h1>
        <p>Unable to load any maps.</p>
      </div>
    );
  }

  return (
    <DialogProvider zoom={zoom}>
      <div className="legacy-canvas-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1>Pkmn RSE Browser (Legacy)</h1>
          <a href="#/" style={{ color: '#646cff' }}>Switch to WebGL renderer</a>
        </div>
        <p style={{ marginTop: 0, marginBottom: '1rem', color: '#888' }}>
          Canvas 2D renderer. For better performance, use the WebGL renderer.
        </p>

        <div className="selector">
          <label htmlFor="map-select">Choose map</label>
          <select
            id="map-select"
            value={selectedMap.id}
            onChange={(e) => {
              setSelectedMapId(e.target.value);
              // Drop focus so arrow keys return to player movement immediately.
              e.currentTarget.blur();
            }}
          >
            {renderableMaps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name} ({map.width}x{map.height})
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <div className="selector__meta">
              <span>Tilesets: {simplifyTilesetName(selectedMap.primaryTilesetId)} / {simplifyTilesetName(selectedMap.secondaryTilesetId)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="zoom-select" style={{ whiteSpace: 'nowrap' }}>Zoom:</label>
              <select
                id="zoom-select"
                value={zoom}
                onChange={(e) => {
                  setZoom(Number(e.target.value));
                  e.currentTarget.blur();
                }}
                style={{ width: 'auto' }}
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={handleSave} style={{ flex: 1 }}>Save</button>
            <button onClick={handleLoad} style={{ flex: 1 }}>Load</button>
            <button onClick={handleReset} style={{ flex: 1, backgroundColor: '#dc3545', color: 'white' }}>Reset</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={handleSaveToFile} style={{ flex: 1 }}>Save to File</button>
            <button onClick={handleLoadFromFileClick} style={{ flex: 1 }}>Load from File</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="card">
          <MapRenderer
            ref={mapRendererRef}
            mapId={selectedMap.id}
            mapName={selectedMap.name}
            width={selectedMap.width}
            height={selectedMap.height}
            layoutPath={selectedMap.layoutPath}
            primaryTilesetPath={selectedMap.primaryTilesetPath}
            secondaryTilesetPath={selectedMap.secondaryTilesetPath}
            primaryTilesetId={selectedMap.primaryTilesetId}
            secondaryTilesetId={selectedMap.secondaryTilesetId}
            zoom={zoom}
          />
        </div>
      </div>
    </DialogProvider>
  );
}

export default LegacyCanvasPage;

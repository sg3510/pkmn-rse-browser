import React, { useState, useCallback, useEffect } from 'react';
import type { DebugTileInfo } from './map/types';
import type { ChunkStats } from '../rendering/ChunkManager';

// Debug options state type
export interface DebugOptions {
  enabled: boolean;
  focusMode: 'player' | 'inspect';
  showChunkBorders: boolean;
  showCollisionOverlay: boolean;
  showElevationOverlay: boolean;
  showTileGrid: boolean;
  showPlayerHitbox: boolean;
  logChunkOperations: boolean;
}

export const DEFAULT_DEBUG_OPTIONS: DebugOptions = {
  enabled: false,
  focusMode: 'player',
  showChunkBorders: false,
  showCollisionOverlay: false,
  showElevationOverlay: false,
  showTileGrid: false,
  showPlayerHitbox: false,
  logChunkOperations: false,
};

interface DebugPanelProps {
  options: DebugOptions;
  onChange: (options: DebugOptions) => void;
  tileInfo: DebugTileInfo | null;
  chunkStats?: ChunkStats | null;
  debugCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  bottomLayerCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  topLayerCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  compositeLayerCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  debugGridSize: number;
}

const PANEL_WIDTH = 340;

export const DebugPanel: React.FC<DebugPanelProps> = ({
  options,
  onChange,
  tileInfo,
  chunkStats,
  debugCanvasRef,
  bottomLayerCanvasRef,
  topLayerCanvasRef,
  compositeLayerCanvasRef,
  debugGridSize,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Sync panel open state with debug enabled
  useEffect(() => {
    if (options.enabled && !isOpen) {
      setIsOpen(true);
    }
  }, [options.enabled, isOpen]);

  const updateOption = useCallback(<K extends keyof DebugOptions>(key: K, value: DebugOptions[K]) => {
    onChange({ ...options, [key]: value });
  }, [options, onChange]);

  const togglePanel = useCallback(() => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (!newIsOpen) {
      updateOption('enabled', false);
    }
  }, [isOpen, updateOption]);

  // Keyboard shortcut: ` (backtick) to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel]);

  return (
    <>
      {/* Toggle Button - Always visible */}
      <button
        onClick={togglePanel}
        style={{
          position: 'fixed',
          right: isOpen ? PANEL_WIDTH : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1001,
          padding: '12px 6px',
          backgroundColor: isOpen ? '#2d2d2d' : '#1a1a1a',
          color: '#888',
          border: 'none',
          borderRadius: '4px 0 0 4px',
          cursor: 'pointer',
          fontSize: '10px',
          fontFamily: 'monospace',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transition: 'right 0.3s ease, background-color 0.2s',
          opacity: isOpen ? 1 : 0.6,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = isOpen ? '1' : '0.6'; e.currentTarget.style.color = '#888'; }}
        title="Toggle Debug Panel (`)"
      >
        DEBUG
      </button>

      {/* Side Panel */}
      <div
        style={{
          position: 'fixed',
          right: isOpen ? 0 : -PANEL_WIDTH,
          top: 0,
          width: PANEL_WIDTH,
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: '#e0e0e0',
          zIndex: 1000,
          transition: 'right 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'monospace',
          fontSize: '11px',
          boxShadow: isOpen ? '-4px 0 20px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#222',
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>Debug Panel</span>
          <span style={{ color: '#666', fontSize: '10px' }}>Press ` to toggle</span>
        </div>

        {/* Scrollable Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
        }}>
          {/* Enable Debug Section */}
          <Section title="General">
            <Checkbox
              label="Enable Debug Mode"
              checked={options.enabled}
              onChange={(v) => updateOption('enabled', v)}
            />
          </Section>

          {/* Focus Mode Section */}
          <Section title="Camera Focus">
            <div style={{ marginBottom: 8 }}>
              <select
                value={options.focusMode}
                onChange={(e) => updateOption('focusMode', e.target.value as 'player' | 'inspect')}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: '#2d2d2d',
                  color: '#e0e0e0',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                <option value="player">Follow Player</option>
                <option value="inspect">Click to Inspect Tile</option>
              </select>
            </div>
            {options.focusMode === 'inspect' && (
              <div style={{ color: '#888', fontSize: '10px', marginTop: 4 }}>
                Click anywhere on the map to inspect that tile
              </div>
            )}
          </Section>

          {/* Rendering Debug Section */}
          <Section title="Rendering">
            <Checkbox
              label="Show Chunk Borders"
              checked={options.showChunkBorders}
              onChange={(v) => updateOption('showChunkBorders', v)}
            />
            <Checkbox
              label="Show Tile Grid"
              checked={options.showTileGrid}
              onChange={(v) => updateOption('showTileGrid', v)}
            />
            <Checkbox
              label="Log Chunk Operations"
              checked={options.logChunkOperations}
              onChange={(v) => updateOption('logChunkOperations', v)}
            />
          </Section>

          {/* Chunk Status Section - shows when Log Chunk Operations is enabled */}
          {options.logChunkOperations && chunkStats && (
            <Section title="Chunk Status">
              <ChunkStatusDisplay stats={chunkStats} />
            </Section>
          )}

          {/* Collision/Elevation Section */}
          <Section title="Overlays">
            <Checkbox
              label="Show Collision Overlay"
              checked={options.showCollisionOverlay}
              onChange={(v) => updateOption('showCollisionOverlay', v)}
            />
            <Checkbox
              label="Show Elevation Overlay"
              checked={options.showElevationOverlay}
              onChange={(v) => updateOption('showElevationOverlay', v)}
            />
            <Checkbox
              label="Show Player Hitbox"
              checked={options.showPlayerHitbox}
              onChange={(v) => updateOption('showPlayerHitbox', v)}
            />
          </Section>

          {/* 3x3 Debug Grid */}
          {options.enabled && (
            <Section title="Tile Inspector">
              <canvas
                ref={debugCanvasRef}
                width={debugGridSize}
                height={debugGridSize}
                style={{
                  border: '1px solid #444',
                  imageRendering: 'pixelated',
                  width: '100%',
                  maxWidth: debugGridSize,
                  backgroundColor: '#000',
                  marginBottom: 8,
                }}
              />

              {/* Tile Info */}
              {tileInfo && (
                <TileInfoDisplay
                  info={tileInfo}
                  bottomLayerCanvasRef={bottomLayerCanvasRef}
                  topLayerCanvasRef={topLayerCanvasRef}
                  compositeLayerCanvasRef={compositeLayerCanvasRef}
                />
              )}
            </Section>
          )}
        </div>
      </div>
    </>
  );
};

// Section component for organizing debug options
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{
      fontSize: '10px',
      fontWeight: 'bold',
      color: '#888',
      textTransform: 'uppercase',
      marginBottom: 8,
      letterSpacing: '0.5px',
    }}>
      {title}
    </div>
    {children}
  </div>
);

// Checkbox component
const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  checked,
  onChange,
}) => (
  <label style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
    cursor: 'pointer',
  }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ cursor: 'pointer' }}
    />
    <span>{label}</span>
  </label>
);

// Tile info display component
const TileInfoDisplay: React.FC<{
  info: DebugTileInfo;
  bottomLayerCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  topLayerCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  compositeLayerCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ info, bottomLayerCanvasRef, topLayerCanvasRef, compositeLayerCanvasRef }) => (
  <div style={{ fontSize: '10px' }}>
    {/* Basic Info */}
    <InfoRow label="Map" value={`${info.mapName} (${info.mapId})`} />
    <InfoRow label="World Coords" value={`(${info.tileX}, ${info.tileY})`} />
    <InfoRow label="Local Coords" value={`(${info.localX}, ${info.localY})`} />
    <InfoRow label="Metatile ID" value={`${info.metatileId} ${info.isSecondary ? '(Secondary)' : '(Primary)'}`} />

    {/* Elevation & Collision */}
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
      <InfoRow label="Tile Elevation" value={info.elevation ?? 'N/A'} />
      <InfoRow label="Player Elevation" value={info.playerElevation ?? 'N/A'} />
      <InfoRow
        label="Collision"
        value={`${info.collision ?? 'N/A'} (${info.collisionPassable ? 'Passable' : 'Blocked'})`}
      />
      {info.isLedge && (
        <InfoRow label="Ledge" value={`${info.ledgeDirection} (Jump)`} />
      )}
    </div>

    {/* Layer Info */}
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
      <InfoRow label="Layer Type" value={`${info.layerTypeLabel ?? 'N/A'} (${info.layerType ?? 'N/A'})`} />
      <InfoRow label="Behavior" value={info.behavior !== undefined ? `0x${info.behavior.toString(16).toUpperCase().padStart(2, '0')}` : 'N/A'} />
    </div>

    {/* Layer Decomposition */}
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ marginBottom: 6, color: '#888' }}>Layer Decomposition:</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <LayerCanvas label="Bottom" canvasRef={bottomLayerCanvasRef} />
        <LayerCanvas label="Top" canvasRef={topLayerCanvasRef} />
        <LayerCanvas label="Composite" canvasRef={compositeLayerCanvasRef} />
      </div>
    </div>

    {/* Render Passes */}
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ marginBottom: 4, color: '#888' }}>Render Passes:</div>
      <div style={{ fontSize: '9px' }}>
        <div>{info.renderedInBackgroundPass ? '✓' : '✗'} Background (bottom layer)</div>
        <div>{info.renderedInTopBelowPass ? '✓' : '✗'} Top-Below (before player)</div>
        <div>{info.renderedInTopAbovePass ? '✓' : '✗'} Top-Above (after player)</div>
      </div>
    </div>

    {/* Facing Tile Inspector */}
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ marginBottom: 4, color: '#888' }}>Facing Tile:</div>
      <div style={{ fontSize: '9px' }}>
        <InfoRow label="Coords" value={info.facingTileX !== undefined ? `(${info.facingTileX}, ${info.facingTileY})` : 'N/A'} />
        <InfoRow label="Metatile ID" value={info.facingMetatileId ?? 'N/A'} />
        <InfoRow label="Behavior" value={info.facingBehavior !== undefined ? `0x${info.facingBehavior.toString(16).toUpperCase().padStart(2, '0')}` : 'N/A'} />
        <InfoRow label="Surfable" value={info.facingIsSurfable ? 'YES' : 'NO'} />
        <InfoRow label="Waterfall" value={info.facingIsWaterfall ? 'YES' : 'NO'} />
        {info.canSurfResult && (
           <div style={{ marginTop: 4, color: info.canSurfResult.startsWith('Yes') ? '#4f4' : '#f44' }}>
             Can Surf: {info.canSurfResult}
           </div>
        )}
      </div>
    </div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
    <span style={{ color: '#888' }}>{label}:</span>
    <span style={{ color: '#fff' }}>{value}</span>
  </div>
);

const LayerCanvas: React.FC<{
  label: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ label, canvasRef }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '9px', marginBottom: 2, color: '#666' }}>{label}</div>
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      style={{
        border: '1px solid #444',
        imageRendering: 'pixelated',
        width: 48,
        height: 48,
        backgroundColor: '#000',
      }}
    />
  </div>
);

// Chunk status display component
const ChunkStatusDisplay: React.FC<{ stats: ChunkStats }> = ({ stats }) => {
  const hitRate = stats.cacheHits + stats.cacheMisses > 0
    ? ((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(1)
    : '100.0';

  return (
    <div style={{ fontSize: '10px' }}>
      {/* Cache Summary */}
      <div style={{ marginBottom: 8 }}>
        <InfoRow label="Visible Chunks" value={stats.visibleChunks} />
        <InfoRow label="Cached Chunks" value={stats.cachedChunks} />
        <InfoRow
          label="Hit Rate"
          value={
            <span style={{ color: parseFloat(hitRate) < 90 ? '#f44' : '#4f4' }}>
              {hitRate}% ({stats.cacheHits} hits, {stats.cacheMisses} misses)
            </span>
          }
        />
      </div>

      {/* World Bounds Info */}
      {stats.worldBounds && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
          <div style={{ marginBottom: 4, color: '#888' }}>World Bounds (tiles):</div>
          <div style={{ fontSize: '9px' }}>
            <InfoRow label="X Range" value={`${stats.worldBounds.minX} to ${stats.worldBounds.maxX - 1}`} />
            <InfoRow label="Y Range" value={`${stats.worldBounds.minY} to ${stats.worldBounds.maxY - 1}`} />
            <InfoRow label="Loaded Maps" value={stats.loadedMapCount ?? 'N/A'} />
          </div>
        </div>
      )}

      {/* Extra Hash (invalidation key) */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
        <div style={{ marginBottom: 4, color: '#888' }}>Cache Key Hash:</div>
        <div style={{
          fontSize: '9px',
          fontFamily: 'monospace',
          backgroundColor: '#2a2a2a',
          padding: 4,
          borderRadius: 2,
          wordBreak: 'break-all',
          maxHeight: 40,
          overflow: 'auto',
        }}>
          {stats.lastExtraHash || '(none)'}
        </div>
      </div>

      {/* Visible Chunk Keys */}
      {stats.visibleChunkKeys.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
          <div style={{ marginBottom: 4, color: '#888' }}>
            Visible Chunk Keys ({stats.visibleChunkKeys.length}):
          </div>
          <div style={{
            fontSize: '8px',
            fontFamily: 'monospace',
            backgroundColor: '#2a2a2a',
            padding: 4,
            borderRadius: 2,
            maxHeight: 80,
            overflow: 'auto',
          }}>
            {stats.visibleChunkKeys.slice(0, 20).map((key, i) => (
              <div key={i} style={{ color: '#aaa' }}>{key}</div>
            ))}
            {stats.visibleChunkKeys.length > 20 && (
              <div style={{ color: '#666' }}>...and {stats.visibleChunkKeys.length - 20} more</div>
            )}
          </div>
        </div>
      )}

      {/* Recent Cache Misses */}
      {stats.recentMisses.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
          <div style={{ marginBottom: 4, color: '#f88' }}>
            Recent Cache Misses ({stats.recentMisses.length}):
          </div>
          <div style={{
            fontSize: '8px',
            fontFamily: 'monospace',
            backgroundColor: '#2a2020',
            padding: 4,
            borderRadius: 2,
            maxHeight: 100,
            overflow: 'auto',
          }}>
            {stats.recentMisses.map((miss, i) => (
              <div key={i} style={{ color: '#f99' }}>{miss}</div>
            ))}
          </div>
        </div>
      )}

      {/* Chunk Coverage Analysis */}
      {stats.loadedMaps && stats.visibleChunkKeys.length > 0 && (
        <ChunkCoverageAnalysis stats={stats} />
      )}

      {/* Loaded Maps Detail */}
      {stats.loadedMaps && stats.loadedMaps.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
          <div style={{ marginBottom: 4, color: '#888' }}>
            Loaded Maps ({stats.loadedMaps.length}):
          </div>
          <div style={{
            fontSize: '8px',
            fontFamily: 'monospace',
            backgroundColor: '#2a2a2a',
            padding: 4,
            borderRadius: 2,
            maxHeight: 120,
            overflow: 'auto',
          }}>
            {stats.loadedMaps.map((m, i) => (
              <div key={i} style={{ color: '#aaa', marginBottom: 2 }}>
                <span style={{ color: '#8af' }}>{m.id.replace('MAP_', '')}</span>
                {' '}X:{m.offsetX}→{m.offsetX + m.width - 1} Y:{m.offsetY}→{m.offsetY + m.height - 1}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Analyze which visible chunks have coverage gaps
const CHUNK_SIZE_TILES = 16;

const ChunkCoverageAnalysis: React.FC<{ stats: ChunkStats }> = ({ stats }) => {
  const issues: string[] = [];

  for (const key of stats.visibleChunkKeys) {
    // Parse chunk key: "cx:cy:layer:hash"
    const parts = key.split(':');
    if (parts.length < 2) continue;
    const cx = parseInt(parts[0], 10);
    const cy = parseInt(parts[1], 10);

    // Calculate tile range for this chunk
    const tileMinX = cx * CHUNK_SIZE_TILES;
    const tileMaxX = tileMinX + CHUNK_SIZE_TILES - 1;
    const tileMinY = cy * CHUNK_SIZE_TILES;
    const tileMaxY = tileMinY + CHUNK_SIZE_TILES - 1;

    // Check if any loaded map covers this chunk
    const coveringMaps = stats.loadedMaps?.filter(m => {
      const mapMaxX = m.offsetX + m.width - 1;
      const mapMaxY = m.offsetY + m.height - 1;
      // Check for overlap
      return !(tileMaxX < m.offsetX || tileMinX > mapMaxX ||
               tileMaxY < m.offsetY || tileMinY > mapMaxY);
    }) ?? [];

    // Check if chunk is fully covered or has gaps
    if (coveringMaps.length === 0) {
      issues.push(`${cx}:${cy} → NO COVERAGE (tiles ${tileMinX},${tileMinY} to ${tileMaxX},${tileMaxY})`);
    } else {
      // Check if partially covered (any tile in chunk outside all maps)
      let hasGap = false;
      for (let ty = tileMinY; ty <= tileMaxY && !hasGap; ty++) {
        for (let tx = tileMinX; tx <= tileMaxX && !hasGap; tx++) {
          const inAnyMap = stats.loadedMaps?.some(m => {
            return tx >= m.offsetX && tx < m.offsetX + m.width &&
                   ty >= m.offsetY && ty < m.offsetY + m.height;
          });
          if (!inAnyMap) hasGap = true;
        }
      }
      if (hasGap) {
        const mapNames = coveringMaps.map(m => m.id.replace('MAP_', '')).join(', ');
        issues.push(`${cx}:${cy} → PARTIAL (maps: ${mapNames})`);
      }
    }
  }

  if (issues.length === 0) return null;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ marginBottom: 4, color: '#fa0' }}>
        Chunk Coverage Issues ({issues.length}):
      </div>
      <div style={{
        fontSize: '8px',
        fontFamily: 'monospace',
        backgroundColor: '#2a2a10',
        padding: 4,
        borderRadius: 2,
        maxHeight: 100,
        overflow: 'auto',
      }}>
        {issues.map((issue, i) => (
          <div key={i} style={{ color: '#fc0' }}>{issue}</div>
        ))}
      </div>
    </div>
  );
};

export default DebugPanel;

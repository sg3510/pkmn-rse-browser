/**
 * DebugPanel - Slide-out sidebar for debugging game state
 *
 * Features:
 * - Toggle debug overlays (grid, collision, elevation, objects)
 * - View player position and state
 * - Inspect NPCs and objects at current/facing tile
 * - View all loaded NPCs/items
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  DebugOptions,
  DebugState,
  DebugTileInfo,
  ObjectsAtTileInfo,
  PlayerDebugInfo,
  WebGLDebugState,
  PriorityDebugInfo,
} from './types';
import type { NPCObject, ItemBallObject } from '../../types/objectEvents';
import type { MapIndexEntry } from '../../types/maps';
import type { ViewportConfig } from '../../config/viewport';
import { getSpritePriorityForElevation } from '../../utils/elevationPriority';
import { gameFlags } from '../../game/GameFlags';
import { gameVariables } from '../../game/GameVariables';

const PANEL_WIDTH = 480;

interface DebugPanelProps {
  options: DebugOptions;
  onChange: (options: DebugOptions) => void;
  state: DebugState;
  /** 3x3 debug grid canvas */
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Debug grid size in pixels */
  debugGridSize?: number;
  /** Center tile debug info */
  centerTileInfo?: DebugTileInfo | null;
  /** Layer decomposition canvases */
  bottomLayerCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  topLayerCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  compositeLayerCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Callback for copying tile debug info */
  onCopyTileDebug?: () => void;
  /** WebGL-specific debug state (only shown when provided) */
  webglState?: WebGLDebugState | null;
  /** Map selection props */
  maps?: MapIndexEntry[];
  selectedMapId?: string;
  onMapChange?: (mapId: string) => void;
  mapLoading?: boolean;
  /** Viewport configuration props */
  viewportConfig?: ViewportConfig;
  onViewportChange?: (config: ViewportConfig) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  options,
  onChange,
  state,
  debugCanvasRef,
  debugGridSize = 144,
  centerTileInfo,
  bottomLayerCanvasRef,
  topLayerCanvasRef,
  compositeLayerCanvasRef,
  onCopyTileDebug,
  webglState,
  maps,
  selectedMapId,
  onMapChange,
  mapLoading,
  viewportConfig,
  onViewportChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'general' | 'objects' | 'tile' | 'state' | 'webgl'>(maps ? 'map' : 'general');

  // Sync panel open state with debug enabled
  useEffect(() => {
    if (options.enabled && !isOpen) {
      setIsOpen(true);
    }
  }, [options.enabled, isOpen]);

  const updateOption = useCallback(
    <K extends keyof DebugOptions>(key: K, value: DebugOptions[K]) => {
      onChange({ ...options, [key]: value });
    },
    [options, onChange]
  );

  const togglePanel = useCallback(() => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (!newIsOpen) {
      updateOption('enabled', false);
    } else {
      updateOption('enabled', true);
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
      {/* Toggle Button */}
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
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = isOpen ? '1' : '0.6';
          e.currentTarget.style.color = '#888';
        }}
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
          userSelect: 'text',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#222',
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>
            Debug Panel
          </span>
          <span style={{ color: '#666', fontSize: '10px' }}>Press ` to toggle</span>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #333',
            backgroundColor: '#222',
          }}
        >
          {maps && (
            <TabButton
              label="Map"
              active={activeTab === 'map'}
              onClick={() => setActiveTab('map')}
            />
          )}
          <TabButton
            label="General"
            active={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
          />
          <TabButton
            label="Objects"
            active={activeTab === 'objects'}
            onClick={() => setActiveTab('objects')}
          />
          <TabButton
            label="Tile"
            active={activeTab === 'tile'}
            onClick={() => setActiveTab('tile')}
          />
          <TabButton
            label="State"
            active={activeTab === 'state'}
            onClick={() => setActiveTab('state')}
          />
          {webglState && (
            <TabButton
              label="WebGL"
              active={activeTab === 'webgl'}
              onClick={() => setActiveTab('webgl')}
            />
          )}
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
          }}
        >
          {activeTab === 'map' && maps && (
            <MapTab
              maps={maps}
              selectedMapId={selectedMapId}
              onMapChange={onMapChange}
              loading={mapLoading}
              webglState={webglState}
            />
          )}
          {activeTab === 'general' && (
            <GeneralTab
              options={options}
              updateOption={updateOption}
              state={state}
              viewportConfig={viewportConfig}
              onViewportChange={onViewportChange}
            />
          )}
          {activeTab === 'objects' && <ObjectsTab state={state} />}
          {activeTab === 'state' && <StateTab />}
          {activeTab === 'tile' && (
            <TileTab
              state={state}
              debugCanvasRef={debugCanvasRef}
              debugGridSize={debugGridSize}
              centerTileInfo={centerTileInfo}
              bottomLayerCanvasRef={bottomLayerCanvasRef}
              topLayerCanvasRef={topLayerCanvasRef}
              compositeLayerCanvasRef={compositeLayerCanvasRef}
              onCopyTileDebug={onCopyTileDebug}
            />
          )}
          {activeTab === 'webgl' && webglState && (
            <WebGLTab webglState={webglState} />
          )}
        </div>
      </div>
    </>
  );
};

// Tab button component
const TabButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: '8px',
      backgroundColor: active ? '#333' : 'transparent',
      color: active ? '#fff' : '#888',
      border: 'none',
      borderBottom: active ? '2px solid #4a9eff' : '2px solid transparent',
      cursor: 'pointer',
      fontSize: '11px',
      fontFamily: 'monospace',
    }}
  >
    {label}
  </button>
);

// Map selection tab
const MapTab: React.FC<{
  maps: MapIndexEntry[];
  selectedMapId?: string;
  onMapChange?: (mapId: string) => void;
  loading?: boolean;
  webglState?: WebGLDebugState | null;
}> = ({ maps, selectedMapId, onMapChange, loading, webglState }) => {
  const selectedMap = maps.find(m => m.id === selectedMapId);
  const renderStats = webglState?.renderStats;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section title="Choose Map">
        <select
          value={selectedMapId || ''}
          onChange={(e) => {
            onMapChange?.(e.target.value);
            e.currentTarget.blur();
          }}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#1a1a2e',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: 4,
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
        >
          {maps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name} ({map.width}×{map.height})
            </option>
          ))}
        </select>
        {loading && (
          <div style={{ marginTop: 8, color: '#4a9eff', fontSize: '11px' }}>
            Loading map data…
          </div>
        )}
      </Section>

      {selectedMap && (
        <Section title="Map Info">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <InfoRow label="Name" value={selectedMap.name} />
            <InfoRow label="Size" value={`${selectedMap.width}×${selectedMap.height} metatiles`} />
            <InfoRow
              label="Tilesets"
              value={`${selectedMap.primaryTilesetId.replace('gTileset_', '')} / ${selectedMap.secondaryTilesetId.replace('gTileset_', '')}`}
            />
            {renderStats && (
              <>
                <InfoRow label="World" value={`${renderStats.worldWidthPx}×${renderStats.worldHeightPx}px`} />
                {renderStats.stitchedMapCount > 1 && (
                  <InfoRow label="Stitched" value={`${renderStats.stitchedMapCount} maps`} highlight />
                )}
              </>
            )}
          </div>
        </Section>
      )}
    </div>
  );
};

// Collision legend component
const CollisionLegend: React.FC = () => (
  <div style={{ marginTop: 8, marginBottom: 8, padding: 8, backgroundColor: '#2a2a2a', borderRadius: 4 }}>
    <div style={{ fontSize: '9px', color: '#888', marginBottom: 6 }}>Collision Legend:</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 16, height: 16, border: '2px solid #00ff00', boxSizing: 'border-box' }} />
        <span style={{ fontSize: '10px' }}>0 - Passable</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 16,
          height: 16,
          backgroundColor: 'rgba(255, 0, 0, 0.6)',
          position: 'relative',
        }}>
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '12px',
          }}>×</span>
        </div>
        <span style={{ fontSize: '10px' }}>1 - Blocked</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 16, height: 16, backgroundColor: 'rgba(255, 255, 0, 0.6)' }} />
        <span style={{ fontSize: '10px' }}>2+ - Special</span>
      </div>
    </div>
  </div>
);

// Elevation legend component
const ElevationLegend: React.FC = () => {
  const elevationColors = [
    '#0000ff', '#0044ff', '#0088ff', '#00ccff',
    '#00ffcc', '#00ff88', '#00ff44', '#00ff00',
    '#44ff00', '#88ff00', '#ccff00', '#ffff00',
    '#ffcc00', '#ff8800', '#ff4400', '#ff0000',
  ];

  return (
    <div style={{ marginTop: 8, marginBottom: 8, padding: 8, backgroundColor: '#2a2a2a', borderRadius: 4 }}>
      <div style={{ fontSize: '9px', color: '#888', marginBottom: 6 }}>Elevation Legend:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {elevationColors.map((color, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: 18,
            }}
          >
            <div style={{
              width: 14,
              height: 14,
              backgroundColor: color,
              opacity: 0.7,
              border: '1px solid #444',
            }} />
            <span style={{ fontSize: '8px', color: '#888' }}>{i}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Viewport presets for quick selection
const VIEWPORT_PRESETS = [
  { label: 'GBA', tilesWide: 15, tilesHigh: 10 },
  { label: '20×20', tilesWide: 20, tilesHigh: 20 },
  { label: '25×18', tilesWide: 25, tilesHigh: 18 },
  { label: '30×20', tilesWide: 30, tilesHigh: 20 },
] as const;

// General tab with overlay toggles
const GeneralTab: React.FC<{
  options: DebugOptions;
  updateOption: <K extends keyof DebugOptions>(key: K, value: DebugOptions[K]) => void;
  state: DebugState;
  viewportConfig?: ViewportConfig;
  onViewportChange?: (config: ViewportConfig) => void;
}> = ({ options, updateOption, state, viewportConfig, onViewportChange }) => (
  <>
    {/* Viewport Size Controls */}
    {viewportConfig && onViewportChange && (
      <Section title="Viewport Size">
        {/* Preset buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {VIEWPORT_PRESETS.map((preset) => {
            const isActive = viewportConfig.tilesWide === preset.tilesWide &&
                            viewportConfig.tilesHigh === preset.tilesHigh;
            return (
              <button
                key={preset.label}
                onClick={() => onViewportChange({ tilesWide: preset.tilesWide, tilesHigh: preset.tilesHigh })}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  background: isActive ? '#4a9eff' : '#2f2f2f',
                  color: isActive ? '#fff' : '#ccc',
                  border: isActive ? '1px solid #4a9eff' : '1px solid #444',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        {/* Manual inputs */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '10px', color: '#888' }}>
            W:
            <input
              type="number"
              min={10}
              max={50}
              value={viewportConfig.tilesWide}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 10 && val <= 50) {
                  onViewportChange({ ...viewportConfig, tilesWide: val });
                }
              }}
              style={{
                width: 50,
                marginLeft: 4,
                padding: '2px 4px',
                fontSize: '10px',
                fontFamily: 'monospace',
                background: '#1a1a2e',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: 3,
              }}
            />
          </label>
          <label style={{ fontSize: '10px', color: '#888' }}>
            H:
            <input
              type="number"
              min={10}
              max={50}
              value={viewportConfig.tilesHigh}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 10 && val <= 50) {
                  onViewportChange({ ...viewportConfig, tilesHigh: val });
                }
              }}
              style={{
                width: 50,
                marginLeft: 4,
                padding: '2px 4px',
                fontSize: '10px',
                fontFamily: 'monospace',
                background: '#1a1a2e',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: 3,
              }}
            />
          </label>
          <span style={{ fontSize: '9px', color: '#666' }}>tiles</span>
        </div>
        <div style={{ fontSize: '9px', color: '#666', marginTop: 4 }}>
          {viewportConfig.tilesWide * 16}×{viewportConfig.tilesHigh * 16}px
        </div>
      </Section>
    )}

    <Section title="Overlays">
      <Checkbox
        label="Show Tile Grid"
        checked={options.showTileGrid}
        onChange={(v) => updateOption('showTileGrid', v)}
      />
      <Checkbox
        label="Show Collision Overlay"
        checked={options.showCollisionOverlay}
        onChange={(v) => updateOption('showCollisionOverlay', v)}
      />
      {options.showCollisionOverlay && <CollisionLegend />}
      <Checkbox
        label="Show Elevation Overlay"
        checked={options.showElevationOverlay}
        onChange={(v) => updateOption('showElevationOverlay', v)}
      />
      {options.showElevationOverlay && <ElevationLegend />}
      <Checkbox
        label="Show Object Markers"
        checked={options.showObjectOverlay}
        onChange={(v) => updateOption('showObjectOverlay', v)}
      />
      <Checkbox
        label="Show Player Hitbox"
        checked={options.showPlayerHitbox}
        onChange={(v) => updateOption('showPlayerHitbox', v)}
      />
    </Section>

    <Section title="Logging">
      <Checkbox
        label="Log Object Events"
        checked={options.logObjectEvents}
        onChange={(v) => updateOption('logObjectEvents', v)}
      />
    </Section>

    {state.player && (
      <Section title="Player">
        <PlayerInfoDisplay info={state.player} />
      </Section>
    )}

    <Section title="Object Summary">
      <InfoRow label="Visible NPCs" value={state.allVisibleNPCs.length} />
      <InfoRow label="Total NPCs" value={state.totalNPCCount} />
      <InfoRow label="Visible Items" value={state.allVisibleItems.length} />
      <InfoRow label="Total Items" value={state.totalItemCount} />
    </Section>
  </>
);

// Helper to check if tile info has any objects
const hasObjects = (info: ObjectsAtTileInfo | null): boolean => {
  if (!info) return false;
  return info.npcs.length > 0 || info.items.length > 0;
};

// Objects tab with NPC/item details
const ObjectsTab: React.FC<{ state: DebugState }> = ({ state }) => {
  // Get player position for reference
  const playerPos = state.player ? `(${state.player.tileX}, ${state.player.tileY})` : 'N/A';
  const facingDir = state.player?.direction ?? 'unknown';
  const allNpcs = state.allNPCs ?? state.allVisibleNPCs;
  const offscreenNpcIds = new Set(state.offscreenDespawnedNpcIds ?? []);
  const hiddenNpcCount = allNpcs.filter((npc) => !npc.visible).length;
  const offscreenNpcCount = allNpcs.filter((npc) => offscreenNpcIds.has(npc.id)).length;
  const scriptRemovedNpcCount = allNpcs.filter((npc) => npc.scriptRemoved).length;

  // Check if any adjacent tile has objects
  const adj = state.adjacentObjects;
  const hasAdjacentObjects = adj && (
    hasObjects(adj.north) || hasObjects(adj.south) ||
    hasObjects(adj.east) || hasObjects(adj.west)
  );

  return (
    <>
      {/* Facing Tile - most important for interaction */}
      {state.objectsAtFacingTile && hasObjects(state.objectsAtFacingTile) && (
        <Section title={`Facing (${facingDir})`}>
          <ObjectsAtTileDisplay info={state.objectsAtFacingTile} />
        </Section>
      )}

      {/* Adjacent Tiles with Objects */}
      {adj && hasAdjacentObjects && (
        <Section title="Adjacent Tiles">
          {hasObjects(adj.north) && (
            <AdjacentTileDisplay direction="North" info={adj.north!} isFacing={facingDir === 'up'} />
          )}
          {hasObjects(adj.south) && (
            <AdjacentTileDisplay direction="South" info={adj.south!} isFacing={facingDir === 'down'} />
          )}
          {hasObjects(adj.east) && (
            <AdjacentTileDisplay direction="East" info={adj.east!} isFacing={facingDir === 'right'} />
          )}
          {hasObjects(adj.west) && (
            <AdjacentTileDisplay direction="West" info={adj.west!} isFacing={facingDir === 'left'} />
          )}
        </Section>
      )}

      {/* Show message if no adjacent objects */}
      {!hasObjects(state.objectsAtFacingTile) && !hasAdjacentObjects && (
        <Section title="Nearby Objects">
          <div style={{ color: '#666', fontStyle: 'italic', fontSize: '10px' }}>
            No NPCs or items on adjacent tiles
          </div>
          <div style={{ color: '#555', fontSize: '9px', marginTop: 4 }}>
            Player at {playerPos}, facing {facingDir}
          </div>
        </Section>
      )}

      {/* All Visible NPCs in current map area */}
      <Section title={`All Visible NPCs (${state.allVisibleNPCs.length})`}>
        {state.allVisibleNPCs.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>No visible NPCs</div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {state.allVisibleNPCs.map((npc) => (
              <NPCCompactDisplay key={npc.id} npc={npc} />
            ))}
          </div>
        )}
      </Section>

      {/* All NPC Runtime State (including hidden/despawned) */}
      <Section title={`All NPC Runtime (${allNpcs.length})`} collapsible defaultCollapsed>
        {allNpcs.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>No NPCs loaded</div>
        ) : (
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {allNpcs.map((npc) => (
              <NPCRuntimeDisplay
                key={npc.id}
                npc={npc}
                offscreenDespawned={offscreenNpcIds.has(npc.id)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* All Visible Items */}
      <Section title={`All Visible Items (${state.allVisibleItems.length})`}>
        {state.allVisibleItems.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>No visible items</div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {state.allVisibleItems.map((item) => (
              <ItemCompactDisplay key={item.id} item={item} />
            ))}
          </div>
        )}
      </Section>

      {/* Summary */}
      <Section title="Summary">
        <InfoRow label="Total NPCs" value={state.totalNPCCount} />
        <InfoRow label="Hidden NPCs" value={hiddenNpcCount} />
        <InfoRow label="Offscreen NPCs" value={offscreenNpcCount} />
        <InfoRow label="Script Removed NPCs" value={scriptRemovedNpcCount} />
        <InfoRow label="Total Items" value={state.totalItemCount} />
      </Section>
    </>
  );
};

// Adjacent tile display with direction indicator
const AdjacentTileDisplay: React.FC<{
  direction: string;
  info: ObjectsAtTileInfo;
  isFacing: boolean;
}> = ({ direction, info, isFacing }) => (
  <div style={{
    marginBottom: 8,
    padding: 6,
    backgroundColor: isFacing ? '#2a3a2a' : '#2a2a2a',
    borderRadius: 4,
    borderLeft: isFacing ? '2px solid #4f4' : 'none',
  }}>
    <div style={{
      fontSize: '9px',
      color: isFacing ? '#4f4' : '#888',
      marginBottom: 4,
      fontWeight: isFacing ? 'bold' : 'normal',
    }}>
      {direction} ({info.tileX}, {info.tileY}) {isFacing && '(Facing)'}
    </div>
    {info.npcs.map((npc) => (
      <NPCCompactDisplay key={npc.id} npc={npc} />
    ))}
    {info.items.map((item) => (
      <ItemCompactDisplay key={item.id} item={item} />
    ))}
  </div>
);

// Tile tab with detailed tile info and 3x3 grid
const TileTab: React.FC<{
  state: DebugState;
  debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  debugGridSize?: number;
  centerTileInfo?: DebugTileInfo | null;
  bottomLayerCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  topLayerCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  compositeLayerCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  onCopyTileDebug?: () => void;
}> = ({
  debugCanvasRef,
  debugGridSize = 144,
  centerTileInfo,
  bottomLayerCanvasRef,
  topLayerCanvasRef,
  compositeLayerCanvasRef,
  onCopyTileDebug,
}) => (
  <>
    {/* 3x3 Debug Grid */}
    {debugCanvasRef && (
      <Section title="3x3 Tile Grid">
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
      </Section>
    )}

    {/* Center Tile Info */}
    {centerTileInfo ? (
      <>
        <Section title="Tile Info">
          <InfoRow label="Map" value={`${centerTileInfo.mapName}`} />
          <InfoRow label="World" value={`(${centerTileInfo.tileX}, ${centerTileInfo.tileY})`} />
          <InfoRow label="Local" value={`(${centerTileInfo.localX}, ${centerTileInfo.localY})`} />
          <InfoRow
            label="Metatile"
            value={`${centerTileInfo.metatileId} ${centerTileInfo.isSecondary ? '(2nd)' : '(1st)'}`}
          />
          <InfoRow
            label="Behavior"
            value={centerTileInfo.behavior !== undefined
              ? `0x${centerTileInfo.behavior.toString(16).toUpperCase().padStart(2, '0')}`
              : 'N/A'}
          />
        </Section>

        <Section title="Elevation & Collision">
          <InfoRow label="Tile Elev" value={centerTileInfo.elevation ?? 'N/A'} />
          <InfoRow label="Player Elev" value={centerTileInfo.playerElevation ?? 'N/A'} />
          <InfoRow
            label="Collision"
            value={
              <span style={{ color: centerTileInfo.collisionPassable ? '#4f4' : '#f44' }}>
                {centerTileInfo.collision ?? 'N/A'} ({centerTileInfo.collisionPassable ? 'Pass' : 'Block'})
              </span>
            }
          />
          {centerTileInfo.isLedge && (
            <InfoRow label="Ledge" value={`${centerTileInfo.ledgeDirection} (Jump)`} />
          )}
        </Section>

        <Section title="Layer Info">
          <InfoRow
            label="Layer Type"
            value={`${centerTileInfo.layerTypeLabel ?? 'N/A'} (${centerTileInfo.layerType ?? 'N/A'})`}
          />
        </Section>

        {/* Layer Decomposition */}
        {(bottomLayerCanvasRef || topLayerCanvasRef || compositeLayerCanvasRef) && (
          <Section title="Layer Decomposition">
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {bottomLayerCanvasRef && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', marginBottom: 2, color: '#666' }}>Bottom</div>
                  <canvas
                    ref={bottomLayerCanvasRef}
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
              )}
              {topLayerCanvasRef && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', marginBottom: 2, color: '#666' }}>Top</div>
                  <canvas
                    ref={topLayerCanvasRef}
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
              )}
              {compositeLayerCanvasRef && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', marginBottom: 2, color: '#666' }}>Composite</div>
                  <canvas
                    ref={compositeLayerCanvasRef}
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
              )}
            </div>
          </Section>
        )}

        {/* Render Passes */}
        <Section title="Render Passes">
          <div style={{ fontSize: '9px' }}>
            <div style={{ color: centerTileInfo.renderedInBackgroundPass ? '#4f4' : '#666' }}>
              {centerTileInfo.renderedInBackgroundPass ? '✓' : '✗'} Background (bottom)
            </div>
            <div style={{ color: centerTileInfo.renderedInTopBelowPass ? '#4f4' : '#666' }}>
              {centerTileInfo.renderedInTopBelowPass ? '✓' : '✗'} Top-Below (before player)
            </div>
            <div style={{ color: centerTileInfo.renderedInTopAbovePass ? '#4f4' : '#666' }}>
              {centerTileInfo.renderedInTopAbovePass ? '✓' : '✗'} Top-Above (after player)
            </div>
          </div>
        </Section>

        {/* Warp Info */}
        {centerTileInfo.warpEvent && (
          <Section title="Warp Event">
            <InfoRow label="Kind" value={centerTileInfo.warpKind ?? 'unknown'} />
            <InfoRow label="Dest" value={centerTileInfo.warpEvent.destMap} />
            <InfoRow label="Warp ID" value={centerTileInfo.warpEvent.destWarpId} />
          </Section>
        )}

        {/* Reflection */}
        {centerTileInfo.isReflective && (
          <Section title="Reflection">
            <InfoRow label="Type" value={centerTileInfo.reflectionType ?? 'unknown'} />
            <InfoRow
              label="Mask"
              value={`${centerTileInfo.reflectionMaskAllow}/${centerTileInfo.reflectionMaskTotal} px`}
            />
          </Section>
        )}

        {/* Copy button */}
        {onCopyTileDebug && (
          <button
            onClick={onCopyTileDebug}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '10px',
              fontFamily: 'monospace',
            }}
          >
            Copy tile debug to clipboard
          </button>
        )}
      </>
    ) : (
      <div style={{ color: '#666', fontStyle: 'italic', padding: 16 }}>
        No tile info available
      </div>
    )}
  </>
);

// Priority Debug Panel - Shows all sprite sort keys for debugging Y-sorting issues
const PriorityDebugPanel: React.FC<{ priority: PriorityDebugInfo }> = ({ priority }) => {
  const { player, fieldEffects, npcs, comparison, sortedSprites } = priority;

  // Color code based on sort key relative to player
  const getSortKeyColor = (sortKey: number): string => {
    if (!player) return '#888';
    const diff = sortKey - player.sortKey;
    if (diff < 0) return '#4af'; // Blue = renders before player (behind)
    if (diff > 0) return '#fa4'; // Orange = renders after player (in front)
    return '#ff0'; // Yellow = same as player
  };

  return (
    <>
      {/* Player Sort Key Info */}
      {player && (
        <Section title="Player Sort Key" collapsible>
          <div style={{
            padding: 8,
            backgroundColor: '#2a3a2a',
            borderRadius: 4,
            borderLeft: '3px solid #4f4',
            fontSize: '10px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              <span style={{ color: '#888' }}>Tile:</span>
              <span>({player.tileX}, {player.tileY})</span>
              <span style={{ color: '#888' }}>player.y:</span>
              <span>{player.pixelY}</span>
              <span style={{ color: '#888' }}>Sprite Center (y+16):</span>
              <span>{player.spriteCenter}</span>
              <span style={{ color: '#888' }}>Feet Y (y+32):</span>
              <span style={{ color: '#4f4', fontWeight: 'bold' }}>{player.feetY}</span>
              <span style={{ color: '#888' }}>SortKey Y:</span>
              <span>{player.sortKeyY}</span>
              <span style={{ color: '#888' }}>Subpriority:</span>
              <span>{player.subpriority}</span>
              <span style={{ color: '#888' }}>Sort Key:</span>
              <span style={{ color: '#ff0', fontWeight: 'bold' }}>{player.sortKey}</span>
              <span style={{ color: '#888' }}>Elevation:</span>
              <span>{player.elevation}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: '9px', color: '#666' }}>
              Formula: sortKey = (feetY &lt;&lt; 8) | subpriority = ({player.feetY} &lt;&lt; 8) | {player.subpriority}
            </div>
          </div>
        </Section>
      )}

      {/* Sort Key Comparison */}
      {comparison && comparison.nearbySprites.length > 0 && (
        <Section title={`Nearby Sprites (${comparison.nearbySprites.length})`} collapsible>
          <div style={{ fontSize: '9px', marginBottom: 8, color: '#888' }}>
            🔵 Blue = behind player | 🟡 Yellow = same | 🟠 Orange = in front
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {comparison.nearbySprites.map((sprite, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 6px',
                  backgroundColor: i % 2 === 0 ? '#2a2a2a' : '#252525',
                  fontSize: '9px',
                  borderLeft: `3px solid ${getSortKeyColor(sprite.sortKey)}`,
                }}
              >
                <span style={{ color: '#fff', flex: 1 }}>{sprite.name}</span>
                <span style={{ color: getSortKeyColor(sprite.sortKey), marginRight: 8 }}>
                  {sprite.sortKey}
                </span>
                <span style={{ color: sprite.diff >= 0 ? '#fa4' : '#4af', width: 60, textAlign: 'right' }}>
                  {sprite.diff >= 0 ? '+' : ''}{sprite.diff}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Field Effects */}
      {fieldEffects.effects.length > 0 && (
        <Section title={`Field Effects (${fieldEffects.total})`} collapsible defaultCollapsed>
          <div style={{ fontSize: '9px', marginBottom: 6 }}>
            Bottom (behind): {fieldEffects.bottom} | Top (front): {fieldEffects.top}
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {fieldEffects.effects.map((effect, i) => (
              <div
                key={i}
                style={{
                  padding: 6,
                  backgroundColor: effect.isInFront ? '#2a3a2a' : '#2a2a3a',
                  borderRadius: 4,
                  marginBottom: 4,
                  borderLeft: `3px solid ${effect.isInFront ? '#4f4' : '#44f'}`,
                  fontSize: '9px',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                  {effect.effectType} frame {effect.effectFrame}
                  <span style={{ color: effect.isInFront ? '#4f4' : '#44f', marginLeft: 8 }}>
                    [{effect.effectLayer}]
                  </span>
                  {effect.renderBehindPlayer && (
                    <span style={{ color: '#f88', marginLeft: 4 }}>(renderBehind)</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', color: '#888' }}>
                  <span>Tile:</span>
                  <span style={{ color: '#fff' }}>({effect.tileX}, {effect.tileY})</span>
                  <span>WorldY:</span>
                  <span style={{ color: '#fff' }}>{effect.worldY}</span>
                  <span>SortKeyY:</span>
                  <span style={{ color: '#fff' }}>{effect.sortKeyY}</span>
                  <span>Subpriority:</span>
                  <span style={{ color: '#fff' }}>{effect.subpriority}</span>
                  <span>SortKey:</span>
                  <span style={{ color: getSortKeyColor(effect.sortKey) }}>{effect.sortKey}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* NPCs */}
      {npcs.list.length > 0 && (
        <Section title={`NPCs (${npcs.total})`} collapsible defaultCollapsed>
          <div style={{ fontSize: '9px', marginBottom: 6 }}>
            With Player: {npcs.withPlayer} | Behind Bridge: {npcs.behindBridge} | Above All: {npcs.aboveAll}
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {npcs.list.map((npc, i) => (
              <div
                key={i}
                style={{
                  padding: 6,
                  backgroundColor: '#2a2a3a',
                  borderRadius: 4,
                  marginBottom: 4,
                  borderLeft: `3px solid ${npc.renderLayer === 'aboveAll' ? '#f4a' : npc.renderLayer === 'behindBridge' ? '#888' : '#4af'}`,
                  fontSize: '9px',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                  {npc.name}
                  <span style={{ color: '#888', marginLeft: 8 }}>
                    [{npc.renderLayer}] P{npc.priority}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', color: '#888' }}>
                  <span>Tile:</span>
                  <span style={{ color: '#fff' }}>({npc.tileX}, {npc.tileY})</span>
                  <span>FeetY:</span>
                  <span style={{ color: '#fff' }}>{npc.feetY}</span>
                  <span>SortKeyY:</span>
                  <span style={{ color: '#fff' }}>{npc.sortKeyY}</span>
                  <span>Elevation:</span>
                  <span style={{ color: '#fff' }}>{npc.elevation}</span>
                  <span>SortKey:</span>
                  <span style={{ color: getSortKeyColor(npc.sortKey) }}>{npc.sortKey}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* All Sorted Sprites (render order) */}
      {sortedSprites.length > 0 && (
        <Section title={`Render Order (${sortedSprites.length} sprites)`} collapsible defaultCollapsed>
          <div style={{ fontSize: '9px', marginBottom: 6, color: '#888' }}>
            First = renders first (behind) | Last = renders last (in front)
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {sortedSprites.map((sprite, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '3px 6px',
                  backgroundColor: sprite.type === 'player' ? '#3a3a2a' : i % 2 === 0 ? '#2a2a2a' : '#252525',
                  fontSize: '9px',
                  borderLeft: sprite.type === 'player' ? '3px solid #ff0' : `3px solid ${getSortKeyColor(sprite.sortKey)}`,
                }}
              >
                <span style={{ color: '#666', width: 20 }}>{i}</span>
                <span style={{ color: sprite.type === 'player' ? '#ff0' : '#fff', flex: 1 }}>
                  {sprite.name}
                </span>
                <span style={{ color: '#888', marginRight: 8 }}>{sprite.renderLayer}</span>
                <span style={{ color: getSortKeyColor(sprite.sortKey) }}>{sprite.sortKey}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
};

const STATE_WATCH_FLAGS = [
  'FLAG_RESCUED_BIRCH',
  'FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE',
  'FLAG_HIDE_ROUTE_101_ZIGZAGOON',
  'FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG',
  'FLAG_HIDE_ROUTE_101_BIRCH',
];

const STATE_WATCH_VARS = [
  'VAR_ROUTE101_STATE',
  'VAR_BIRCH_STATE',
  'VAR_LITTLEROOT_TOWN_STATE',
  'VAR_LITTLEROOT_INTRO_STATE',
];

// State tab — flags and variables inspector
const StateTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);

  // Read state on each render / refresh
  const allFlags = useMemo(() => gameFlags.getAllFlags().sort(), [refreshKey]);
  const allVars = useMemo(() => {
    const raw = gameVariables.getAllVars();
    // Filter to non-zero, sort by name
    return Object.entries(raw)
      .filter(([, v]) => v !== 0)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [refreshKey]);
  const watchedFlags = useMemo(
    () => STATE_WATCH_FLAGS.map((flag) => ({ flag, set: gameFlags.isSet(flag) })),
    [refreshKey]
  );
  const watchedVars = useMemo(
    () => STATE_WATCH_VARS.map((variable) => ({ variable, value: gameVariables.getVar(variable) })),
    [refreshKey]
  );

  const lowerSearch = search.toLowerCase();
  const filteredFlags = lowerSearch
    ? allFlags.filter((f) => f.toLowerCase().includes(lowerSearch))
    : allFlags;
  const filteredVars = lowerSearch
    ? allVars.filter(([name]) => name.toLowerCase().includes(lowerSearch))
    : allVars;

  const handleCopy = () => {
    const data = {
      flags: allFlags,
      variables: Object.fromEntries(allVars),
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* noop */ });
  };

  return (
    <>
      {/* Summary + Refresh */}
      <Section title="Game State">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#aaa', fontSize: '10px' }}>
            {allFlags.length} flags set, {allVars.length} vars non-zero
          </span>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              fontFamily: 'monospace',
              background: '#2f2f2f',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Filter flags/vars..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            padding: '6px 8px',
            backgroundColor: '#1a1a2e',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: 4,
            fontSize: '11px',
            fontFamily: 'monospace',
            marginBottom: 8,
            boxSizing: 'border-box',
          }}
        />
      </Section>

      <Section title="Runtime Watch" collapsible>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ color: '#888', fontSize: '9px', marginBottom: 4 }}>Variables</div>
            {watchedVars.map(({ variable, value }) => (
              <div key={variable} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: '#4a9eff', marginRight: 8 }}>{variable.replace('VAR_', '')}</span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{value}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '9px', marginBottom: 4 }}>Flags</div>
            {watchedFlags.map(({ flag, set }) => (
              <div key={flag} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: '#4f4', marginRight: 8 }}>{flag.replace('FLAG_', '')}</span>
                <span style={{ color: set ? '#4f4' : '#666', fontWeight: 'bold' }}>
                  {set ? 'SET' : 'UNSET'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Variables */}
      <Section title={`Variables (${filteredVars.length})`} collapsible>
        {filteredVars.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic', fontSize: '10px' }}>
            {search ? 'No matching variables' : 'No non-zero variables'}
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filteredVars.map(([name, value]) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '2px 0',
                  borderBottom: '1px solid #2a2a2a',
                  fontSize: '10px',
                }}
              >
                <span style={{ color: '#4a9eff', wordBreak: 'break-all', flex: 1, marginRight: 8 }}>
                  {name.replace('VAR_', '')}
                </span>
                <span style={{ color: '#fff', fontWeight: 'bold', flexShrink: 0 }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Flags */}
      <Section title={`Flags (${filteredFlags.length})`} collapsible>
        {filteredFlags.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic', fontSize: '10px' }}>
            {search ? 'No matching flags' : 'No flags set'}
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filteredFlags.map((flag) => (
              <div
                key={flag}
                style={{
                  padding: '2px 0',
                  borderBottom: '1px solid #2a2a2a',
                  fontSize: '10px',
                  color: '#4f4',
                  wordBreak: 'break-all',
                }}
              >
                {flag.replace('FLAG_', '')}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: copied ? '#2a3a2a' : '#333',
          color: copied ? '#4f4' : '#fff',
          border: `1px solid ${copied ? '#4f4' : '#555'}`,
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '11px',
          fontFamily: 'monospace',
          marginTop: 8,
        }}
      >
        {copied ? 'Copied!' : 'Copy state to clipboard'}
      </button>
    </>
  );
};

// WebGL-specific debug tab
const WebGLTab: React.FC<{ webglState: WebGLDebugState }> = ({ webglState }) => {
  const { mapStitching, warp, renderStats, truck, shimmer, reflectionTileGrid, priority } = webglState;

  return (
    <>
      {/* Priority Debug - Most important for sorting issues */}
      {priority && (
        <Section title="🔢 Priority/Sorting Debug" collapsible>
          <PriorityDebugPanel priority={priority} />
        </Section>
      )}

      {/* Pipeline debug - helps diagnose black-layer issues without spamming console */}
      {renderStats?.pipelineDebug && (
        <Section title="🧪 Pipeline Cache Debug" collapsible>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: '10px' }}>
            <span style={{ color: '#888' }}>tilesetVersion:</span>
            <span>{renderStats.pipelineDebug.tilesetVersion}</span>
            <span style={{ color: '#888' }}>lastRendered:</span>
            <span>{renderStats.pipelineDebug.lastRenderedTilesetVersion}</span>
            <span style={{ color: '#888' }}>needsFullRender:</span>
            <span style={{ color: renderStats.pipelineDebug.needsFullRender ? '#f66' : '#6f6' }}>
              {renderStats.pipelineDebug.needsFullRender ? 'YES' : 'NO'}
            </span>
            <span style={{ color: '#888' }}>needsWarmup:</span>
            <span style={{ color: renderStats.pipelineDebug.needsWarmupRender ? '#f66' : '#6f6' }}>
              {renderStats.pipelineDebug.needsWarmupRender ? 'YES' : 'NO'}
            </span>
            <span style={{ color: '#888' }}>hasCachedInstances:</span>
            <span style={{ color: renderStats.pipelineDebug.hasCachedInstances ? '#6f6' : '#f66' }}>
              {renderStats.pipelineDebug.hasCachedInstances ? 'YES' : 'NO'}
            </span>
            <span style={{ color: '#888' }}>tilesetsUploaded:</span>
            <span style={{ color: renderStats.pipelineDebug.tilesetsUploaded ? '#6f6' : '#f66' }}>
              {renderStats.pipelineDebug.tilesetsUploaded ? 'YES' : 'NO'}
            </span>
            <span style={{ color: '#888' }}>cached bg/tb/ta:</span>
            <span>{renderStats.pipelineDebug.cachedInstances.background}/{renderStats.pipelineDebug.cachedInstances.topBelow}/{renderStats.pipelineDebug.cachedInstances.topAbove}</span>
            <span style={{ color: '#888' }}>lastViewHash:</span>
            <span style={{ color: '#aaa', fontSize: '9px', wordBreak: 'break-all' }}>{renderStats.pipelineDebug.lastViewHash}</span>
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
            <button
              style={{ padding: '4px 8px', fontSize: '10px', background: '#2f2f2f', color: '#ddd', border: '1px solid #444', borderRadius: 4, cursor: 'pointer' }}
              onClick={() => {
                const text = JSON.stringify(renderStats.pipelineDebug, null, 2);
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(text).catch(() => {
                    // noop
                  });
                }
              }}
            >
              Copy pipeline debug
            </button>
          </div>
          {renderStats.pipelineDebug.samples && (
            <div style={{ marginTop: 8, fontSize: '10px', color: '#ccc' }}>
              <div style={{ color: '#888', marginBottom: 4 }}>Center pixel samples (RGBA):</div>
              <div>BG: {renderStats.pipelineDebug.samples.background ? Array.from(renderStats.pipelineDebug.samples.background).join(',') : 'n/a'}</div>
              <div>TopBelow: {renderStats.pipelineDebug.samples.topBelow ? Array.from(renderStats.pipelineDebug.samples.topBelow).join(',') : 'n/a'}</div>
            </div>
          )}
          {renderStats.pipelineDebug.renderHistory && renderStats.pipelineDebug.renderHistory.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#888', fontSize: '10px', marginBottom: 4 }}>Recent renders (most recent last):</div>
              <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: '10px' }}>
                {renderStats.pipelineDebug.renderHistory.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '1px 6px',
                      padding: '4px 6px',
                      backgroundColor: idx % 2 === 0 ? '#242424' : '#1e1e1e',
                      borderLeft: h.animationOnly ? '3px solid #4af' : '3px solid #4f4',
                    }}
                  >
                    <span style={{ color: '#888' }}>ts:</span><span>{h.timestamp.toFixed(1)} ms</span>
                    <span style={{ color: '#888' }}>reason:</span><span>{h.reason}</span>
                    <span style={{ color: '#888' }}>animOnly:</span><span>{h.animationOnly ? 'yes' : 'no'}</span>
                    <span style={{ color: '#888' }}>updatedAnim:</span><span>{h.updatedAnimations ? 'yes' : 'no'}</span>
                    <span style={{ color: '#888' }}>tilesetVer:</span><span>{h.tilesetVersion}</span>
                    <span style={{ color: '#888' }}>hadCaches:</span><span>{h.hadCaches ? 'yes' : 'no'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {renderStats.pipelineDebug?.renderMeta && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#888', fontSize: '10px', marginBottom: 4 }}>Last pass renders:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 6px', fontSize: '10px' }}>
                {(['background', 'topBelow', 'topAbove'] as const).map((pass) => {
                  const meta = (renderStats.pipelineDebug?.renderMeta as any)?.[pass];
                  return meta ? (
                    <React.Fragment key={pass}>
                      <span style={{ color: '#888' }}>{pass}:</span>
                      <span>{meta.instances} inst · {meta.width}x{meta.height} · {meta.timestamp.toFixed(1)}ms</span>
                    </React.Fragment>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Reflection Tile Grid - Critical for debugging reflection bugs */}
      {reflectionTileGrid && (
        <Section title="Reflection Tile Grid (5×5)">
          {/* Player/Movement State */}
          <div style={{ marginBottom: 8, padding: 6, backgroundColor: '#2a2a3a', borderRadius: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: '10px' }}>
              <span style={{ color: '#888' }}>Player:</span>
              <span>({reflectionTileGrid.playerTileX}, {reflectionTileGrid.playerTileY})</span>
              <span style={{ color: '#888' }}>Dest:</span>
              <span style={{ color: reflectionTileGrid.isMoving ? '#ff8' : '#888' }}>
                ({reflectionTileGrid.destTileX}, {reflectionTileGrid.destTileY})
              </span>
              <span style={{ color: '#888' }}>Moving:</span>
              <span style={{ color: reflectionTileGrid.isMoving ? '#4f4' : '#666' }}>
                {reflectionTileGrid.isMoving ? `YES (${reflectionTileGrid.moveDirection})` : 'NO'}
              </span>
            </div>
          </div>

          {/* Current Reflection State */}
          <div style={{
            marginBottom: 8,
            padding: 6,
            backgroundColor: reflectionTileGrid.currentReflectionState.hasReflection ? '#2a3a2a' : '#2a2a2a',
            borderRadius: 4,
            borderLeft: reflectionTileGrid.currentReflectionState.hasReflection ? '3px solid #4f4' : '3px solid #444',
          }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: 4 }}>Reflection State:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: '10px' }}>
              <span style={{ color: '#888' }}>Has Reflection:</span>
              <span style={{ color: reflectionTileGrid.currentReflectionState.hasReflection ? '#4f4' : '#f44' }}>
                {reflectionTileGrid.currentReflectionState.hasReflection ? 'YES' : 'NO'}
              </span>
              <span style={{ color: '#888' }}>Type:</span>
              <span style={{ color: '#4af' }}>
                {reflectionTileGrid.currentReflectionState.reflectionType ?? 'none'}
              </span>
              <span style={{ color: '#888' }}>Bridge:</span>
              <span>{reflectionTileGrid.currentReflectionState.bridgeType}</span>
            </div>
          </div>

          {/* 5x5 Grid Visualization */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: 4 }}>
              Grid: Player at center (0,0). Colors: 🟢=reflective, 🔴=not, 🟡=border
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 2,
              fontSize: '8px',
            }}>
              {reflectionTileGrid.tiles.map((row, rowIdx) =>
                row.map((tile, colIdx) => {
                  const isPlayer = tile.relativeX === 0 && tile.relativeY === 0;
                  const isDest = tile.worldX === reflectionTileGrid.destTileX && tile.worldY === reflectionTileGrid.destTileY;
                  const bgColor = isPlayer ? '#446' : tile.isBorder ? '#553' : tile.isReflective ? '#353' : '#333';
                  const borderColor = isDest && reflectionTileGrid.isMoving ? '#ff0' : isPlayer ? '#88f' : tile.isReflective ? '#4f4' : '#444';

                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      style={{
                        padding: 3,
                        backgroundColor: bgColor,
                        border: `2px solid ${borderColor}`,
                        borderRadius: 2,
                        textAlign: 'center',
                        minHeight: 40,
                      }}
                      title={`(${tile.worldX}, ${tile.worldY}) - ${tile.behaviorName} - Meta ${tile.metatileId}`}
                    >
                      <div style={{ color: tile.isReflective ? '#4f4' : '#888', fontWeight: 'bold' }}>
                        {tile.metatileId ?? '?'}
                      </div>
                      <div style={{ color: '#888', fontSize: '7px' }}>
                        {tile.relativeX},{tile.relativeY}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detailed tile info for tiles below player (y+1, y+2) - most relevant for reflection */}
          <div style={{ fontSize: '9px', color: '#888', marginBottom: 4 }}>
            Tiles Below Player (reflection scan area):
          </div>
          {[1, 2].map(yOffset => {
            const tile = reflectionTileGrid.tiles[2 + yOffset]?.[2]; // Center column (player X), offset Y
            if (!tile) return null;
            return (
              <div
                key={yOffset}
                style={{
                  marginBottom: 6,
                  padding: 6,
                  backgroundColor: tile.isReflective ? '#2a3a2a' : '#2a2a2a',
                  borderRadius: 4,
                  borderLeft: tile.isReflective ? '3px solid #4f4' : '3px solid #f44',
                  fontSize: '9px',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 4, color: tile.isReflective ? '#4f4' : '#f88' }}>
                  Y+{yOffset}: ({tile.worldX}, {tile.worldY}) {tile.isBorder ? '[BORDER]' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
                  <span style={{ color: '#666' }}>Metatile:</span>
                  <span>{tile.metatileId ?? 'null'} {tile.isSecondary ? '(2nd)' : '(1st)'}</span>
                  <span style={{ color: '#666' }}>Behavior:</span>
                  <span style={{ color: '#4af' }}>{tile.behavior} ({tile.behaviorName})</span>
                  <span style={{ color: '#666' }}>Reflective:</span>
                  <span style={{ color: tile.isReflective ? '#4f4' : '#f44' }}>
                    {tile.isReflective ? `YES (${tile.reflectionType})` : 'NO'}
                  </span>
                  <span style={{ color: '#666' }}>Pixel Mask:</span>
                  <span style={{ color: tile.hasPixelMask ? '#4f4' : '#f44' }}>
                    {tile.hasPixelMask ? `${tile.maskPixelCount}/256 px` : 'NONE'}
                  </span>
                  <span style={{ color: '#666' }}>Elevation:</span>
                  <span>{tile.elevation ?? 'null'}</span>
                  <span style={{ color: '#666' }}>Collision:</span>
                  <span>{tile.collision ?? 'null'}</span>
                  <span style={{ color: '#666' }}>Runtime:</span>
                  <span style={{ color: tile.runtimeFound ? '#4f4' : '#f44' }}>
                    {tile.runtimeFound ? 'FOUND' : 'MISSING'}
                  </span>
                  <span style={{ color: '#666' }}>Map:</span>
                  <span style={{ fontSize: '8px' }}>{tile.mapId?.replace('MAP_', '') ?? 'null'}</span>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* Shimmer (Reflection Distortion) */}
      {shimmer && (
        <Section title="Shimmer (Reflection)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <InfoRow label="Enabled" value={shimmer.enabled ? 'Yes' : 'No'} />
            <InfoRow label="GBA Frame" value={shimmer.gbaFrame} />
            <InfoRow label="Cycle Frame" value={`${shimmer.frameInCycle}/48`} />
            <InfoRow label="Scale X (M0)" value={shimmer.scaleX0.toFixed(5)} />
            <InfoRow label="Scale X (M1)" value={shimmer.scaleX1.toFixed(5)} />
          </div>
        </Section>
      )}

      {/* Render Stats - performance overview */}
      {renderStats && (
        <Section title="Render Stats">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <InfoRow label="Tiles" value={renderStats.tileCount.toLocaleString()} />
            <InfoRow label="FPS" value={renderStats.fps} />
            <InfoRow label="Render" value={`${renderStats.renderTimeMs.toFixed(2)} ms`} />
            <InfoRow label="WebGL2" value={renderStats.webgl2Supported ? 'Yes' : 'No'} />
            <InfoRow label="Viewport" value={`${renderStats.viewportTilesWide}×${renderStats.viewportTilesHigh}`} />
            <InfoRow label="Camera" value={`(${renderStats.cameraX}, ${renderStats.cameraY})`} />
          </div>
          <div style={{ marginTop: 4 }}>
            <InfoRow label="World" value={`${renderStats.worldWidthPx}×${renderStats.worldHeightPx}px`} />
            {renderStats.stitchedMapCount > 1 && (
              <InfoRow label="Stitched" value={`${renderStats.stitchedMapCount} maps`} highlight />
            )}
          </div>
        </Section>
      )}

      {truck && (
        <Section title="Truck Intro">
          <InfoRow label="Intro State" value={truck.introState} />
          <InfoRow label="Should Run" value={truck.shouldRun ? 'Yes' : 'No'} highlight={truck.shouldRun} />
          <InfoRow label="Active" value={truck.active ? 'Yes' : 'No'} highlight={truck.active} />
          <InfoRow label="Locked" value={truck.locked ? 'Yes' : 'No'} highlight={truck.locked} />
          <InfoRow label="Complete" value={truck.complete ? 'Yes' : 'No'} />
          <InfoRow label="Door Closed" value={truck.doorClosedApplied ? 'Yes' : 'No'} />
          <InfoRow label="Door Opened" value={truck.doorOpenedApplied ? 'Yes' : 'No'} />
          <InfoRow label="Frame" value={`${truck.lastGbaFrame} / ${truck.gbaFrame}`} />
          <InfoRow label="Camera" value={`(${truck.cameraOffsetX}, ${truck.cameraOffsetY})`} />
          <InfoRow
            label="Offsets"
            value={`B1(${truck.boxOffsets.box1X},${truck.boxOffsets.box1Y}) B2(${truck.boxOffsets.box2X},${truck.boxOffsets.box2Y}) B3(${truck.boxOffsets.box3X},${truck.boxOffsets.box3Y})`}
          />
          <div style={{ marginTop: 6, fontSize: '9px', color: '#aaa' }}>
            Box Runtime:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {truck.boxes.map((box) => (
              <div
                key={box.localId}
                style={{
                  padding: 6,
                  backgroundColor: '#252525',
                  borderLeft: box.spriteFailed ? '3px solid #f66' : box.spriteCached ? '3px solid #6f6' : '3px solid #666',
                  borderRadius: 4,
                  fontSize: '9px',
                }}
              >
                <div style={{ color: '#ddd', marginBottom: 3 }}>{box.localId}</div>
                <div style={{ color: '#888' }}>{box.graphicsId}</div>
                <div>tile=({box.tileX},{box.tileY}) sub=({box.subTileX},{box.subTileY})</div>
                <div>visible={box.visible ? 'yes' : 'no'} cached={box.spriteCached ? 'yes' : 'no'} failed={box.spriteFailed ? 'yes' : 'no'}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* GPU Slots - most critical WebGL info */}
      {mapStitching && (
        <Section title="GPU Tileset Slots">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              padding: 6,
              backgroundColor: '#2a2a3a',
              borderRadius: 4,
              borderLeft: '3px solid #88f',
            }}>
              <div style={{ fontSize: '9px', color: '#888', marginBottom: 2 }}>Slot 0</div>
              <div style={{ color: '#fff', fontSize: '11px' }}>
                {mapStitching.gpuSlot0?.replace('gTileset_', '').replace('+gTileset_', ' + ') ?? 'empty'}
              </div>
            </div>
            <div style={{
              padding: 6,
              backgroundColor: '#2a2a3a',
              borderRadius: 4,
              borderLeft: '3px solid #f88',
            }}>
              <div style={{ fontSize: '9px', color: '#888', marginBottom: 2 }}>Slot 1</div>
              <div style={{ color: '#fff', fontSize: '11px' }}>
                {mapStitching.gpuSlot1?.replace('gTileset_', '').replace('+gTileset_', ' + ') ?? 'empty'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: '10px', color: '#888' }}>
            Total tileset pairs: {mapStitching.tilesetPairs}
          </div>
        </Section>
      )}

      {/* Tileset Animation Debug */}
      {mapStitching?.tilesetAnimations && mapStitching.tilesetAnimations.length > 0 && (
        <Section title="Tileset Animations">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mapStitching.tilesetAnimations.map((info) => (
              <div
                key={`${info.slot}:${info.pairId}`}
                style={{
                  padding: 6,
                  backgroundColor: '#25252f',
                  borderRadius: 4,
                  borderLeft: info.slot === 0 ? '3px solid #88f' : info.slot === 1 ? '3px solid #f88' : '3px solid #8f8',
                }}
              >
                <div style={{ fontSize: '9px', color: '#888', marginBottom: 2 }}>
                  Slot {info.slot} · {info.pairId.replace('gTileset_', '').replace('+gTileset_', ' + ')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: '10px' }}>
                  <span style={{ color: '#888' }}>Animations:</span><span>{info.animationCount}</span>
                  <span style={{ color: '#888' }}>Destinations:</span><span>{info.destinationCount}</span>
                  <span style={{ color: '#888' }}>Frames:</span><span>{info.frameCount}</span>
                </div>
                {info.animationIds.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: '9px', color: '#aaa', wordBreak: 'break-word' }}>
                    {info.animationIds.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* World State */}
      {mapStitching && (
        <Section title="World State">
          <InfoRow label="Current Map" value={mapStitching.currentMap?.replace('MAP_', '') ?? 'None'} />
          <InfoRow label="Anchor Map" value={mapStitching.anchorMap.replace('MAP_', '')} />
          <InfoRow label="Player" value={`(${mapStitching.playerPos.x}, ${mapStitching.playerPos.y})`} />
        </Section>
      )}

      {/* Warp/Resolver State */}
      {warp && (
        <Section title="Resolver State">
          <InfoRow label="Version" value={warp.resolverVersion} />
          <InfoRow label="Last Warp" value={warp.lastWarpTo.replace('MAP_', '')} />
          <InfoRow label="Anchor" value={warp.currentAnchor.replace('MAP_', '')} />
          <InfoRow
            label="World Bounds"
            value={`(${warp.worldBounds.minX},${warp.worldBounds.minY}) ${warp.worldBounds.width}x${warp.worldBounds.height}`}
          />
        </Section>
      )}

      {/* Loaded Maps */}
      {mapStitching && mapStitching.loadedMaps.length > 0 && (
        <Section title={`Loaded Maps (${mapStitching.loadedMaps.length})`}>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            {mapStitching.loadedMaps.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '3px 0',
                  borderBottom: '1px solid #333',
                  fontSize: '9px',
                  color: m.id === mapStitching.currentMap ? '#ff8' : m.inGpu ? '#8f8' : '#f88',
                }}
              >
                <span>{m.id.replace('MAP_', '')}</span>
                <span style={{ color: '#888' }}>
                  ({m.offsetX},{m.offsetY}) {m.inGpu ? '✓GPU' : '✗GPU'}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Connections */}
      {mapStitching && mapStitching.expectedConnections.length > 0 && (
        <Section title="Connections">
          {mapStitching.expectedConnections.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: '9px',
                color: c.loaded ? '#8f8' : '#f88',
              }}
            >
              <span>{c.direction}</span>
              <span>
                {c.to.replace('MAP_', '')} {c.loaded ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Tileset Boundaries */}
      {mapStitching && mapStitching.boundaries.length > 0 && (
        <Section title={`Tileset Boundaries (${mapStitching.boundaries.length})`}>
          <div style={{ maxHeight: 100, overflowY: 'auto' }}>
            {mapStitching.boundaries.map((b, i) => (
              <div key={i} style={{ fontSize: '9px', color: '#f8f', padding: '2px 0' }}>
                @({b.x},{b.y}) {b.orientation} len:{b.length}
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 4,
            fontSize: '10px',
            color: mapStitching.nearbyBoundaryCount > 0 ? '#ff8' : '#888',
          }}>
            Nearby: {mapStitching.nearbyBoundaryCount} {mapStitching.nearbyBoundaryCount > 0 ? '(preloading)' : ''}
          </div>
        </Section>
      )}

      {/* GPU Slot Assignments (from warp state) */}
      {warp && warp.snapshotPairs.length > 0 && (
        <Section title="Tileset Pair → GPU Slot">
          {warp.snapshotPairs.map((p, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: '9px',
                color: '#88f',
              }}
            >
              <span>{p.replace('gTileset_', '').replace('+gTileset_', ' + ')}</span>
              <span style={{ color: warp.gpuSlots[p] !== undefined ? '#8f8' : '#f88' }}>
                → Slot {warp.gpuSlots[p] ?? 'NONE'}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* No WebGL state */}
      {!mapStitching && !warp && (
        <div style={{ color: '#666', fontStyle: 'italic', padding: 16 }}>
          No WebGL debug info available
        </div>
      )}
    </>
  );
};

// Reusable components - Collapsible Section
const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
}> = ({ title, children, defaultCollapsed = false, collapsible = false }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: '10px',
          fontWeight: 'bold',
          color: '#888',
          textTransform: 'uppercase',
          marginBottom: collapsed ? 0 : 8,
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={() => collapsible && setCollapsed(!collapsed)}
      >
        {collapsible && (
          <span style={{ fontSize: '8px', color: '#666' }}>
            {collapsed ? '▶' : '▼'}
          </span>
        )}
        {title}
      </div>
      {!collapsed && children}
    </div>
  );
};

const Checkbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 0',
      cursor: 'pointer',
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ cursor: 'pointer' }}
    />
    <span>{label}</span>
  </label>
);

const InfoRow: React.FC<{ label: string; value: React.ReactNode; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
    <span style={{ color: '#888' }}>{label}:</span>
    <span style={{ color: highlight ? '#4fc3f7' : '#fff' }}>{value}</span>
  </div>
);

const PlayerInfoDisplay: React.FC<{ info: PlayerDebugInfo }> = ({ info }) => (
  <div style={{ fontSize: '10px' }}>
    <InfoRow label="Tile" value={`(${info.tileX}, ${info.tileY})`} />
    <InfoRow label="Pixel" value={`(${info.pixelX.toFixed(1)}, ${info.pixelY.toFixed(1)})`} />
    <InfoRow label="Direction" value={info.direction} />
    <InfoRow label="Map" value={info.mapId.replace('MAP_', '')} />
    <InfoRow
      label="Moving"
      value={<span style={{ color: info.isMoving ? '#4a9eff' : '#666' }}>{info.isMoving ? 'YES' : 'NO'}</span>}
    />
    <InfoRow
      label="Surfing"
      value={<span style={{ color: info.isSurfing ? '#4af' : '#666' }}>{info.isSurfing ? 'YES' : 'NO'}</span>}
    />
    {info.isJumping && (
      <InfoRow
        label="Jumping"
        value={<span style={{ color: '#fa0' }}>YES</span>}
      />
    )}
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ color: '#888', marginBottom: 4, fontSize: '9px' }}>ELEVATION</div>
      <InfoRow label="Render (prev)" value={info.previousElevation} />
      <InfoRow label="Collision (cur)" value={info.currentElevation} />
    </div>
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
      <div style={{ color: '#888', marginBottom: 4, fontSize: '9px' }}>STATE</div>
      <InfoRow label="State" value={info.stateName.replace('State', '')} />
      <InfoRow
        label="Collision Check"
        value={
          <span style={{ color: info.hasCollisionChecker ? '#4f4' : '#f44' }}>
            {info.hasCollisionChecker ? 'ENABLED' : 'DISABLED'}
          </span>
        }
      />
    </div>
  </div>
);

const ObjectsAtTileDisplay: React.FC<{ info: ObjectsAtTileInfo }> = ({ info }) => (
  <div style={{ fontSize: '10px' }}>
    <InfoRow label="Position" value={`(${info.tileX}, ${info.tileY})`} />
    <InfoRow
      label="Has Collision"
      value={
        <span style={{ color: info.hasCollision ? '#f44' : '#4f4' }}>
          {info.hasCollision ? 'BLOCKED' : 'CLEAR'}
        </span>
      }
    />
    {info.npcs.length > 0 && (
      <div style={{ marginTop: 8 }}>
        <div style={{ color: '#888', marginBottom: 4 }}>NPCs ({info.npcs.length}):</div>
        {info.npcs.map((npc) => (
          <NPCDetailDisplay key={npc.id} npc={npc} />
        ))}
      </div>
    )}
    {info.items.length > 0 && (
      <div style={{ marginTop: 8 }}>
        <div style={{ color: '#888', marginBottom: 4 }}>Items ({info.items.length}):</div>
        {info.items.map((item) => (
          <ItemDetailDisplay key={item.id} item={item} />
        ))}
      </div>
    )}
    {info.npcs.length === 0 && info.items.length === 0 && (
      <div style={{ color: '#666', fontStyle: 'italic', marginTop: 4 }}>No objects</div>
    )}
  </div>
);

const NPCDetailDisplay: React.FC<{ npc: NPCObject }> = ({ npc }) => {
  const priority = getSpritePriorityForElevation(npc.elevation);
  const priorityColor = priority === 0 ? '#f4a' : priority === 1 ? '#4f4' : '#888';

  return (
    <div
      style={{
        backgroundColor: '#2a2a2a',
        padding: 6,
        borderRadius: 4,
        marginBottom: 4,
        fontSize: '9px',
      }}
    >
      <div style={{ color: '#4a9eff', fontWeight: 'bold', marginBottom: 4 }}>
        {npc.graphicsId.replace('OBJ_EVENT_GFX_', '')}
      </div>
      <InfoRow label="ID" value={npc.id} />
      <InfoRow label="Local ID" value={npc.localId ?? 'none'} />
      <InfoRow label="Position" value={`(${npc.tileX}, ${npc.tileY})`} />
      <InfoRow label="Elevation" value={npc.elevation} />
      <InfoRow
        label="Priority"
        value={<span style={{ color: priorityColor }}>P{priority}</span>}
      />
      <InfoRow label="Direction" value={npc.direction} />
      <InfoRow label="Movement" value={npc.movementType} />
      <InfoRow label="Script" value={npc.script.replace(/_EventScript_/g, '...')} />
      <InfoRow label="Flag" value={npc.flag || 'none'} />
      <InfoRow
        label="Visible"
        value={
          <span style={{ color: npc.visible ? '#4f4' : '#f44' }}>
            {npc.visible ? 'YES' : 'HIDDEN'}
          </span>
        }
      />
    </div>
  );
};

const NPCCompactDisplay: React.FC<{ npc: NPCObject }> = ({ npc }) => {
  const priority = getSpritePriorityForElevation(npc.elevation);
  // Priority 0 = above all BG layers (special), 1 = normal, 2/3 = lower
  const priorityColor = priority === 0 ? '#f4a' : priority === 1 ? '#4f4' : '#888';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '3px 0',
        borderBottom: '1px solid #333',
        fontSize: '9px',
      }}
    >
      <span style={{ color: '#4a9eff' }}>
        {npc.graphicsId.replace('OBJ_EVENT_GFX_', '')}
      </span>
      <span style={{ color: '#888' }}>
        ({npc.tileX}, {npc.tileY}) E{npc.elevation}{' '}
        <span style={{ color: priorityColor }}>P{priority}</span>{' '}
        {npc.direction[0].toUpperCase()}
      </span>
    </div>
  );
};

const NPCRuntimeDisplay: React.FC<{ npc: NPCObject; offscreenDespawned: boolean }> = ({
  npc,
  offscreenDespawned,
}) => {
  const hiddenByFlag = Boolean(npc.flag && npc.flag !== '0' && gameFlags.isSet(npc.flag));
  const states: string[] = [];
  if (npc.visible) {
    states.push('VISIBLE');
  } else if (hiddenByFlag) {
    states.push('FLAG_HIDDEN');
  } else {
    states.push('HIDDEN');
  }
  if (offscreenDespawned) states.push('OFFSCREEN');
  if (npc.scriptRemoved) states.push('SCRIPT_REMOVED');
  if (npc.spriteHidden) states.push('SPRITE_HIDDEN');

  return (
    <div
      style={{
        padding: '4px 0',
        borderBottom: '1px solid #333',
        fontSize: '9px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: '#4a9eff' }}>
          {npc.localId ?? npc.id}
        </span>
        <span style={{ color: '#888' }}>
          ({npc.tileX}, {npc.tileY}) init({npc.initialTileX}, {npc.initialTileY})
        </span>
      </div>
      <div style={{ marginTop: 2, color: '#ccc' }}>
        {states.join(' | ')}
      </div>
    </div>
  );
};

const ItemDetailDisplay: React.FC<{ item: ItemBallObject }> = ({ item }) => (
  <div
    style={{
      backgroundColor: '#2a2a2a',
      padding: 6,
      borderRadius: 4,
      marginBottom: 4,
      fontSize: '9px',
    }}
  >
    <div style={{ color: '#fa0', fontWeight: 'bold', marginBottom: 4 }}>
      {item.itemName}
    </div>
    <InfoRow label="ID" value={item.id} />
    <InfoRow label="Item ID" value={item.itemId} />
    <InfoRow label="Position" value={`(${item.tileX}, ${item.tileY})`} />
    <InfoRow label="Elevation" value={item.elevation} />
    <InfoRow label="Flag" value={item.flag || 'none'} />
    <InfoRow
      label="Collected"
      value={
        <span style={{ color: item.collected ? '#f44' : '#4f4' }}>
          {item.collected ? 'YES' : 'NO'}
        </span>
      }
    />
  </div>
);

const ItemCompactDisplay: React.FC<{ item: ItemBallObject }> = ({ item }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '3px 0',
      borderBottom: '1px solid #333',
      fontSize: '9px',
    }}
  >
    <span style={{ color: '#fa0' }}>{item.itemName}</span>
    <span style={{ color: '#888' }}>
      ({item.tileX}, {item.tileY}) E{item.elevation}
    </span>
  </div>
);

export default DebugPanel;

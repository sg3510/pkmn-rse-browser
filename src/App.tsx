import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { MapRenderer } from './components/MapRenderer';
import { GraphicDebug } from './components/GraphicDebug';
import type { MapIndexEntry } from './types/maps';
import mapIndex from './data/mapIndex.json';

const mapIndexData = mapIndex as MapIndexEntry[];

// Simple hash-based routing
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return hash;
}

const simplifyTilesetName = (id: string) => id.replace('gTileset_', '');

function App() {
  const hash = useHashRoute();

  // Route to debug pages
  if (hash === '#/graphic-debug') {
    return <GraphicDebug />;
  }

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

  const selectedMap =
    renderableMaps.find((map) => map.id === selectedMapId) || defaultMap || renderableMaps[0];

  if (!selectedMap) {
    return (
      <div className="App">
        <h1>Pkmn RSE Browser</h1>
        <p>Unable to load any maps.</p>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Pkmn RSE Browser</h1>

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
      </div>

      <div className="card">
        <MapRenderer
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
  );
}

export default App;

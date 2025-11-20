import { useMemo, useState } from 'react';
import './App.css';
import { MapRenderer } from './components/MapRenderer';
import type { MapIndexEntry } from './types/maps';
import mapIndex from './data/mapIndex.json';

const mapIndexData = mapIndex as MapIndexEntry[];

const simplifyTilesetName = (id: string) => id.replace('gTileset_', '');

function App() {
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
        <div className="selector__meta">
          <span>Tilesets: {simplifyTilesetName(selectedMap.primaryTilesetId)} / {simplifyTilesetName(selectedMap.secondaryTilesetId)}</span>
        </div>
      </div>

      <div className="card">
        <MapRenderer
          mapName={selectedMap.name}
          width={selectedMap.width}
          height={selectedMap.height}
          layoutPath={selectedMap.layoutPath}
          primaryTilesetPath={selectedMap.primaryTilesetPath}
          secondaryTilesetPath={selectedMap.secondaryTilesetPath}
        />
      </div>
    </div>
  );
}

export default App;

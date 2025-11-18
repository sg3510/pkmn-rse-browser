import './App.css'
import { MapRenderer } from './components/MapRenderer'

function App() {
  return (
    <div className="App">
      <h1>Pkmn RSE Browser</h1>
      <div className="card">
        <MapRenderer 
          mapName="LittlerootTown"
          width={20}
          height={20}
          layoutPath="data/layouts/LittlerootTown"
          primaryTilesetPath="data/tilesets/primary/general"
          secondaryTilesetPath="data/tilesets/secondary/petalburg"
        />
      </div>
    </div>
  )
}

export default App

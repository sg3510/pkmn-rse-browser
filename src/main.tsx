import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { GamePage } from './pages/GamePage.tsx'
import { LegacyCanvasPage } from './pages/LegacyCanvasPage.tsx'
import { WebGLTestPage } from './pages/WebGLTestPage.tsx'
import { SurfingSpriteDebugPage } from './pages/SurfingSpriteDebugPage.tsx'
import { GameRenderer } from './components/GameRenderer.tsx'
import { DialogProvider } from './components/dialog'
import { DialogDebugPage } from './pages/DialogDebugPage.tsx'

/**
 * Simple hash-based router for development/testing pages
 */
function Router() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Route to appropriate page
  if (route === '#/webgl-test') {
    return <WebGLTestPage />;
  }
  if (route === '#/legacy') {
    return <LegacyCanvasPage />;
  }
  if (route === '#/surfing-sprite') {
    return <SurfingSpriteDebugPage />;
  }
  if (route === '#/dialog-debug') {
    return <DialogDebugPage />;
  }
  // New unified GameRenderer (work in progress)
  if (route === '#/play' || route.startsWith('#/play?')) {
    return (
      <DialogProvider zoom={1}>
        <GameRenderer mapId="MAP_LITTLEROOT_TOWN" mapName="Littleroot Town" zoom={2} />
      </DialogProvider>
    );
  }

  // WebGL game page is the default
  return <GamePage />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)

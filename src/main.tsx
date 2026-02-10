import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { GamePage } from './pages/GamePage.tsx'
import { LegacyCanvasPage } from './pages/LegacyCanvasPage.tsx'
import { WebGLTestPage } from './pages/WebGLTestPage.tsx'
import { SurfingSpriteDebugPage } from './pages/SurfingSpriteDebugPage.tsx'
import { DialogDebugPage } from './pages/DialogDebugPage.tsx'
import Rayquaza3DDebugPage from './pages/Rayquaza3DDebugPage.tsx'
import Birch3DDebugPage from './pages/Birch3DDebugPage.tsx'

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
  if (route === '#/rayquaza-debug') {
    return <Rayquaza3DDebugPage />;
  }
  if (route === '#/birch-debug') {
    return <Birch3DDebugPage />;
  }
  // Canonical runtime path: GamePage (WebGL overworld)
  if (route === '#/play' || route.startsWith('#/play?')) {
    return <GamePage />;
  }

  // WebGL game page is the default
  return <GamePage />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)

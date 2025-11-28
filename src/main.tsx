import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WebGLTestPage } from './pages/WebGLTestPage.tsx'
import { WebGLMapPage } from './pages/WebGLMapPage.tsx'

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
  if (route === '#/webgl-map') {
    return <WebGLMapPage />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)

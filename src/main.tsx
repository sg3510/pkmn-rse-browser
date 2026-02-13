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
import { toPublicAssetUrl } from './utils/publicAssetUrl'

function ensurePublicAssetFontFaces(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const styleId = 'public-asset-font-faces';
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
@font-face {
  font-family: 'Pokemon Emerald';
  src: url('${toPublicAssetUrl('/fonts/pokemon-emerald.otf')}') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Pokemon Emerald Pro';
  src: url('${toPublicAssetUrl('/fonts/pokemon-emerald.otf')}') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Pokemon RS';
  src: url('${toPublicAssetUrl('/fonts/pokemon-rs.otf')}') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Pokemon GB';
  src: url('${toPublicAssetUrl('/fonts/pokemon-rs.otf')}') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;
  document.head.appendChild(style);
}

function setPublicAssetCssVariables(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--asset-menu-back-button-bg', `url("${toPublicAssetUrl('/img/back-button.png')}")`);
  rootStyle.setProperty('--asset-menu-icons-bg', `url("${toPublicAssetUrl('/img/menu-icons.png')}")`);
  rootStyle.setProperty('--asset-bag-icon-pockets-bg', `url("${toPublicAssetUrl('/img/bag-icon-pockets.png')}")`);
  rootStyle.setProperty('--asset-bag-icons-bg', `url("${toPublicAssetUrl('/img/bag-icons.png')}")`);
}

ensurePublicAssetFontFaces();
setPublicAssetCssVariables();

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

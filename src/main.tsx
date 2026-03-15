import { StrictMode, Suspense, lazy, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { GamePage } from './pages/GamePage.tsx'
import { toPublicAssetUrl } from './utils/publicAssetUrl'

const LegacyCanvasPage = lazy(async () => {
  const mod = await import('./pages/LegacyCanvasPage.tsx');
  return { default: mod.LegacyCanvasPage };
});

const WebGLTestPage = lazy(async () => {
  const mod = await import('./pages/WebGLTestPage.tsx');
  return { default: mod.WebGLTestPage };
});

const SurfingSpriteDebugPage = lazy(async () => {
  const mod = await import('./pages/SurfingSpriteDebugPage.tsx');
  return { default: mod.SurfingSpriteDebugPage };
});

const DialogDebugPage = lazy(async () => {
  const mod = await import('./pages/DialogDebugPage.tsx');
  return { default: mod.DialogDebugPage };
});

const Rayquaza3DDebugPage = lazy(() => import('./pages/Rayquaza3DDebugPage.tsx'));
const Birch3DDebugPage = lazy(() => import('./pages/Birch3DDebugPage.tsx'));

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
  let content = <GamePage />;

  if (route === '#/webgl-test') {
    content = <WebGLTestPage />;
  } else if (route === '#/legacy') {
    content = <LegacyCanvasPage />;
  } else if (route === '#/surfing-sprite') {
    content = <SurfingSpriteDebugPage />;
  } else if (route === '#/dialog-debug') {
    content = <DialogDebugPage />;
  } else if (route === '#/rayquaza-debug') {
    content = <Rayquaza3DDebugPage />;
  } else if (route === '#/birch-debug') {
    content = <Birch3DDebugPage />;
  } else if (route === '#/play' || route.startsWith('#/play?')) {
    content = <GamePage />;
  }

  return (
    <Suspense fallback={<div className="route-loading">Loading...</div>}>
      {content}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)

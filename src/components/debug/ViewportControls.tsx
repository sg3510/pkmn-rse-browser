import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ViewportConfig } from '../../config/viewport';

const MIN_VIEWPORT_TILES = 10;
const MAX_VIEWPORT_TILES = 50;

const VIEWPORT_PRESETS = [
  { label: 'GBA', tilesWide: 15, tilesHigh: 10 },
  { label: '20x20', tilesWide: 20, tilesHigh: 20 },
  { label: '25x18', tilesWide: 25, tilesHigh: 18 },
  { label: '30x20', tilesWide: 30, tilesHigh: 20 },
] as const;

function getMatchingViewportPreset(config: ViewportConfig): (typeof VIEWPORT_PRESETS)[number] | null {
  return VIEWPORT_PRESETS.find(
    (preset) => preset.tilesWide === config.tilesWide && preset.tilesHigh === config.tilesHigh
  ) ?? null;
}

function clampViewportTiles(value: number): number {
  return Math.max(MIN_VIEWPORT_TILES, Math.min(MAX_VIEWPORT_TILES, Math.trunc(value)));
}

function isViewportDraft(value: string): boolean {
  return value === '' || /^[0-9]+$/.test(value);
}

function parseViewportDraft(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export const ViewportControls: React.FC<{
  config: ViewportConfig;
  onChange: (config: ViewportConfig) => void;
  variant?: 'panel' | 'toolbar' | 'embedded';
}> = ({ config, onChange, variant = 'panel' }) => {
  const [customMode, setCustomMode] = useState(() => getMatchingViewportPreset(config) === null);
  const [widthDraft, setWidthDraft] = useState(() => String(config.tilesWide));
  const [heightDraft, setHeightDraft] = useState(() => String(config.tilesHigh));

  useEffect(() => {
    setWidthDraft(String(config.tilesWide));
  }, [config.tilesWide]);

  useEffect(() => {
    setHeightDraft(String(config.tilesHigh));
  }, [config.tilesHigh]);

  useEffect(() => {
    if (getMatchingViewportPreset(config) === null) {
      setCustomMode(true);
    }
  }, [config.tilesHigh, config.tilesWide]);

  const applyViewportUpdate = useCallback((next: Partial<ViewportConfig>) => {
    onChange({
      ...config,
      ...next,
    });
  }, [config, onChange]);

  const updateWidthDraft = useCallback((value: string) => {
    if (!isViewportDraft(value)) return;
    setWidthDraft(value);
    const parsed = parseViewportDraft(value);
    if (parsed !== null && parsed >= MIN_VIEWPORT_TILES && parsed <= MAX_VIEWPORT_TILES) {
      applyViewportUpdate({ tilesWide: parsed });
    }
  }, [applyViewportUpdate]);

  const updateHeightDraft = useCallback((value: string) => {
    if (!isViewportDraft(value)) return;
    setHeightDraft(value);
    const parsed = parseViewportDraft(value);
    if (parsed !== null && parsed >= MIN_VIEWPORT_TILES && parsed <= MAX_VIEWPORT_TILES) {
      applyViewportUpdate({ tilesHigh: parsed });
    }
  }, [applyViewportUpdate]);

  const commitWidthDraft = useCallback(() => {
    const parsed = parseViewportDraft(widthDraft);
    if (parsed !== null) {
      applyViewportUpdate({ tilesWide: clampViewportTiles(parsed) });
      return;
    }
    setWidthDraft(String(config.tilesWide));
  }, [applyViewportUpdate, config.tilesWide, widthDraft]);

  const commitHeightDraft = useCallback(() => {
    const parsed = parseViewportDraft(heightDraft);
    if (parsed !== null) {
      applyViewportUpdate({ tilesHigh: clampViewportTiles(parsed) });
      return;
    }
    setHeightDraft(String(config.tilesHigh));
  }, [applyViewportUpdate, config.tilesHigh, heightDraft]);

  const handleDraftKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLInputElement>,
    commitDraft: () => void,
    resetDraft: () => void,
  ) => {
    if (event.key === 'Enter') {
      commitDraft();
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Escape') {
      resetDraft();
      event.currentTarget.blur();
    }
  }, []);

  const isToolbar = variant === 'toolbar';
  const isEmbedded = variant === 'embedded';
  const showHeading = isToolbar || isEmbedded;
  const matchingPreset = getMatchingViewportPreset(config);
  const customActive = customMode || matchingPreset === null;
  const tileSummary = `${config.tilesWide}x${config.tilesHigh} tiles`;
  const pixelSummary = `${config.tilesWide * 16}x${config.tilesHigh * 16}px`;
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 0,
    width: isToolbar || isEmbedded ? 'min(100%, 380px)' : '100%',
    maxWidth: '100%',
    padding: isToolbar ? '0.7rem 0.8rem' : 0,
    background: isToolbar ? '#0f131c' : 'transparent',
    border: isToolbar ? '1px solid #242a38' : 'none',
    borderRadius: isToolbar ? 8 : 0,
  };
  const headingStyle: CSSProperties = {
    fontSize: showHeading ? 11 : 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#b8d5ff',
  };
  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
    minWidth: 0,
  };
  const labelStyle: CSSProperties = {
    minWidth: 50,
    paddingTop: 4,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#7f92b0',
  };
  const presetWrapStyle: CSSProperties = {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    minWidth: 0,
  };
  const inputWrapStyle: CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    minWidth: 0,
  };
  const inputStyle: CSSProperties = {
    width: 56,
    padding: '4px 6px',
    fontSize: 11,
    fontFamily: 'monospace',
    background: '#0b0e16',
    color: '#fff',
    border: '1px solid #2d3646',
    borderRadius: 4,
  };
  const metaStyle: CSSProperties = {
    fontSize: 10,
    color: '#7f92b0',
  };

  return (
    <div style={containerStyle}>
      {showHeading && <div style={headingStyle}>Viewport</div>}

      <div style={rowStyle}>
        <span style={labelStyle}>Snap</span>
        <div style={presetWrapStyle}>
          {VIEWPORT_PRESETS.map((preset) => {
            const isActive = !customActive
              && matchingPreset?.tilesWide === preset.tilesWide
              && matchingPreset.tilesHigh === preset.tilesHigh;

            return (
              <button
                key={preset.label}
                onClick={() => {
                  setCustomMode(false);
                  onChange({ tilesWide: preset.tilesWide, tilesHigh: preset.tilesHigh });
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  background: isActive ? '#4a90d9' : '#192234',
                  color: isActive ? '#fff' : '#c8d6f2',
                  border: isActive ? '1px solid #4a90d9' : '1px solid #2d3646',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            onClick={() => setCustomMode(true)}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              fontFamily: 'monospace',
              background: customActive ? '#4a90d9' : '#192234',
              color: customActive ? '#fff' : '#c8d6f2',
              border: customActive ? '1px solid #4a90d9' : '1px solid #2d3646',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Custom
          </button>
        </div>
      </div>

      {customActive && (
        <div style={rowStyle}>
          <span style={labelStyle}>Custom</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={inputWrapStyle}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cdd7f1' }}>
                <span>W</span>
                <input
                  type="number"
                  aria-label="Viewport width in tiles"
                  min={MIN_VIEWPORT_TILES}
                  max={MAX_VIEWPORT_TILES}
                  step={1}
                  inputMode="numeric"
                  value={widthDraft}
                  onChange={(event) => updateWidthDraft(event.target.value)}
                  onBlur={commitWidthDraft}
                  onKeyDown={(event) => handleDraftKeyDown(
                    event,
                    commitWidthDraft,
                    () => setWidthDraft(String(config.tilesWide)),
                  )}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cdd7f1' }}>
                <span>H</span>
                <input
                  type="number"
                  aria-label="Viewport height in tiles"
                  min={MIN_VIEWPORT_TILES}
                  max={MAX_VIEWPORT_TILES}
                  step={1}
                  inputMode="numeric"
                  value={heightDraft}
                  onChange={(event) => updateHeightDraft(event.target.value)}
                  onBlur={commitHeightDraft}
                  onKeyDown={(event) => handleDraftKeyDown(
                    event,
                    commitHeightDraft,
                    () => setHeightDraft(String(config.tilesHigh)),
                  )}
                  style={inputStyle}
                />
              </label>
              <span style={metaStyle}>
                {MIN_VIEWPORT_TILES}-{MAX_VIEWPORT_TILES} tiles
              </span>
            </div>
            <div style={metaStyle}>
              {tileSummary} · {pixelSummary}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

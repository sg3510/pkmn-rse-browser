import React, { useState } from 'react';
import { DialogProvider, useDialog, DialogBox } from '../components/dialog';
import type { DialogConfig } from '../components/dialog/types';

// Font options based on public/fonts
const FONTS = [
  { name: 'Pokemon Emerald', value: '"Pokemon Emerald", monospace' },
  { name: 'Pokemon RS', value: '"Pokemon RS", monospace' },
  { name: 'PKMN RSEU', value: '"PKMN RSEU", monospace' },
];

const SAMPLE_TEXT = "Hello! \nThis is a sample text to test the font rendering.\nDoes it look like the original game?";

const Viewport: React.FC<{ font: string }> = ({ font: _font }) => {
  const { showMessage, showYesNo } = useDialog();
  const [width, _setWidth] = useState(480);
  const [height, _setHeight] = useState(320);
  const [customText, setCustomText] = useState(SAMPLE_TEXT);

  // Update dialog config when font changes
  // We need to access the internal context to update config, but DialogProvider 
  // doesn't expose a setConfig. 
  // Instead, we can remount the provider when font changes in the parent.
  // But here we are inside the provider.
  
  // Actually, the DialogProvider takes a `config` prop. 
  // So the parent should handle the provider.
  
  // This component just triggers the dialogs.
  
  const handleShowText = () => {
    showMessage(SAMPLE_TEXT);
  };

  const handleShowCustomText = () => {
    showMessage(customText || '');
  };

  const handleShowYesNo = async () => {
    const result = await showYesNo("Do you like this font?");
    if (result) {
      showMessage("Great! I like it too!");
    } else {
      showMessage("Oh, that's too bad.");
    }
  };

  return (
    <div style={{ 
      position: 'relative', 
      width, 
      height, 
      backgroundColor: '#70c8a0', // Light green bg
      border: '2px solid #333',
      margin: '20px auto',
      overflow: 'hidden'
    }}>
      <div style={{ padding: 20 }}>
        <p>Viewport: {width}x{height}</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button onClick={handleShowText}>Show Text</button>
            <button onClick={handleShowYesNo}>Show Yes/No</button>
        </div>

        <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <label style={{ fontWeight: 600 }}>Custom message</label>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={4}
            style={{ width: '100%', resize: 'vertical', padding: 8, fontFamily: 'monospace' }}
            placeholder="Type dialog text here. Use \n for new lines."
          />
          <button onClick={handleShowCustomText}>Show Custom Message</button>
        </div>
      </div>
      
      {/* The DialogBox is absolutely positioned over this viewport */}
      <DialogBox viewportWidth={width} viewportHeight={height} />
    </div>
  );
};

export const DialogDebugPage: React.FC = () => {
  const [selectedFont, setSelectedFont] = useState(FONTS[0].value);
  const [zoom, setZoom] = useState(2);

  const configOverride: Partial<DialogConfig> = {
    fontFamily: selectedFont,
    textSpeed: 'medium',
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Dialog Font Debug</h1>
      
      <div style={{ marginBottom: 20 }}>
        <label style={{ marginRight: 10 }}>
          Font:
          <select 
            value={selectedFont} 
            onChange={(e) => setSelectedFont(e.target.value)}
            style={{ marginLeft: 5, padding: 5 }}
          >
            {FONTS.map(f => (
              <option key={f.name} value={f.value}>{f.name}</option>
            ))}
          </select>
        </label>

        <label>
          Zoom:
          <select 
            value={zoom} 
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ marginLeft: 5, padding: 5 }}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
        </label>
      </div>

      <p>Selected Font Family: <code>{selectedFont}</code></p>

      {/* We key the provider to force remount when font changes, ensuring config update */}
      <DialogProvider key={selectedFont + zoom} config={configOverride} zoom={zoom}>
        <Viewport font={selectedFont} />
      </DialogProvider>

      <div style={{ marginTop: 20, fontSize: '0.8em', color: '#666' }}>
        <p>Note: 'PKMN RSEU' might not render if the browser doesn't support .FON files.</p>
      </div>
    </div>
  );
};

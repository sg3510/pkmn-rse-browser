# Dialog System Implementation Plan

## Overview

This document outlines the implementation of a Pokemon Emerald-style dialog system for the browser-based RSE viewer. The system will render text boxes at the bottom of the screen with authentic styling, typewriter text effects, and option menus.

---

## 1. Research Summary: Pokeemerald Dialog System

### 1.1 Window Frame System

**Source:** `pokeemerald/src/text_window.c`, `pokeemerald/graphics/text_window/`

- **20 different frame styles** available (user-selectable in options)
- Each frame uses a **9-slice/3x3 tile grid** pattern:
  ```
  ┌─────┬─────┬─────┐
  │ TL  │  T  │ TR  │   (8x8 pixels each)
  ├─────┼─────┼─────┤
  │  L  │  C  │  R  │   Total: 24x24 source image
  ├─────┼─────┼─────┤
  │ BL  │  B  │ BR  │
  └─────┴─────┴─────┘
  ```
- **Corners** are drawn once, **edges** repeat/tile to fill width/height
- **Center** tile fills the interior (usually solid or subtle pattern)

**Frame Graphics Location:** `public/pokeemerald/graphics/text_window/{1-20}.png`

**Message Box Background:** `public/pokeemerald/graphics/text_window/message_box.png`
- Teal/green horizontal strip that tiles as the dialog background
- Used for the main message area (distinct from menu frames)

### 1.2 Font System

**Source:** `pokeemerald/src/text.c`, `pokeemerald/graphics/fonts/`

| Font Type | Width | Height | Use Case |
|-----------|-------|--------|----------|
| FONT_NORMAL | 6px | 16px | Default dialog text |
| FONT_SMALL | 5px | 12px | Compact UI elements |
| FONT_SHORT | 6px | 14px | Slightly shorter |
| FONT_NARROW | 5px | 16px | Narrow spacing |
| FONT_SMALL_NARROW | 5px | 8px | Very compact |

**Font Graphics:** `public/pokeemerald/graphics/fonts/latin_normal.png`
- Spritesheet with all characters in a grid
- Variable-width glyphs (each character has specific width)
- Cyan (#00FFFF) background = transparent

**Custom OTF Font Available:** `public/font/pokemon-emerald.otf`
- Can be used with CSS `@font-face` for simpler implementation
- Trade-off: Less authentic pixel rendering but much easier

**Text Colors (4-bit palette indices):**
```
0x0 = Transparent
0x1 = White (background)
0x2 = Dark Gray (default text)
0x3 = Light Gray (shadow)
0x4 = Red
0x6 = Green
0x8 = Blue
```

### 1.3 Text Rendering Pipeline

**Source:** `pokeemerald/src/text.c` lines 271-1200

**Render States:**
1. `HANDLE_CHAR` - Process next character
2. `WAIT` - Wait for button press (▼ indicator shown)
3. `CLEAR` - Clear window after button press
4. `SCROLL_START` / `SCROLL` - Smooth scroll animation
5. `PAUSE` - Timed pause (N frames)

**Control Codes (0xFC prefix):**
| Code | Function |
|------|----------|
| `0xFC 0x01 {n}` | Change text color |
| `0xFC 0x02 {n}` | Change background color |
| `0xFC 0x03 {n}` | Change shadow color |
| `0xFC 0x08 {n}` | Pause for N frames |
| `0xFC 0x09` | Wait for button press |
| `0xFC 0x11` | Clear window |

**Special Characters:**
| Code | Function |
|------|----------|
| `0xFE` | Newline |
| `0xFA` | Wait + scroll |
| `0xFB` | Wait + clear |
| `0xFD {id}` | Placeholder (player name, etc.) |

**Down Arrow Animation:**
- Shows when more text available
- 4-frame bounce animation (Y offsets: 0, 1, 2, 1)
- Cycles every 8 frames
- Graphics: `public/pokeemerald/graphics/fonts/down_arrow.png`

### 1.4 Yes/No and Option Menus

**Source:** `pokeemerald/src/menu.c`, `pokeemerald/src/script_menu.c`

**Yes/No Dialog:**
- Separate small window (typically 6x4 tiles)
- Positioned near main dialog (usually top-right)
- Two options with cursor indicator
- Returns: 0 = Yes, 1 = No, -1 = B pressed (cancel)

**Multichoice Menus:**
- Dynamic width based on longest option text
- Each option takes 16px vertical space (1 tile + padding)
- Horizontal padding: 8px from left edge
- Cursor: Small triangle or hand indicator

**Menu Positioning:**
- Menus can appear at various positions
- Auto-adjust to avoid going off-screen
- Typically anchored to corner or relative to dialog

### 1.5 GBA Screen Dimensions

- Original GBA: **240x160 pixels**
- Dialog box typically: **240x48 pixels** (full width, 3 tile rows)
- Menu window: Variable, typically 48-96px wide

---

## 2. React Implementation Plan

### 2.1 Component Architecture

```
src/components/dialog/
├── DialogSystem.tsx        # Main container & state machine
├── DialogBox.tsx           # Message box with text
├── DialogFrame.tsx         # 9-slice border renderer
├── DialogText.tsx          # Typewriter text with effects
├── OptionMenu.tsx          # Yes/No and multichoice menus
├── DialogArrow.tsx         # Animated down arrow
├── useDialog.ts            # Hook for triggering dialogs
└── types.ts                # TypeScript interfaces
```

### 2.2 Configuration Options

```typescript
// types.ts
export interface DialogConfig {
  // Layout
  maxWidth: number;           // Max width in pixels (default: 480)
  minWidth: number;           // Min width in pixels (default: 240)
  widthPercent: number;       // Percentage of viewport (default: 80)
  padding: number;            // Inner padding in pixels (default: 16)
  bottomOffset: number;       // Distance from bottom (default: 16)

  // Text
  linesVisible: number;       // Lines shown at once (default: 2, max: 4)
  fontSize: number;           // Font size in pixels (default: 16)
  lineHeight: number;         // Line height multiplier (default: 1.5)
  fontFamily: string;         // Font family (default: 'Pokemon Emerald')

  // Animation
  textSpeed: 'slow' | 'medium' | 'fast' | 'instant';
  charDelayMs: number;        // Ms per character (overrides textSpeed)
  scrollDurationMs: number;   // Scroll animation duration (default: 200)
  arrowBounceMs: number;      // Arrow animation cycle (default: 500)

  // Appearance
  frameStyle: number;         // 1-20, or 0 for custom
  usePixelFont: boolean;      // Use spritesheet vs OTF (default: false)
  backgroundColor: string;    // Fallback if no frame (default: '#188888')
  textColor: string;          // Main text color (default: '#303030')
  shadowColor: string;        // Text shadow (default: '#a0a0a0')

  // Behavior
  advanceKey: string[];       // Keys to advance (default: ['Space', 'Enter', 'z'])
  cancelKey: string[];        // Keys to cancel/select No (default: ['Escape', 'x'])
  allowSkip: boolean;         // Allow skipping text animation (default: true)
}

export interface DialogMessage {
  text: string;               // The message text
  speaker?: string;           // Optional speaker name
  portrait?: string;          // Optional portrait image path
  autoAdvance?: boolean;      // Auto-advance after delay
  autoAdvanceMs?: number;     // Delay before auto-advance
}

export interface DialogChoice {
  label: string;              // Display text
  value: string | number;     // Return value
  disabled?: boolean;         // Gray out option
}

export interface DialogOptions {
  choices: DialogChoice[];
  defaultIndex?: number;      // Initially selected (default: 0)
  cancelable?: boolean;       // Can press B to cancel (default: true)
  cancelValue?: string | number; // Value returned on cancel
  position?: 'auto' | 'left' | 'right' | 'center';
}
```

### 2.3 Core Components

#### DialogSystem.tsx (Main Container)
```typescript
interface DialogSystemProps {
  config?: Partial<DialogConfig>;
  children: React.ReactNode;  // Game content
}

interface DialogState {
  isOpen: boolean;
  messages: DialogMessage[];
  currentMessageIndex: number;
  currentCharIndex: number;
  isTextComplete: boolean;
  isScrolling: boolean;
  options: DialogOptions | null;
  selectedOptionIndex: number;
}
```

**Responsibilities:**
- Manages dialog queue and state machine
- Handles keyboard input
- Provides context to child components
- Calculates responsive sizing based on viewport

#### DialogBox.tsx (Message Container)
```typescript
interface DialogBoxProps {
  message: DialogMessage;
  config: DialogConfig;
  isTextComplete: boolean;
  onTextComplete: () => void;
  showArrow: boolean;
}
```

**Responsibilities:**
- Renders the message box container
- Manages overflow and scrolling
- Positions within viewport

#### DialogFrame.tsx (9-Slice Border)
```typescript
interface DialogFrameProps {
  frameStyle: number;         // 1-20
  width: number;
  height: number;
  className?: string;
}
```

**Implementation Options:**

**Option A: CSS border-image (Recommended)**
```css
.dialog-frame {
  border-width: 8px;
  border-style: solid;
  border-image: url('/pokeemerald/graphics/text_window/1.png') 8 fill repeat;
}
```

**Option B: Canvas 9-slice**
```typescript
// Slice source image and draw corners + tiled edges
const drawNineSlice = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number, y: number,
  width: number, height: number,
  sliceSize: number = 8
) => {
  // Draw 4 corners
  // Draw 4 edges (tiled)
  // Fill center
};
```

**Option C: CSS Grid with background tiles**
```css
.dialog-frame {
  display: grid;
  grid-template: 8px 1fr 8px / 8px 1fr 8px;
}
.corner-tl { background: url('...') 0 0; }
.edge-top { background: url('...') -8px 0 repeat-x; }
/* etc. */
```

#### DialogText.tsx (Typewriter Effect)
```typescript
interface DialogTextProps {
  text: string;
  charIndex: number;          // Current visible character count
  config: DialogConfig;
  onCharRendered?: () => void;
}
```

**Typewriter Implementation:**
```typescript
const DialogText: React.FC<DialogTextProps> = ({ text, charIndex, config }) => {
  const visibleText = text.slice(0, charIndex);
  const lines = visibleText.split('\n');

  // Handle overflow - only show last N lines
  const visibleLines = lines.slice(-config.linesVisible);

  return (
    <div className="dialog-text" style={{
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      lineHeight: config.lineHeight,
      color: config.textColor,
      textShadow: `1px 1px 0 ${config.shadowColor}`,
    }}>
      {visibleLines.map((line, i) => (
        <div key={i}>{line || '\u00A0'}</div>
      ))}
    </div>
  );
};
```

#### OptionMenu.tsx (Yes/No & Multichoice)
```typescript
interface OptionMenuProps {
  options: DialogOptions;
  selectedIndex: number;
  onSelect: (choice: DialogChoice) => void;
  config: DialogConfig;
}
```

**Layout:**
```typescript
const OptionMenu: React.FC<OptionMenuProps> = ({
  options, selectedIndex, onSelect, config
}) => {
  // Calculate position relative to dialog box
  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    right: config.padding,
    bottom: '100%',  // Above the dialog
    marginBottom: 8,
  };

  return (
    <div className="option-menu" style={menuStyle}>
      <DialogFrame frameStyle={config.frameStyle} width="auto" height="auto">
        {options.choices.map((choice, i) => (
          <div
            key={i}
            className={`option ${i === selectedIndex ? 'selected' : ''}`}
            style={{
              padding: '4px 16px 4px 24px',
              opacity: choice.disabled ? 0.5 : 1,
            }}
          >
            {i === selectedIndex && <span className="cursor">▶</span>}
            {choice.label}
          </div>
        ))}
      </DialogFrame>
    </div>
  );
};
```

#### DialogArrow.tsx (Bouncing Arrow)
```typescript
const DialogArrow: React.FC<{ visible: boolean }> = ({ visible }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 4);
    }, 125); // 8 frames at 60fps ≈ 133ms, using 125 for smoothness
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const yOffsets = [0, 1, 2, 1];

  return (
    <div
      className="dialog-arrow"
      style={{
        position: 'absolute',
        right: 8,
        bottom: 8,
        transform: `translateY(${yOffsets[frame]}px)`,
      }}
    >
      ▼
    </div>
  );
};
```

### 2.4 Hook API

```typescript
// useDialog.ts
interface UseDialogReturn {
  // Show a simple message
  showMessage: (text: string, options?: Partial<DialogMessage>) => Promise<void>;

  // Show multiple messages in sequence
  showMessages: (messages: DialogMessage[]) => Promise<void>;

  // Show Yes/No dialog
  showYesNo: (
    text: string,
    options?: { defaultYes?: boolean }
  ) => Promise<boolean>;

  // Show multichoice menu
  showChoice: <T extends string | number>(
    text: string,
    choices: Array<{ label: string; value: T; disabled?: boolean }>,
    options?: { cancelable?: boolean; defaultIndex?: number }
  ) => Promise<T | null>;

  // Close any open dialog
  close: () => void;

  // Check if dialog is currently open
  isOpen: boolean;
}

// Usage example:
const dialog = useDialog();

// Simple message
await dialog.showMessage("Hello, trainer!");

// Yes/No
const confirmed = await dialog.showYesNo("Would you like to save?");
if (confirmed) { /* save */ }

// Multiple choices
const choice = await dialog.showChoice(
  "What would you like to do?",
  [
    { label: "Battle", value: "battle" },
    { label: "Trade", value: "trade" },
    { label: "Cancel", value: "cancel" },
  ]
);
```

### 2.5 Text Processing

**Handling Long Text:**
```typescript
interface TextProcessor {
  // Split text into pages based on visible lines
  paginate: (text: string, linesPerPage: number) => string[];

  // Calculate text dimensions
  measureText: (text: string, config: DialogConfig) => { width: number; height: number };

  // Process special placeholders
  interpolate: (text: string, variables: Record<string, string>) => string;
}

// Example paginate implementation
function paginateText(text: string, linesPerPage: number): string[] {
  const lines = text.split('\n');
  const pages: string[] = [];

  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join('\n'));
  }

  return pages;
}
```

**Word Wrapping:**
```typescript
function wrapText(text: string, maxWidth: number, measureFn: (s: string) => number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (measureFn(testLine) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}
```

### 2.6 Responsive Sizing

```typescript
function calculateDialogSize(
  viewportWidth: number,
  viewportHeight: number,
  config: DialogConfig
): { width: number; height: number; x: number; y: number } {
  // Calculate width
  let width = viewportWidth * (config.widthPercent / 100);
  width = Math.min(width, config.maxWidth);
  width = Math.max(width, config.minWidth);

  // Calculate height based on visible lines
  const lineHeightPx = config.fontSize * config.lineHeight;
  const contentHeight = config.linesVisible * lineHeightPx;
  const height = contentHeight + (config.padding * 2) + 16; // +16 for frame

  // Center horizontally, position at bottom
  const x = (viewportWidth - width) / 2;
  const y = viewportHeight - height - config.bottomOffset;

  return { width, height, x, y };
}
```

### 2.7 State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                        CLOSED                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ showMessage() / showChoice()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       PRINTING                               │
│  - Advance charIndex each tick                              │
│  - On complete: → WAITING                                   │
│  - On skip (A pressed): Jump to complete → WAITING          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Text complete
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       WAITING                                │
│  - Show down arrow (if more pages)                          │
│  - On A press:                                              │
│    - If more pages: → SCROLLING                             │
│    - If has options: → CHOOSING                             │
│    - Else: → CLOSED                                         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│       SCROLLING         │   │         CHOOSING            │
│  - Animate scroll up    │   │  - Arrow keys move cursor   │
│  - On complete:         │   │  - A selects option         │
│    → PRINTING (next)    │   │  - B cancels (if allowed)   │
└─────────────────────────┘   │  - On select: → CLOSED      │
                              └─────────────────────────────┘
```

---

## 3. File Structure

```
src/
├── components/
│   └── dialog/
│       ├── DialogSystem.tsx
│       ├── DialogBox.tsx
│       ├── DialogFrame.tsx
│       ├── DialogText.tsx
│       ├── OptionMenu.tsx
│       ├── DialogArrow.tsx
│       ├── DialogContext.tsx
│       ├── useDialog.ts
│       ├── types.ts
│       ├── textUtils.ts
│       └── dialog.css
│
public/
├── font/
│   └── pokemon-emerald.otf
├── pokeemerald/
│   └── graphics/
│       ├── text_window/
│       │   ├── 1.png ... 20.png    (Frame styles)
│       │   └── message_box.png     (Background)
│       └── fonts/
│           ├── latin_normal.png    (Pixel font)
│           └── down_arrow.png      (Arrow animation)
```

---

## 4. CSS Styling

```css
/* dialog.css */

@font-face {
  font-family: 'Pokemon Emerald';
  src: url('/font/pokemon-emerald.otf') format('opentype');
}

.dialog-system {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
}

.dialog-system.open {
  pointer-events: auto;
}

.dialog-backdrop {
  position: absolute;
  inset: 0;
  background: transparent;
  /* Optional: background: rgba(0, 0, 0, 0.2); for dim effect */
}

.dialog-container {
  position: absolute;
  bottom: var(--dialog-bottom-offset, 16px);
  left: 50%;
  transform: translateX(-50%);
  width: var(--dialog-width, 80%);
  max-width: var(--dialog-max-width, 480px);
  min-width: var(--dialog-min-width, 240px);
}

.dialog-box {
  position: relative;
  background-color: #188888;
  padding: var(--dialog-padding, 16px);
  image-rendering: pixelated;
}

/* 9-slice frame using border-image */
.dialog-frame-1 {
  border: 8px solid transparent;
  border-image: url('/pokeemerald/graphics/text_window/1.png') 8 fill round;
}

.dialog-frame-5 {
  border: 8px solid transparent;
  border-image: url('/pokeemerald/graphics/text_window/5.png') 8 fill round;
}

/* Generate classes for all 20 frames */

.dialog-text {
  font-family: 'Pokemon Emerald', monospace;
  font-size: 16px;
  line-height: 1.5;
  color: #303030;
  text-shadow: 1px 1px 0 #a0a0a0;
  white-space: pre-wrap;
  overflow: hidden;
}

.dialog-arrow {
  position: absolute;
  right: 12px;
  bottom: 8px;
  color: #303030;
  animation: arrow-bounce 0.5s steps(4) infinite;
}

@keyframes arrow-bounce {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(1px); }
  50% { transform: translateY(2px); }
  75% { transform: translateY(1px); }
}

.option-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 16px;
}

.option-menu .option {
  position: relative;
  padding: 4px 16px 4px 24px;
  font-family: 'Pokemon Emerald', monospace;
  font-size: 16px;
  color: #303030;
  cursor: pointer;
}

.option-menu .option.selected::before {
  content: '▶';
  position: absolute;
  left: 8px;
}

.option-menu .option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-menu .option:hover:not(.disabled) {
  background: rgba(0, 0, 0, 0.1);
}
```

---

## 5. Implementation Phases

### Phase 1: Basic Dialog Box
- [ ] DialogSystem container with context
- [ ] DialogFrame with 9-slice rendering
- [ ] Static text display
- [ ] Basic open/close functionality
- [ ] Responsive sizing

### Phase 2: Text Animation
- [ ] Typewriter effect with configurable speed
- [ ] Skip animation on keypress
- [ ] Multi-page text handling
- [ ] Scroll animation between pages
- [ ] Down arrow indicator

### Phase 3: Option Menus
- [ ] Yes/No dialog
- [ ] Multichoice menu
- [ ] Keyboard navigation (up/down/confirm/cancel)
- [ ] Menu positioning

### Phase 4: Polish & Configuration
- [ ] All 20 frame styles
- [ ] Full config options
- [ ] Sound effects integration hooks
- [ ] Portrait/speaker name support
- [ ] Accessibility (screen reader support)

### Phase 5: Advanced Features (Optional)
- [ ] Pixel font rendering from spritesheet
- [ ] Text color control codes
- [ ] Variable interpolation
- [ ] Auto-advance timers

---

## 6. Usage Example

```tsx
// App.tsx
import { DialogProvider } from './components/dialog/DialogContext';
import { useDialog } from './components/dialog/useDialog';

function App() {
  return (
    <DialogProvider config={{
      frameStyle: 1,
      textSpeed: 'medium',
      linesVisible: 2,
    }}>
      <Game />
    </DialogProvider>
  );
}

// Game.tsx
function Game() {
  const dialog = useDialog();

  const handleNPCInteraction = async () => {
    await dialog.showMessage("Hello there, trainer!");
    await dialog.showMessage("Would you like to hear about our\nspecial offers today?");

    const interested = await dialog.showYesNo("Are you interested?");

    if (interested) {
      const choice = await dialog.showChoice(
        "What interests you?",
        [
          { label: "Poke Balls", value: "balls" },
          { label: "Potions", value: "potions" },
          { label: "TMs", value: "tms" },
          { label: "Never mind", value: "cancel" },
        ]
      );

      if (choice && choice !== "cancel") {
        await dialog.showMessage(`Great choice! Here are our ${choice}!`);
      }
    } else {
      await dialog.showMessage("Come back anytime!");
    }
  };

  return (
    <MapRenderer onNPCInteract={handleNPCInteraction} />
  );
}
```

---

## 7. Key Decisions to Make

1. **Font Rendering**: OTF font (simpler) vs pixel spritesheet (more authentic)?
   - Recommendation: Start with OTF, add pixel option later

2. **Frame Rendering**: CSS border-image vs Canvas?
   - Recommendation: CSS border-image for simplicity

3. **State Management**: React Context vs external store (Zustand)?
   - Recommendation: React Context is sufficient

4. **Animation Timing**: requestAnimationFrame vs setInterval?
   - Recommendation: requestAnimationFrame for smooth 60fps

5. **Text Measurement**: Canvas measureText vs DOM measurement?
   - Recommendation: DOM with `getBoundingClientRect` for accuracy with custom font

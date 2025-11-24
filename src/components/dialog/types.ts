/**
 * Dialog System Types
 *
 * Based on pokeemerald text window system.
 * Supports scaling with zoom levels and responsive viewport sizing.
 */

export interface DialogConfig {
  // Layout (in base pixels - will be scaled by zoom)
  maxWidthTiles: number;      // Max width in 8px tiles (default: 30 = 240px at 1x)
  minWidthTiles: number;      // Min width in 8px tiles (default: 20 = 160px at 1x)
  paddingTiles: number;       // Inner padding in tiles (default: 1 = 8px at 1x)
  bottomOffsetTiles: number;  // Distance from bottom in tiles (default: 1)

  // Text
  linesVisible: number;       // Lines shown at once (default: 2, max: 4)
  fontSizeBase: number;       // Base font size in pixels (default: 8, scales with zoom)
  lineHeightMultiplier: number; // Line height multiplier (default: 2 = 16px per line at 1x)

  // Animation
  textSpeed: TextSpeed;
  charDelayMs: number;        // Ms per character (calculated from textSpeed if not set)
  scrollDurationMs: number;   // Scroll animation duration (default: 150)

  // Appearance
  frameStyle: number;         // 1-20 for authentic frames
  textColor: string;          // Main text color (default: '#303030')
  shadowColor: string;        // Text shadow (default: '#a0a0a0')
  shadowOffsetX: number;      // Shadow X offset in pixels (default: 1)
  shadowOffsetY: number;      // Shadow Y offset in pixels (default: 1)

  // Behavior
  advanceKeys: string[];      // Keys to advance (default: ['Space', 'Enter', 'KeyZ'])
  cancelKeys: string[];       // Keys to cancel (default: ['Escape', 'KeyX'])
  allowSkip: boolean;         // Allow skipping text animation (default: true)
}

export type TextSpeed = 'slow' | 'medium' | 'fast' | 'instant';

export const TEXT_SPEED_DELAYS: Record<TextSpeed, number> = {
  slow: 50,
  medium: 25,
  fast: 10,
  instant: 0,
};

export const DEFAULT_DIALOG_CONFIG: DialogConfig = {
  maxWidthTiles: 30,          // 240px at 1x
  minWidthTiles: 20,          // 160px at 1x
  paddingTiles: 1,            // 8px at 1x
  bottomOffsetTiles: 1,       // 8px from bottom at 1x

  linesVisible: 2,
  fontSizeBase: 16,           // 16px base - scaled up for readability
  lineHeightMultiplier: 1.5,  // 24px line height at 1x (16 * 1.5)

  textSpeed: 'medium',
  charDelayMs: TEXT_SPEED_DELAYS.medium,
  scrollDurationMs: 150,

  frameStyle: 1,
  textColor: '#303030',
  shadowColor: '#a0a0a0',
  shadowOffsetX: 1,
  shadowOffsetY: 1,

  advanceKeys: ['Space', 'Enter', 'KeyX'],  // X = A button (confirm)
  cancelKeys: ['Escape', 'KeyZ'],           // Z = B button (cancel)
  allowSkip: true,
};

export interface DialogMessage {
  text: string;               // The message text (supports \n for newlines)
  speaker?: string;           // Optional speaker name
  autoAdvance?: boolean;      // Auto-advance after delay
  autoAdvanceMs?: number;     // Delay before auto-advance (default: 2000)
}

export interface DialogChoice {
  label: string;              // Display text
  value: string | number | boolean;     // Return value when selected
  disabled?: boolean;         // Gray out option
}

export interface DialogOptions {
  choices: DialogChoice[];
  defaultIndex?: number;      // Initially selected (default: 0)
  cancelable?: boolean;       // Can press B/Escape to cancel (default: true)
  cancelValue?: string | number | boolean | null; // Value returned on cancel (default: null)
}

export type DialogState =
  | { type: 'closed' }
  | { type: 'printing'; messageIndex: number; charIndex: number }
  | { type: 'waiting'; messageIndex: number }
  | { type: 'scrolling'; messageIndex: number; scrollProgress: number }
  | { type: 'choosing'; messageIndex: number; selectedIndex: number };

export interface DialogContextValue {
  // State
  state: DialogState;
  messages: DialogMessage[];
  options: DialogOptions | null;
  config: DialogConfig;
  zoom: number;

  // Actions (internal - use hook methods instead)
  _dispatch: (action: DialogAction) => void;
  _resolve: ((value: unknown) => void) | null;
  _setResolve: (fn: ((value: unknown) => void) | null) => void;
  _getResolve: () => ((value: unknown) => void) | null;
}

export type DialogAction =
  | { type: 'OPEN'; messages: DialogMessage[]; options?: DialogOptions }
  | { type: 'ADVANCE_CHAR' }
  | { type: 'COMPLETE_TEXT' }
  | { type: 'START_SCROLL' }
  | { type: 'FINISH_SCROLL' }
  | { type: 'SHOW_OPTIONS'; options: DialogOptions }
  | { type: 'SELECT_OPTION'; index: number }
  | { type: 'MOVE_CURSOR'; direction: 'up' | 'down' }
  | { type: 'CONFIRM_OPTION' }
  | { type: 'CANCEL' }
  | { type: 'CLOSE' }
  | { type: 'NEXT_MESSAGE' };

// Utility type for the hook return
export interface UseDialogReturn {
  showMessage: (text: string, options?: Partial<DialogMessage>) => Promise<void>;
  showMessages: (messages: DialogMessage[]) => Promise<void>;
  showYesNo: (text: string, options?: { defaultYes?: boolean }) => Promise<boolean>;
  showChoice: <T extends string | number>(
    text: string,
    choices: Array<{ label: string; value: T; disabled?: boolean }>,
    options?: { cancelable?: boolean; defaultIndex?: number }
  ) => Promise<T | null>;
  close: () => void;
  isOpen: boolean;
}

// Constants for frame rendering
export const TILE_SIZE = 8;         // Base tile size in pixels
export const FRAME_TILE_COUNT = 3;  // 3x3 tiles for 9-slice frame
export const FRAME_STYLES_COUNT = 20;

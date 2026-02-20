/**
 * Dialog System Types
 *
 * Pixel-perfect Pokemon Emerald dialog system.
 * Based on pokeemerald text window system.
 *
 * GBA Specifications:
 * - Tile size: 8x8 pixels
 * - Standard dialog: 27 tiles wide x 4 tiles high (216x32 px at 1x)
 * - Frame: 9-slice from 24x24 (3x3 tiles) source graphics
 * - Text: 8px baseline, 1px shadow offset
 * - Lines visible: 2 at a time, scrolls for overflow
 */

import { GameButton } from '../../core/InputMap';

// === Core Constants ===

/** Base tile size in pixels (GBA standard) */
export const TILE_SIZE = 8;

/** Number of frame styles available (1-20) */
export const FRAME_STYLES_COUNT = 20;

/** Standard dialog dimensions in tiles */
export const DIALOG_DIMENSIONS = {
  /** Standard width: 30 tiles = 240px at 1x (full GBA width) */
  widthTiles: 30,
  /** Standard height: 5.5 tiles = 44px at 1x (fits 2 lines + padding) */
  heightTiles: 5.5,
  /** Inner padding: 1 tile on each side */
  paddingTiles: 1,
  /** Distance from bottom of screen: 0 tiles (flush with bottom in GBA viewport) */
  bottomOffsetTiles: 0,
  /** Left offset from screen edge: 2 tiles (centered) */
  leftOffsetTiles: 2,
} as const;

/** Yes/No menu dimensions in tiles */
export const YESNO_DIMENSIONS = {
  /** Width: 6 tiles = 48px at 1x (includes frame) */
  widthTiles: 6,
  /** Height: 6 tiles = 48px at 1x (fits 2 options + frame padding) */
  heightTiles: 6,
} as const;

/** Text rendering specs */
export const TEXT_SPECS = {
  /** Base font size in pixels (scales with zoom) - 16px for readability */
  fontSizePx: 16,
  /** Line height multiplier (16px * 1.5 = 24px per line at 1x) */
  lineHeightMultiplier: 1.5,
  /** Shadow offset - ALWAYS 1px, does not scale */
  shadowOffsetX: 1,
  shadowOffsetY: 1,
  /** Maximum lines visible at once */
  maxVisibleLines: 2,
  /** Characters per line (approximate for Pokemon font) */
  charsPerLine: 25,
} as const;

/** Text speed delays in milliseconds per character */
export const TEXT_SPEED_DELAYS = {
  slow: 50,
  medium: 25,
  fast: 10,
  instant: 0,
} as const;

export type TextSpeed = keyof typeof TEXT_SPEED_DELAYS;

// === Configuration Types ===

export interface DialogConfig {
  /** Text reveal speed */
  textSpeed: TextSpeed;
  /** Frame style (1-20) */
  frameStyle: number;
  /** Main text color (default: dark gray) */
  textColor: string;
  /** Shadow color (default: light gray) */
  shadowColor: string;
  /** Font family (default: "Pokemon Emerald") */
  fontFamily: string;
  /** Buttons to advance/confirm (default: A) */
  advanceKeys: GameButton[];
  /** Buttons to cancel (default: B) */
  cancelKeys: GameButton[];
  /** Allow skipping text animation */
  allowSkip: boolean;
  /** Scroll animation duration in ms */
  scrollDurationMs: number;
}

export const DEFAULT_CONFIG: DialogConfig = {
  textSpeed: 'medium',
  frameStyle: 1,
  textColor: '#303030',
  shadowColor: '#a8a8a8',
  fontFamily: '"Pokemon Emerald", "Pokemon RS", monospace',
  advanceKeys: [GameButton.A],
  cancelKeys: [GameButton.B],
  allowSkip: true,
  scrollDurationMs: 150,
};

// === Message Types ===

export interface DialogMessage {
  /** The message text (supports \n for newlines) */
  text: string;
  /** Optional speaker name (not currently rendered) */
  speaker?: string;
  /** Auto-advance after delay instead of waiting for input */
  autoAdvance?: boolean;
  /** Delay before auto-advance in ms (default: 2000) */
  autoAdvanceMs?: number;
  /** How to transition INTO this message from the previous one */
  transition?: 'scroll' | 'clear';
  /** Number of chars already visible after a scroll transition (skip typewriter for these) */
  prefilledChars?: number;
}

// === Choice/Menu Types ===

export interface DialogChoice<T = unknown> {
  /** Display text */
  label: string;
  /** Return value when selected */
  value: T;
  /** Gray out option (still selectable but styled differently) */
  disabled?: boolean;
}

export interface DialogMenuPosition {
  /** Menu left offset as a ratio of viewport width (0..1) */
  leftRatio: number;
  /** Menu top offset as a ratio of viewport height (0..1) */
  topRatio: number;
}

export interface DialogOptions<T = unknown> {
  /** Available choices */
  choices: DialogChoice<T>[];
  /** Initially selected index (default: 0) */
  defaultIndex?: number;
  /** Can press B/cancel to dismiss (default: true) */
  cancelable?: boolean;
  /** Value returned on cancel (default: null) */
  cancelValue?: T | null;
  /** Optional viewport-relative menu placement override */
  menuPosition?: DialogMenuPosition;
  /** Called when the highlighted choice changes (before confirm) */
  onSelectionChange?: (index: number) => void;
}

// === Text Input Types ===

export interface DialogTextInput {
  /** Initial value shown in the entry field */
  initialValue?: string;
  /** Maximum length for input (default: 12) */
  maxLength?: number;
  /** Allow submitting an empty value (default: false) */
  allowEmpty?: boolean;
  /** Allow canceling with B/cancel keys (default: true) */
  cancelable?: boolean;
  /** Optional key mapper (return appended text, or null to ignore key) */
  mapKey?: (event: KeyboardEvent) => string | null;
  /** Optional normalization before resolving */
  normalize?: (value: string) => string;
}

// === State Machine Types ===

export type DialogStateType =
  | 'closed'
  | 'printing'    // Text being revealed character by character
  | 'waiting'     // Text complete, waiting for input
  | 'scrolling'   // Scrolling text up for overflow
  | 'choosing'    // Showing options menu
  | 'editing';    // Showing text input entry

export interface DialogStateClosed {
  type: 'closed';
}

export interface DialogStatePrinting {
  type: 'printing';
  messageIndex: number;
  charIndex: number;
}

export interface DialogStateWaiting {
  type: 'waiting';
  messageIndex: number;
}

export interface DialogStateScrolling {
  type: 'scrolling';
  messageIndex: number;
  scrollProgress: number; // 0 to 1
}

export interface DialogStateChoosing {
  type: 'choosing';
  messageIndex: number;
  selectedIndex: number;
}

export interface DialogStateEditing {
  type: 'editing';
  messageIndex: number;
  value: string;
}

export type DialogState =
  | DialogStateClosed
  | DialogStatePrinting
  | DialogStateWaiting
  | DialogStateScrolling
  | DialogStateChoosing
  | DialogStateEditing;

// === Action Types (for reducer) ===

export type DialogAction =
  | { type: 'OPEN'; messages: DialogMessage[]; options?: DialogOptions; textInput?: DialogTextInput }
  | { type: 'START_SCROLL' }
  | { type: 'UPDATE_SCROLL'; progress: number }
  | { type: 'FINISH_SCROLL' }
  | { type: 'SHOW_OPTIONS'; options: DialogOptions }
  | { type: 'START_EDITING'; initialValue: string }
  | { type: 'UPDATE_INPUT'; value: string }
  | { type: 'SELECT_OPTION'; index: number }
  | { type: 'CONFIRM_OPTION' }
  | { type: 'CANCEL' }
  | { type: 'CLOSE' }
  | { type: 'NEXT_MESSAGE' };

// === Hook Return Types ===

export interface UseDialogReturn {
  /** Show a single message */
  showMessage: (text: string, options?: Partial<DialogMessage>) => Promise<void>;
  /** Show multiple messages in sequence (optionally with choices) */
  showMessages: (messages: DialogMessage[], options?: DialogOptions) => Promise<unknown>;
  /** Show Yes/No prompt, returns true for Yes, false for No/Cancel */
  showYesNo: (text: string, options?: { defaultYes?: boolean }) => Promise<boolean>;
  /** Show choice menu, returns selected value or null on cancel */
  showChoice: <T>(
    text: string,
    choices: Array<{ label: string; value: T; disabled?: boolean }>,
    options?: { cancelable?: boolean; defaultIndex?: number; menuPosition?: DialogMenuPosition; onSelectionChange?: (index: number) => void }
  ) => Promise<T | null>;
  /** Show a message + text entry field, returns entered value or null on cancel */
  showTextEntry: (text: string, input?: DialogTextInput) => Promise<string | null>;
  /** Close dialog immediately */
  close: () => void;
  /** Whether dialog is currently open */
  isOpen: boolean;
}

// === Context Types ===

export interface DialogContextValue {
  state: DialogState;
  messages: DialogMessage[];
  options: DialogOptions | null;
  textInput: DialogTextInput | null;
  config: DialogConfig;
  zoom: number;
  /** Viewport dimensions in pixels (for responsive menus) */
  viewport: { width: number; height: number };
  dispatch: (action: DialogAction) => void;
  setResolve: (fn: ((value: unknown) => void) | null) => void;
  getResolve: () => ((value: unknown) => void) | null;
}

// === Utility Functions ===

/** Convert tiles to pixels at given zoom */
export function tilesToPx(tiles: number, zoom: number = 1): number {
  return tiles * TILE_SIZE * zoom;
}

/** Convert pixels to tiles (rounded) */
export function pxToTiles(px: number, zoom: number = 1): number {
  return Math.round(px / (TILE_SIZE * zoom));
}

/** Get frame image path for a style number (1-20) */
export function getFramePath(style: number): string {
  const clampedStyle = Math.max(1, Math.min(FRAME_STYLES_COUNT, style));
  return `/pokeemerald/graphics/text_window/${clampedStyle}.png`;
}

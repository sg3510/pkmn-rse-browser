/**
 * Imperative bridge for the React dialog system.
 *
 * This lets non-React state classes (e.g. GameState renderers) use the
 * shared DialogContext-powered UI instead of re-implementing message boxes.
 */

import type { DialogMenuPosition, DialogTextInput } from './types';

export interface DialogBridgeApi {
  showMessage: (text: string) => Promise<void>;
  showChoice: <T>(
    text: string,
    choices: Array<{ label: string; value: T; disabled?: boolean }>,
    options?: { cancelable?: boolean; defaultIndex?: number; menuPosition?: DialogMenuPosition; onSelectionChange?: (index: number) => void }
  ) => Promise<T | null>;
  showTextEntry: (text: string, input?: DialogTextInput) => Promise<string | null>;
  close: () => void;
  isOpen: () => boolean;
}

let dialogBridgeApi: DialogBridgeApi | null = null;

export function registerDialogBridge(api: DialogBridgeApi): void {
  dialogBridgeApi = api;
}

export function unregisterDialogBridge(): void {
  dialogBridgeApi = null;
}

export function getDialogBridge(): DialogBridgeApi | null {
  return dialogBridgeApi;
}

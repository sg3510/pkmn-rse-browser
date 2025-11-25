/**
 * Dialog System - Pokemon Emerald style dialog boxes
 *
 * Usage:
 * 1. Wrap your app with <DialogProvider>
 * 2. Use the useDialog() hook to show messages
 * 3. Render <DialogBox> in your viewport component
 *
 * Example:
 * ```tsx
 * // In your root component:
 * <DialogProvider zoom={2}>
 *   <App />
 * </DialogProvider>
 *
 * // In your viewport component:
 * <DialogBox viewportWidth={width} viewportHeight={height} />
 *
 * // In any component:
 * const { showYesNo, showMessage } = useDialog();
 * const wantsToSurf = await showYesNo("The water is dyed a deep blue…\nWould you like to SURF?");
 * ```
 */

// Main components
export { DialogProvider, useDialog, useDialogContext } from './DialogContext';
export { DialogBox } from './DialogBox';
export { DialogFrame } from './DialogFrame';
export { DialogText, DialogArrow } from './DialogText';
export { OptionMenu, YesNoMenu } from './OptionMenu';

// Types
export type {
  DialogConfig,
  DialogMessage,
  DialogChoice,
  DialogOptions,
  DialogState,
  DialogAction,
  UseDialogReturn,
  TextSpeed,
} from './types';

// Constants
export {
  TILE_SIZE,
  FRAME_STYLES_COUNT,
  DIALOG_DIMENSIONS,
  YESNO_DIMENSIONS,
  TEXT_SPECS,
  TEXT_SPEED_DELAYS,
  DEFAULT_CONFIG,
  tilesToPx,
  pxToTiles,
  getFramePath,
} from './types';

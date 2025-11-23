// Dialog System - Main exports
export { DialogSystem, useDialog, DEFAULT_DIALOG_CONFIG } from './DialogSystem';
export { DialogProvider, useDialogContext } from './DialogContext';
export { DialogBox } from './DialogBox';
export { DialogFrame, DialogFrameCanvas } from './DialogFrame';
export { DialogText } from './DialogText';
export { DialogArrow } from './DialogArrow';
export { OptionMenu } from './OptionMenu';
export { DialogDemo } from './DialogDemo';

// Types
export type {
  DialogConfig,
  DialogMessage,
  DialogChoice,
  DialogOptions,
  DialogState,
  TextSpeed,
  UseDialogReturn,
} from './types';

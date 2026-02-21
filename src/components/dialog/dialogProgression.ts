import type { DialogMessage } from './types';

export const DIALOG_PROGRESSION_ACTION = {
  NEXT_MESSAGE: 'NEXT_MESSAGE',
  START_SCROLL: 'START_SCROLL',
  SHOW_OPTIONS: 'SHOW_OPTIONS',
  START_EDITING: 'START_EDITING',
  CLOSE_AND_RESOLVE_VOID: 'CLOSE_AND_RESOLVE_VOID',
  NOOP: 'NOOP',
} as const;

export type DialogProgressionAction =
  typeof DIALOG_PROGRESSION_ACTION[keyof typeof DIALOG_PROGRESSION_ACTION];

interface DialogProgressionParams {
  messageIndex: number;
  messageCount: number;
  hasOptions: boolean;
  hasTextInput: boolean;
  nextMessageTransition?: DialogMessage['transition'];
}

export function getDialogProgressionAction(params: DialogProgressionParams): DialogProgressionAction {
  const {
    messageIndex,
    messageCount,
    hasOptions,
    hasTextInput,
    nextMessageTransition,
  } = params;

  if (
    !Number.isFinite(messageIndex)
    || !Number.isFinite(messageCount)
    || messageCount <= 0
    || messageIndex < 0
    || messageIndex >= messageCount
  ) {
    return DIALOG_PROGRESSION_ACTION.NOOP;
  }

  const isLastMessage = messageIndex === messageCount - 1;
  if (!isLastMessage) {
    if (nextMessageTransition === 'scroll') {
      return DIALOG_PROGRESSION_ACTION.START_SCROLL;
    }
    return DIALOG_PROGRESSION_ACTION.NEXT_MESSAGE;
  }

  if (hasOptions) {
    return DIALOG_PROGRESSION_ACTION.SHOW_OPTIONS;
  }

  if (hasTextInput) {
    return DIALOG_PROGRESSION_ACTION.START_EDITING;
  }

  return DIALOG_PROGRESSION_ACTION.CLOSE_AND_RESOLVE_VOID;
}

interface PromptResolutionProgressionParams extends DialogProgressionParams {
  stateType: 'printing' | 'waiting';
}

export function getProgressionActionForResolvedPrompt(
  params: PromptResolutionProgressionParams,
): DialogProgressionAction {
  // Boundary-race recovery: when the prompt resolves before React commits
  // printing->waiting, we still run the same progression decision.
  if (params.stateType !== 'printing' && params.stateType !== 'waiting') {
    return DIALOG_PROGRESSION_ACTION.NOOP;
  }

  return getDialogProgressionAction(params);
}

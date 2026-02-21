/**
 * DialogContext - React context and state management for dialog system
 *
 * Provides:
 * - DialogProvider wrapper component
 * - useDialog hook for showing messages/menus
 * - State machine for dialog flow
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import type {
  DialogConfig,
  DialogState,
  DialogAction,
  DialogMessage,
  DialogOptions,
  DialogTextInput,
  DialogContextValue,
  UseDialogReturn,
} from './types';
import { DEFAULT_CONFIG, TEXT_SPEED_DELAYS } from './types';
import { inputMap } from '../../core/InputMap';
import { consumeModalInputEvent, getModalInputAction } from '../../core/input/modalKeyRouting';
import { PromptController } from '../../core/prompt/PromptController';
import { paginateDialogText } from './textPagination';
import {
  DIALOG_PROGRESSION_ACTION,
  getProgressionActionForResolvedPrompt,
} from './dialogProgression';

// === Context ===

const DialogContext = createContext<DialogContextValue | null>(null);

// === Provider ===

interface DialogProviderProps {
  children: React.ReactNode;
  config?: Partial<DialogConfig>;
  zoom?: number;
  /** Viewport dimensions in pixels (for responsive menus) */
  viewport?: { width: number; height: number };
}

export const DialogProvider: React.FC<DialogProviderProps> = ({
  children,
  config: configOverrides,
  zoom = 1,
  viewport = { width: 240, height: 160 },
}) => {
  const config: DialogConfig = { ...DEFAULT_CONFIG, ...configOverrides };

  // Store messages and options in refs to avoid unnecessary re-renders
  const messagesRef = useRef<DialogMessage[]>([]);
  const optionsRef = useRef<DialogOptions | null>(null);
  const textInputRef = useRef<DialogTextInput | null>(null);
  const resolveRef = useRef<((value: unknown) => void) | null>(null);
  const promptControllerRef = useRef(new PromptController());
  const activePromptKeyRef = useRef<string | null>(null);
  const dialogRunIdRef = useRef(0);

  const [state, setState] = useState<DialogState>({ type: 'closed' });
  const stateRef = useRef<DialogState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const closeDialogState = useCallback(() => {
    messagesRef.current = [];
    optionsRef.current = null;
    textInputRef.current = null;
    promptControllerRef.current.clear();
    activePromptKeyRef.current = null;
    return { type: 'closed' } as DialogState;
  }, []);

  const dispatch = useCallback((action: DialogAction) => {
    setState((currentState) => {
      switch (action.type) {
        case 'OPEN':
          dialogRunIdRef.current += 1;
          messagesRef.current = action.messages;
          optionsRef.current = action.options ?? null;
          textInputRef.current = action.textInput ?? null;
          promptControllerRef.current.clear();
          activePromptKeyRef.current = null;
          return { type: 'printing', messageIndex: 0, charIndex: 0 };

        case 'START_SCROLL':
          if (currentState.type === 'waiting') {
            return { type: 'scrolling', messageIndex: currentState.messageIndex, scrollProgress: 0 };
          }
          return currentState;

        case 'UPDATE_SCROLL':
          if (currentState.type === 'scrolling') {
            return { ...currentState, scrollProgress: action.progress };
          }
          return currentState;

        case 'FINISH_SCROLL':
          if (currentState.type === 'scrolling') {
            const nextMsg = messagesRef.current[currentState.messageIndex + 1];
            const prefilled = nextMsg?.prefilledChars ?? 0;
            return { type: 'printing', messageIndex: currentState.messageIndex + 1, charIndex: prefilled };
          }
          return currentState;

        case 'SHOW_OPTIONS':
          if (currentState.type === 'waiting') {
            optionsRef.current = action.options;
            return {
              type: 'choosing',
              messageIndex: currentState.messageIndex,
              selectedIndex: action.options.defaultIndex ?? 0,
            };
          }
          return currentState;

        case 'START_EDITING':
          if (currentState.type === 'waiting') {
            return {
              type: 'editing',
              messageIndex: currentState.messageIndex,
              value: action.initialValue,
            };
          }
          return currentState;

        case 'UPDATE_INPUT':
          if (currentState.type === 'editing') {
            return { ...currentState, value: action.value };
          }
          return currentState;

        case 'SELECT_OPTION':
          if (currentState.type === 'choosing') {
            return { ...currentState, selectedIndex: action.index };
          }
          return currentState;

        case 'NEXT_MESSAGE':
          if (currentState.type === 'waiting') {
            const nextIndex = currentState.messageIndex + 1;
            if (nextIndex < messagesRef.current.length) {
              return { type: 'printing', messageIndex: nextIndex, charIndex: 0 };
            }
            return closeDialogState();
          }
          return currentState;

        case 'CONFIRM_OPTION':
        case 'CANCEL':
        case 'CLOSE':
          return closeDialogState();

        default:
          return currentState;
      }
    });
  }, [closeDialogState]);

  // Start/restart prompt controller for each printed message.
  useEffect(() => {
    if (state.type !== 'printing') {
      if (state.type !== 'waiting') {
        promptControllerRef.current.clear();
        activePromptKeyRef.current = null;
      }
      return;
    }

    const currentMessage = messagesRef.current[state.messageIndex];
    if (!currentMessage) {
      return;
    }

    const key = `${dialogRunIdRef.current}:${state.messageIndex}`;
    if (activePromptKeyRef.current === key) {
      return;
    }

    activePromptKeyRef.current = key;
    promptControllerRef.current.clear();
    void promptControllerRef.current.showMessage(currentMessage.text, {
      initialVisibleChars: state.charIndex,
    });
  }, [state]);

  // Sync prompt rendering/timing (shared with battle/evolution prompt controller semantics).
  useEffect(() => {
    if (state.type !== 'printing' && state.type !== 'waiting') {
      return;
    }

    const promptController = promptControllerRef.current;
    const delayMs = TEXT_SPEED_DELAYS[config.textSpeed];
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      promptController.tick(dt, delayMs);

      const renderState = promptController.getRenderState();
      if (renderState?.type === 'message') {
        setState((current) => {
          if (current.type !== 'printing' && current.type !== 'waiting') {
            return current;
          }

          if (renderState.isFullyVisible) {
            if (current.type === 'waiting') {
              return current;
            }
            return { type: 'waiting', messageIndex: current.messageIndex };
          }

          if (current.type === 'printing' && current.charIndex === renderState.visibleChars) {
            return current;
          }
          return {
            type: 'printing',
            messageIndex: current.messageIndex,
            charIndex: renderState.visibleChars,
          };
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [state.type, config.textSpeed]);

  // Scroll animation effect — drives scrollProgress from 0 to 1 using rAF
  useEffect(() => {
    if (state.type !== 'scrolling') return;

    const duration = config.scrollDurationMs;
    let startTime: number | null = null;
    let rafId: number;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        dispatch({ type: 'UPDATE_SCROLL', progress });
        rafId = requestAnimationFrame(tick);
      } else {
        dispatch({ type: 'FINISH_SCROLL' });
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [state.type, config.scrollDurationMs, dispatch]);

  // Auto-advance effect
  useEffect(() => {
    if (state.type !== 'waiting') return;

    const currentMessage = messagesRef.current[state.messageIndex];
    if (!currentMessage?.autoAdvance) return;

    // Check if next message needs scroll transition
    const nextMsg = messagesRef.current[state.messageIndex + 1];
    const useScroll = nextMsg?.transition === 'scroll';

    const delay = currentMessage.autoAdvanceMs ?? 2000;
    const timer = setTimeout(() => {
      promptControllerRef.current.clear();
      activePromptKeyRef.current = null;
      dispatch({ type: useScroll ? 'START_SCROLL' : 'NEXT_MESSAGE' });
    }, delay);

    return () => clearTimeout(timer);
  }, [state, dispatch]);

  // Show options after last message completes
  useEffect(() => {
    if (state.type !== 'waiting') return;
    if (!optionsRef.current) return;

    const isLastMessage = state.messageIndex === messagesRef.current.length - 1;
    if (isLastMessage) {
      dispatch({ type: 'SHOW_OPTIONS', options: optionsRef.current });
    }
  }, [state, dispatch]);

  // Enter editing mode when a text input prompt reaches waiting state.
  useEffect(() => {
    if (state.type !== 'waiting') return;
    if (!textInputRef.current) return;

    const isLastMessage = state.messageIndex === messagesRef.current.length - 1;
    if (!isLastMessage) return;

    const initialValue = textInputRef.current.initialValue ?? '';
    dispatch({ type: 'START_EDITING', initialValue });
  }, [state, dispatch]);

  // Shared modal input handling (overworld prompt + choices + text entry).
  useEffect(() => {
    if (state.type === 'closed') {
      return;
    }

    const resolveAndClear = (value: unknown) => {
      const resolve = resolveRef.current;
      if (!resolve) {
        return;
      }
      resolve(value);
      resolveRef.current = null;
    };

    const advanceAfterResolvedPrompt = (
      promptState: Extract<DialogState, { type: 'printing' | 'waiting' }>,
    ) => {
      const messages = messagesRef.current;
      const options = optionsRef.current;
      const textInput = textInputRef.current;
      const nextMsg = messages[promptState.messageIndex + 1];
      const progressionAction = getProgressionActionForResolvedPrompt({
        stateType: promptState.type,
        messageIndex: promptState.messageIndex,
        messageCount: messages.length,
        hasOptions: options !== null,
        hasTextInput: textInput !== null,
        nextMessageTransition: nextMsg?.transition,
      });

      switch (progressionAction) {
        case DIALOG_PROGRESSION_ACTION.NEXT_MESSAGE:
          dispatch({ type: 'NEXT_MESSAGE' });
          return;
        case DIALOG_PROGRESSION_ACTION.START_SCROLL:
          dispatch({ type: 'START_SCROLL' });
          return;
        case DIALOG_PROGRESSION_ACTION.SHOW_OPTIONS:
          if (options) {
            dispatch({ type: 'SHOW_OPTIONS', options });
          }
          return;
        case DIALOG_PROGRESSION_ACTION.START_EDITING:
          dispatch({ type: 'START_EDITING', initialValue: textInput?.initialValue ?? '' });
          return;
        case DIALOG_PROGRESSION_ACTION.CLOSE_AND_RESOLVE_VOID:
          dispatch({ type: 'CLOSE' });
          resolveAndClear(undefined);
          return;
        case DIALOG_PROGRESSION_ACTION.NOOP:
        default:
          return;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentState = stateRef.current;
      if (!currentState || currentState.type === 'closed') {
        return;
      }

      const options = optionsRef.current;
      const textInput = textInputRef.current;
      const mappedAction = getModalInputAction(e.code);

      if (currentState.type === 'editing') {
        if (mappedAction === 'confirm' || e.code === 'NumpadEnter') {
          consumeModalInputEvent(e);

          const normalize = textInput?.normalize;
          const normalizedValue = normalize ? normalize(currentState.value) : currentState.value;
          const allowEmpty = textInput?.allowEmpty ?? false;
          if (!allowEmpty && normalizedValue.trim().length === 0) {
            return;
          }

          dispatch({ type: 'CLOSE' });
          resolveAndClear(normalizedValue);
          return;
        }

        if (mappedAction === 'cancel' && (textInput?.cancelable ?? true)) {
          consumeModalInputEvent(e);
          dispatch({ type: 'CANCEL' });
          resolveAndClear(null);
          return;
        }

        if (e.code === 'Backspace') {
          consumeModalInputEvent(e);
          dispatch({ type: 'UPDATE_INPUT', value: currentState.value.slice(0, -1) });
          return;
        }

        const maxLength = textInput?.maxLength ?? 12;
        if (currentState.value.length >= maxLength) {
          return;
        }

        let append: string | null = null;
        if (textInput?.mapKey) {
          append = textInput.mapKey(e);
        } else {
          const letterMatch = e.code.match(/^Key([A-Z])$/);
          const digitMatch = e.code.match(/^Digit([0-9])$/);
          if (letterMatch) append = letterMatch[1];
          else if (digitMatch) append = digitMatch[1];
          else if (e.code === 'Space') append = ' ';
        }

        if (append && append.length > 0) {
          consumeModalInputEvent(e);
          dispatch({ type: 'UPDATE_INPUT', value: (currentState.value + append).slice(0, maxLength) });
        }
        return;
      }

      const isConfirm = mappedAction === 'confirm' || inputMap.matchesCode(e.code, ...config.advanceKeys);
      const isCancel = mappedAction === 'cancel' || inputMap.matchesCode(e.code, ...config.cancelKeys);

      if (isConfirm || isCancel) {
        consumeModalInputEvent(e);

        if (currentState.type === 'scrolling') {
          dispatch({ type: 'FINISH_SCROLL' });
          return;
        }

        if (currentState.type === 'printing' || currentState.type === 'waiting') {
          if (currentState.type === 'printing' && !config.allowSkip) {
            return;
          }

          const promptController = promptControllerRef.current;
          const wasActive = promptController.isActive();
          promptController.handleInput({
            confirmPressed: isConfirm,
            cancelPressed: isCancel,
            upPressed: false,
            downPressed: false,
          });

          if (wasActive && !promptController.isActive()) {
            advanceAfterResolvedPrompt(currentState);
          }
          return;
        }

        if (currentState.type === 'choosing' && options) {
          if (isConfirm) {
            const selectedChoice = options.choices[currentState.selectedIndex];
            if (selectedChoice && !selectedChoice.disabled) {
              dispatch({ type: 'CONFIRM_OPTION' });
              resolveAndClear(selectedChoice.value);
            }
            return;
          }

          if (isCancel && options.cancelable) {
            dispatch({ type: 'CANCEL' });
            resolveAndClear(options.cancelValue ?? null);
          }
        }
        return;
      }

      if (currentState.type === 'choosing' && options) {
        if (mappedAction === 'up') {
          consumeModalInputEvent(e);
          const newIndex = Math.max(0, currentState.selectedIndex - 1);
          dispatch({ type: 'SELECT_OPTION', index: newIndex });
          options.onSelectionChange?.(newIndex);
        }
        if (mappedAction === 'down') {
          consumeModalInputEvent(e);
          const newIndex = Math.min(options.choices.length - 1, currentState.selectedIndex + 1);
          dispatch({ type: 'SELECT_OPTION', index: newIndex });
          options.onSelectionChange?.(newIndex);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [state.type, config.advanceKeys, config.cancelKeys, config.allowSkip, dispatch]);

  // Resolve setter/getter
  const setResolve = useCallback((fn: ((value: unknown) => void) | null) => {
    resolveRef.current = fn;
  }, []);

  const getResolve = useCallback(() => resolveRef.current, []);

  const contextValue: DialogContextValue = {
    state,
    messages: messagesRef.current,
    options: optionsRef.current,
    textInput: textInputRef.current,
    config,
    zoom,
    viewport,
    dispatch,
    setResolve,
    getResolve,
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  );
};

// === Hooks ===

/**
 * Access dialog context directly (for internal components)
 */
export function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogContext must be used within a DialogProvider');
  }
  return context;
}

/**
 * Main hook for showing dialogs
 */
export function useDialog(): UseDialogReturn {
  const context = useContext(DialogContext);

  const showMessages = useCallback(
    (messages: DialogMessage[], options?: DialogOptions, textInput?: DialogTextInput): Promise<unknown> => {
      if (!context) {
        console.warn('useDialog: No DialogProvider found');
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        context.setResolve(resolve);
        context.dispatch({ type: 'OPEN', messages, options, textInput });
      });
    },
    [context]
  );

  const showMessage = useCallback(
    (text: string, messageOptions?: Partial<DialogMessage>): Promise<void> => {
      const z = context?.zoom ?? 1;
      const ff = context?.config.fontFamily ?? DEFAULT_CONFIG.fontFamily;
      const pages = paginateDialogText(text, z, ff);
      const messages = pages.map(page => ({
        ...messageOptions,
        text: page.text,
        transition: page.transition,
        prefilledChars: page.prefilledChars,
      }));
      return showMessages(messages) as Promise<void>;
    },
    [showMessages, context?.zoom, context?.config.fontFamily]
  );

  const showYesNo = useCallback(
    (text: string, options?: { defaultYes?: boolean }): Promise<boolean> => {
      const z = context?.zoom ?? 1;
      const ff = context?.config.fontFamily ?? DEFAULT_CONFIG.fontFamily;
      const pages = paginateDialogText(text, z, ff);
      const messages = pages.map(page => ({
        text: page.text,
        transition: page.transition,
        prefilledChars: page.prefilledChars,
      }));
      const dialogOptions: DialogOptions<boolean> = {
        choices: [
          { label: 'YES', value: true },
          { label: 'NO', value: false },
        ],
        defaultIndex: options?.defaultYes ? 0 : 1,
        cancelable: true,
        cancelValue: false,
      };
      return showMessages(messages, dialogOptions) as Promise<boolean>;
    },
    [showMessages, context?.zoom, context?.config.fontFamily]
  );

  const showChoice = useCallback(
    <T,>(
      text: string,
      choices: Array<{ label: string; value: T; disabled?: boolean }>,
      options?: { cancelable?: boolean; defaultIndex?: number; menuPosition?: DialogOptions<T>['menuPosition']; onSelectionChange?: (index: number) => void }
    ): Promise<T | null> => {
      const z = context?.zoom ?? 1;
      const ff = context?.config.fontFamily ?? DEFAULT_CONFIG.fontFamily;
      const pages = paginateDialogText(text, z, ff);
      const messages = pages.map(page => ({
        text: page.text,
        transition: page.transition,
        prefilledChars: page.prefilledChars,
      }));
      const dialogOptions: DialogOptions<T> = {
        choices,
        defaultIndex: options?.defaultIndex ?? 0,
        cancelable: options?.cancelable ?? true,
        cancelValue: null,
        menuPosition: options?.menuPosition,
        onSelectionChange: options?.onSelectionChange,
      };
      return showMessages(messages, dialogOptions) as Promise<T | null>;
    },
    [showMessages, context?.zoom, context?.config.fontFamily]
  );

  const showTextEntry = useCallback(
    (text: string, input?: DialogTextInput): Promise<string | null> => {
      const textInput: DialogTextInput = {
        initialValue: input?.initialValue ?? '',
        maxLength: input?.maxLength ?? 12,
        allowEmpty: input?.allowEmpty ?? false,
        cancelable: input?.cancelable ?? true,
        mapKey: input?.mapKey,
        normalize: input?.normalize,
      };
      return showMessages([{ text }], undefined, textInput) as Promise<string | null>;
    },
    [showMessages]
  );

  const close = useCallback(() => {
    if (!context) return;
    context.dispatch({ type: 'CLOSE' });
    const resolve = context.getResolve();
    if (resolve) {
      resolve(undefined);
      context.setResolve(null);
    }
  }, [context]);

  const isOpen = context ? context.state.type !== 'closed' : false;

  return {
    showMessage,
    showMessages,
    showYesNo,
    showChoice,
    showTextEntry,
    close,
    isOpen,
  };
}

export default DialogContext;

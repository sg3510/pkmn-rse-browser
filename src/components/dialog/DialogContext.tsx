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
  useReducer,
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
import { inputMap, GameButton } from '../../core/InputMap';
import { paginateDialogText } from './textPagination';

// === Reducer ===

function dialogReducer(
  state: DialogState,
  action: DialogAction,
  messages: DialogMessage[]
): DialogState {
  switch (action.type) {
    case 'OPEN':
      return { type: 'printing', messageIndex: 0, charIndex: 0 };

    case 'ADVANCE_CHAR':
      if (state.type === 'printing') {
        const currentMessage = messages[state.messageIndex];
        if (currentMessage && state.charIndex < currentMessage.text.length) {
          return { ...state, charIndex: state.charIndex + 1 };
        }
      }
      return state;

    case 'COMPLETE_TEXT':
      if (state.type === 'printing') {
        return { type: 'waiting', messageIndex: state.messageIndex };
      }
      return state;

    case 'START_SCROLL':
      if (state.type === 'waiting') {
        return { type: 'scrolling', messageIndex: state.messageIndex, scrollProgress: 0 };
      }
      return state;

    case 'UPDATE_SCROLL':
      if (state.type === 'scrolling') {
        return { ...state, scrollProgress: action.progress };
      }
      return state;

    case 'FINISH_SCROLL':
      if (state.type === 'scrolling') {
        const nextMsg = messages[state.messageIndex + 1];
        const prefilled = nextMsg?.prefilledChars ?? 0;
        return { type: 'printing', messageIndex: state.messageIndex + 1, charIndex: prefilled };
      }
      return state;

    case 'SHOW_OPTIONS':
      if (state.type === 'waiting') {
        return {
          type: 'choosing',
          messageIndex: state.messageIndex,
          selectedIndex: action.options.defaultIndex ?? 0,
        };
      }
      return state;

    case 'START_EDITING':
      if (state.type === 'waiting') {
        return {
          type: 'editing',
          messageIndex: state.messageIndex,
          value: action.initialValue,
        };
      }
      return state;

    case 'UPDATE_INPUT':
      if (state.type === 'editing') {
        return { ...state, value: action.value };
      }
      return state;

    case 'SELECT_OPTION':
      if (state.type === 'choosing') {
        return { ...state, selectedIndex: action.index };
      }
      return state;

    case 'NEXT_MESSAGE':
      if (state.type === 'waiting') {
        const nextIndex = state.messageIndex + 1;
        if (nextIndex < messages.length) {
          return { type: 'printing', messageIndex: nextIndex, charIndex: 0 };
        }
        return { type: 'closed' };
      }
      return state;

    case 'CONFIRM_OPTION':
    case 'CANCEL':
    case 'CLOSE':
      return { type: 'closed' };

    default:
      return state;
  }
}

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

  // Reducer with access to messages ref
  const [state, baseDispatch] = useReducer(
    (currentState: DialogState, action: DialogAction) => {
      // Handle actions that modify refs
      if (action.type === 'OPEN') {
        messagesRef.current = action.messages;
        optionsRef.current = action.options ?? null;
        textInputRef.current = action.textInput ?? null;
      }
      if (action.type === 'SHOW_OPTIONS') {
        optionsRef.current = action.options;
      }
      if (action.type === 'CLOSE' || action.type === 'CONFIRM_OPTION' || action.type === 'CANCEL') {
        messagesRef.current = [];
        optionsRef.current = null;
        textInputRef.current = null;
      }
      return dialogReducer(currentState, action, messagesRef.current);
    },
    { type: 'closed' } as DialogState
  );

  // Wrap dispatch to trigger re-renders properly
  const dispatch = useCallback((action: DialogAction) => {
    baseDispatch(action);
  }, []);

  // Text animation effect
  useEffect(() => {
    if (state.type !== 'printing') return;

    const currentMessage = messagesRef.current[state.messageIndex];
    if (!currentMessage) return;

    // Check if text is complete
    if (state.charIndex >= currentMessage.text.length) {
      dispatch({ type: 'COMPLETE_TEXT' });
      return;
    }

    // Calculate delay
    const delay = TEXT_SPEED_DELAYS[config.textSpeed];
    if (delay === 0) {
      // Instant: complete immediately
      dispatch({ type: 'COMPLETE_TEXT' });
      return;
    }

    const timer = setTimeout(() => {
      dispatch({ type: 'ADVANCE_CHAR' });
    }, delay);

    return () => clearTimeout(timer);
  }, [state, config.textSpeed, dispatch]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only start/stop on state.type change, not every progress update
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
  const resolveRef = useRef<((value: unknown) => void) | null>(null);

  const showMessages = useCallback(
    (messages: DialogMessage[], options?: DialogOptions, textInput?: DialogTextInput): Promise<unknown> => {
      if (!context) {
        console.warn('useDialog: No DialogProvider found');
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        resolveRef.current = resolve;
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

  // Handle keyboard input
  // Track state and options to properly update handler when they change
  const stateRef = useRef(context?.state);
  const optionsRef = useRef(context?.options);
  const messagesRef = useRef(context?.messages);
  const textInputRef = useRef(context?.textInput);

  // Update refs when context changes
  useEffect(() => {
    if (context) {
      stateRef.current = context.state;
      optionsRef.current = context.options;
      messagesRef.current = context.messages;
      textInputRef.current = context.textInput;
    }
  }, [context?.state, context?.options, context?.messages, context?.textInput, context]);

  useEffect(() => {
    if (!context || context.state.type === 'closed') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      const options = optionsRef.current;
      const messages = messagesRef.current;
      const textInput = textInputRef.current;
      if (!state || !context) return;

      const { config, dispatch, getResolve, setResolve } = context;

      if (state.type === 'editing') {
        // Submit: A button or NumpadEnter (special case for text entry)
        if (inputMap.matchesCode(e.code, GameButton.A) || e.code === 'NumpadEnter') {
          e.preventDefault();
          e.stopPropagation();

          const normalize = textInput?.normalize;
          const normalizedValue = normalize ? normalize(state.value) : state.value;
          const allowEmpty = textInput?.allowEmpty ?? false;
          if (!allowEmpty && normalizedValue.trim().length === 0) {
            return;
          }

          dispatch({ type: 'CLOSE' });
          const resolve = getResolve();
          if (resolve) {
            resolve(normalizedValue);
            setResolve(null);
          }
          return;
        }

        // Cancel: B button
        if (inputMap.matchesCode(e.code, GameButton.B) && (textInput?.cancelable ?? true)) {
          e.preventDefault();
          e.stopPropagation();
          dispatch({ type: 'CANCEL' });
          const resolve = getResolve();
          if (resolve) {
            resolve(null);
            setResolve(null);
          }
          return;
        }

        if (e.code === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          dispatch({ type: 'UPDATE_INPUT', value: state.value.slice(0, -1) });
          return;
        }

        const maxLength = textInput?.maxLength ?? 12;
        if (state.value.length >= maxLength) {
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
          e.preventDefault();
          e.stopPropagation();
          dispatch({ type: 'UPDATE_INPUT', value: (state.value + append).slice(0, maxLength) });
        }
        return;
      }

      // Advance keys (A button)
      if (inputMap.matchesCode(e.code, ...config.advanceKeys)) {
        e.preventDefault();
        e.stopPropagation();

        if (state.type === 'printing') {
          if (config.allowSkip) {
            dispatch({ type: 'COMPLETE_TEXT' });
          }
        } else if (state.type === 'scrolling') {
          // Skip scroll animation
          dispatch({ type: 'FINISH_SCROLL' });
        } else if (state.type === 'waiting') {
          const isLastMessage = state.messageIndex === (messages?.length ?? 1) - 1;
          if (!isLastMessage) {
            // Check if next message wants scroll transition
            const nextMsg = messages?.[state.messageIndex + 1];
            if (nextMsg?.transition === 'scroll') {
              dispatch({ type: 'START_SCROLL' });
            } else {
              dispatch({ type: 'NEXT_MESSAGE' });
            }
          } else if (!options) {
            dispatch({ type: 'CLOSE' });
            const resolve = getResolve();
            if (resolve) {
              resolve(undefined);
              setResolve(null);
            }
          }
        } else if (state.type === 'choosing' && options) {
          const selectedChoice = options.choices[state.selectedIndex];
          if (selectedChoice && !selectedChoice.disabled) {
            dispatch({ type: 'CONFIRM_OPTION' });
            const resolve = getResolve();
            if (resolve) {
              resolve(selectedChoice.value);
              setResolve(null);
            }
          }
        }
        return;
      }

      // Cancel keys (B button)
      // GBA behavior: B advances text like A, but cancels choices instead of confirming
      if (inputMap.matchesCode(e.code, ...config.cancelKeys)) {
        e.preventDefault();
        e.stopPropagation();

        if (state.type === 'printing') {
          if (config.allowSkip) {
            dispatch({ type: 'COMPLETE_TEXT' });
          }
        } else if (state.type === 'scrolling') {
          dispatch({ type: 'FINISH_SCROLL' });
        } else if (state.type === 'waiting') {
          const isLastMessage = state.messageIndex === (messages?.length ?? 1) - 1;
          if (!isLastMessage) {
            const nextMsg = messages?.[state.messageIndex + 1];
            if (nextMsg?.transition === 'scroll') {
              dispatch({ type: 'START_SCROLL' });
            } else {
              dispatch({ type: 'NEXT_MESSAGE' });
            }
          } else if (!options) {
            // B closes dialog at end (same as A), but does NOT open choices
            dispatch({ type: 'CLOSE' });
            const resolve = getResolve();
            if (resolve) {
              resolve(undefined);
              setResolve(null);
            }
          }
        } else if (state.type === 'choosing' && options?.cancelable) {
          dispatch({ type: 'CANCEL' });
          const resolve = getResolve();
          if (resolve) {
            resolve(options.cancelValue ?? null);
            setResolve(null);
          }
        }
        return;
      }

      // D-pad for menu navigation
      if (state.type === 'choosing' && options) {
        if (inputMap.matchesCode(e.code, GameButton.UP)) {
          e.preventDefault();
          e.stopPropagation();
          const newIndex = Math.max(0, state.selectedIndex - 1);
          dispatch({ type: 'SELECT_OPTION', index: newIndex });
          options.onSelectionChange?.(newIndex);
        }
        if (inputMap.matchesCode(e.code, GameButton.DOWN)) {
          e.preventDefault();
          e.stopPropagation();
          const newIndex = Math.min(options.choices.length - 1, state.selectedIndex + 1);
          dispatch({ type: 'SELECT_OPTION', index: newIndex });
          options.onSelectionChange?.(newIndex);
        }
        return;
      }

    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [context, context?.state.type]);

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

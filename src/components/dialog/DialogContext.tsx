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
  DialogContextValue,
  UseDialogReturn,
} from './types';
import { DEFAULT_CONFIG, TEXT_SPEED_DELAYS } from './types';

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
        return { type: 'printing', messageIndex: state.messageIndex + 1, charIndex: 0 };
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
}

export const DialogProvider: React.FC<DialogProviderProps> = ({
  children,
  config: configOverrides,
  zoom = 1,
}) => {
  const config: DialogConfig = { ...DEFAULT_CONFIG, ...configOverrides };

  // Store messages and options in refs to avoid unnecessary re-renders
  const messagesRef = useRef<DialogMessage[]>([]);
  const optionsRef = useRef<DialogOptions | null>(null);
  const resolveRef = useRef<((value: unknown) => void) | null>(null);

  // Reducer with access to messages ref
  const [state, baseDispatch] = useReducer(
    (currentState: DialogState, action: DialogAction) => {
      // Handle actions that modify refs
      if (action.type === 'OPEN') {
        messagesRef.current = action.messages;
        optionsRef.current = action.options ?? null;
      }
      if (action.type === 'SHOW_OPTIONS') {
        optionsRef.current = action.options;
      }
      if (action.type === 'CLOSE' || action.type === 'CONFIRM_OPTION' || action.type === 'CANCEL') {
        messagesRef.current = [];
        optionsRef.current = null;
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

  // Auto-advance effect
  useEffect(() => {
    if (state.type !== 'waiting') return;

    const currentMessage = messagesRef.current[state.messageIndex];
    if (!currentMessage?.autoAdvance) return;

    const delay = currentMessage.autoAdvanceMs ?? 2000;
    const timer = setTimeout(() => {
      dispatch({ type: 'NEXT_MESSAGE' });
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

  // Resolve setter/getter
  const setResolve = useCallback((fn: ((value: unknown) => void) | null) => {
    resolveRef.current = fn;
  }, []);

  const getResolve = useCallback(() => resolveRef.current, []);

  const contextValue: DialogContextValue = {
    state,
    messages: messagesRef.current,
    options: optionsRef.current,
    config,
    zoom,
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
    (messages: DialogMessage[], options?: DialogOptions): Promise<unknown> => {
      if (!context) {
        console.warn('useDialog: No DialogProvider found');
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        resolveRef.current = resolve;
        context.setResolve(resolve);
        context.dispatch({ type: 'OPEN', messages, options });
      });
    },
    [context]
  );

  const showMessage = useCallback(
    (text: string, messageOptions?: Partial<DialogMessage>): Promise<void> => {
      return showMessages([{ text, ...messageOptions }]) as Promise<void>;
    },
    [showMessages]
  );

  const showYesNo = useCallback(
    (text: string, options?: { defaultYes?: boolean }): Promise<boolean> => {
      const dialogOptions: DialogOptions<boolean> = {
        choices: [
          { label: 'YES', value: true },
          { label: 'NO', value: false },
        ],
        defaultIndex: options?.defaultYes ? 0 : 1,
        cancelable: true,
        cancelValue: false,
      };
      return showMessages([{ text }], dialogOptions) as Promise<boolean>;
    },
    [showMessages]
  );

  const showChoice = useCallback(
    <T,>(
      text: string,
      choices: Array<{ label: string; value: T; disabled?: boolean }>,
      options?: { cancelable?: boolean; defaultIndex?: number }
    ): Promise<T | null> => {
      const dialogOptions: DialogOptions<T> = {
        choices,
        defaultIndex: options?.defaultIndex ?? 0,
        cancelable: options?.cancelable ?? true,
        cancelValue: null,
      };
      return showMessages([{ text }], dialogOptions) as Promise<T | null>;
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

  // Update refs when context changes
  useEffect(() => {
    if (context) {
      stateRef.current = context.state;
      optionsRef.current = context.options;
      messagesRef.current = context.messages;
    }
  }, [context?.state, context?.options, context?.messages, context]);

  useEffect(() => {
    if (!context || context.state.type === 'closed') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      const options = optionsRef.current;
      const messages = messagesRef.current;
      if (!state || !context) return;

      const { config, dispatch, getResolve, setResolve } = context;

      // Advance keys (Space, Enter, X)
      if (config.advanceKeys.includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();

        if (state.type === 'printing') {
          if (config.allowSkip) {
            dispatch({ type: 'COMPLETE_TEXT' });
          }
        } else if (state.type === 'waiting') {
          const isLastMessage = state.messageIndex === (messages?.length ?? 1) - 1;
          if (!isLastMessage) {
            dispatch({ type: 'NEXT_MESSAGE' });
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
      }

      // Cancel keys (Escape, Z)
      if (config.cancelKeys.includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();

        if (state.type === 'choosing' && options?.cancelable) {
          dispatch({ type: 'CANCEL' });
          const resolve = getResolve();
          if (resolve) {
            resolve(options.cancelValue ?? null);
            setResolve(null);
          }
        }
      }

      // Arrow keys for menu navigation
      if (state.type === 'choosing' && options) {
        if (e.code === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          const newIndex = Math.max(0, state.selectedIndex - 1);
          dispatch({ type: 'SELECT_OPTION', index: newIndex });
        }
        if (e.code === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          const newIndex = Math.min(options.choices.length - 1, state.selectedIndex + 1);
          dispatch({ type: 'SELECT_OPTION', index: newIndex });
        }
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
    close,
    isOpen,
  };
}

export default DialogContext;

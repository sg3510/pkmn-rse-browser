import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import type {
  DialogConfig,
  DialogState,
  DialogAction,
  DialogMessage,
  DialogOptions,
  DialogContextValue,
} from './types';
import { DEFAULT_DIALOG_CONFIG, TEXT_SPEED_DELAYS } from './types';

// Initial state
const initialState: DialogState = { type: 'closed' };

// Reducer for dialog state management
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
        if (state.charIndex < currentMessage.text.length) {
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

    case 'MOVE_CURSOR':
      if (state.type === 'choosing') {
        return state; // Will be handled with options context
      }
      return state;

    case 'SELECT_OPTION':
      if (state.type === 'choosing') {
        return { ...state, selectedIndex: action.index };
      }
      return state;

    case 'CONFIRM_OPTION':
    case 'CANCEL':
    case 'CLOSE':
      return { type: 'closed' };

    case 'NEXT_MESSAGE':
      if (state.type === 'waiting') {
        const nextIndex = state.messageIndex + 1;
        if (nextIndex < messages.length) {
          return { type: 'printing', messageIndex: nextIndex, charIndex: 0 };
        }
        return { type: 'closed' };
      }
      return state;

    default:
      return state;
  }
}

// Context
const DialogContext = createContext<DialogContextValue | null>(null);

// Provider props
interface DialogProviderProps {
  children: React.ReactNode;
  config?: Partial<DialogConfig>;
  zoom?: number;
}

// Provider component
export const DialogProvider: React.FC<DialogProviderProps> = ({
  children,
  config: configOverrides,
  zoom = 1,
}) => {
  const config: DialogConfig = { ...DEFAULT_DIALOG_CONFIG, ...configOverrides };

  // Messages and options stored in refs to avoid re-renders
  const messagesRef = useRef<DialogMessage[]>([]);
  const optionsRef = useRef<DialogOptions | null>(null);
  const resolveRef = useRef<((value: unknown) => void) | null>(null);

  // Custom reducer that has access to messages
  const [state, dispatch] = useReducer(
    (state: DialogState, action: DialogAction) => {
      // Handle special actions that modify refs
      if (action.type === 'OPEN') {
        messagesRef.current = action.messages;
        optionsRef.current = action.options ?? null;
      }
      if (action.type === 'SHOW_OPTIONS') {
        optionsRef.current = action.options;
      }
      if (action.type === 'CLOSE' || action.type === 'CONFIRM_OPTION' || action.type === 'CANCEL') {
        // Clear on close
        messagesRef.current = [];
        optionsRef.current = null;
      }
      return dialogReducer(state, action, messagesRef.current);
    },
    initialState
  );

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
    const delay = config.textSpeed === 'instant' ? 0 : TEXT_SPEED_DELAYS[config.textSpeed];
    if (delay === 0) {
      // Instant: complete immediately
      dispatch({ type: 'COMPLETE_TEXT' });
      return;
    }

    const timer = setTimeout(() => {
      dispatch({ type: 'ADVANCE_CHAR' });
    }, delay);

    return () => clearTimeout(timer);
  }, [state, config.textSpeed]);

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
  }, [state]);

  // Check if we should show options after text completes
  useEffect(() => {
    if (state.type !== 'waiting') return;
    if (!optionsRef.current) return;

    // Show options if this is the last message
    const isLastMessage = state.messageIndex === messagesRef.current.length - 1;
    if (isLastMessage) {
      dispatch({ type: 'SHOW_OPTIONS', options: optionsRef.current });
    }
  }, [state]);

  // Callback to set the resolve function from useDialog hook
  const setResolve = useCallback((fn: ((value: unknown) => void) | null) => {
    resolveRef.current = fn;
  }, []);

  // Getter to always return current resolve function (not stale captured value)
  const getResolve = useCallback(() => resolveRef.current, []);

  const contextValue: DialogContextValue = {
    state,
    messages: messagesRef.current,
    options: optionsRef.current,
    config,
    zoom,
    _dispatch: dispatch,
    _resolve: resolveRef.current, // Keep for backwards compat but may be stale
    _setResolve: setResolve,
    _getResolve: getResolve, // Use this to get current value
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  );
};

// Hook to access dialog context
export function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogContext must be used within a DialogProvider');
  }
  return context;
}

// Main hook for showing dialogs
export function useDialog() {
  const context = useContext(DialogContext);

  // Store resolve function in a ref accessible to the context
  const resolveRef = useRef<((value: unknown) => void) | null>(null);

  const showMessages = useCallback(
    (messages: DialogMessage[], options?: DialogOptions): Promise<unknown> => {
      if (!context) {
        console.warn('useDialog: No DialogProvider found');
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        console.log('[DIALOG] showMessages: registering resolve function');
        resolveRef.current = resolve;
        // Register resolve with context so mouse handlers can use it
        context._setResolve(resolve);
        context._dispatch({ type: 'OPEN', messages, options });
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
      const dialogOptions: DialogOptions = {
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
    <T extends string | number>(
      text: string,
      choices: Array<{ label: string; value: T; disabled?: boolean }>,
      options?: { cancelable?: boolean; defaultIndex?: number }
    ): Promise<T | null> => {
      const dialogOptions: DialogOptions = {
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
    context._dispatch({ type: 'CLOSE' });
    if (resolveRef.current) {
      resolveRef.current(undefined);
      resolveRef.current = null;
    }
  }, [context]);

  const isOpen = context ? context.state.type !== 'closed' : false;

  // Handle keyboard input
  useEffect(() => {
    if (!context || context.state.type === 'closed') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { state, config, options } = context;

      // Advance keys (Space, Enter, Z)
      if (config.advanceKeys.includes(e.code)) {
        e.preventDefault();

        if (state.type === 'printing') {
          // Skip to end of text
          if (config.allowSkip) {
            context._dispatch({ type: 'COMPLETE_TEXT' });
          }
        } else if (state.type === 'waiting') {
          // Check if there are more messages
          const isLastMessage = state.messageIndex === context.messages.length - 1;
          if (!isLastMessage) {
            context._dispatch({ type: 'NEXT_MESSAGE' });
          } else if (!options) {
            // No options, just close
            context._dispatch({ type: 'CLOSE' });
            if (resolveRef.current) {
              resolveRef.current(undefined);
              resolveRef.current = null;
            }
          }
        } else if (state.type === 'choosing' && options) {
          // Confirm selection
          const selectedChoice = options.choices[state.selectedIndex];
          if (selectedChoice && !selectedChoice.disabled) {
            context._dispatch({ type: 'CONFIRM_OPTION' });
            if (resolveRef.current) {
              resolveRef.current(selectedChoice.value);
              resolveRef.current = null;
            }
          }
        }
      }

      // Cancel keys (Escape, X)
      if (config.cancelKeys.includes(e.code)) {
        e.preventDefault();

        if (state.type === 'choosing' && options?.cancelable) {
          context._dispatch({ type: 'CANCEL' });
          if (resolveRef.current) {
            resolveRef.current(options.cancelValue ?? null);
            resolveRef.current = null;
          }
        }
      }

      // Arrow keys for menu navigation
      if (state.type === 'choosing' && options) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          const newIndex = Math.max(0, state.selectedIndex - 1);
          context._dispatch({ type: 'SELECT_OPTION', index: newIndex });
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          const newIndex = Math.min(options.choices.length - 1, state.selectedIndex + 1);
          context._dispatch({ type: 'SELECT_OPTION', index: newIndex });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [context]);

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

import type { InputController } from '../../core/InputController.ts';

/** Dialogs consume native keyboard events in capture phase; touch uses the shared controller. */
export function subscribeDialogInput(
  controller: Pick<InputController, 'subscribe'>,
  keyboardTarget: EventTarget,
  handleInput: (code: string, nativeEvent?: KeyboardEvent) => void,
): () => void {
  const keyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    handleInput(keyboardEvent.code, keyboardEvent);
  };
  keyboardTarget.addEventListener('keydown', keyDown, { capture: true });
  const unsubscribe = controller.subscribe((event) => {
    // Keyboard is already handled above, including text entry and modal propagation.
    // Only press edges advance dialogs; releasing or holding a touch must not advance twice.
    if (event.type === 'keydown' && event.source !== 'keyboard') handleInput(event.code);
  });
  return () => {
    keyboardTarget.removeEventListener('keydown', keyDown, { capture: true });
    unsubscribe();
  };
}

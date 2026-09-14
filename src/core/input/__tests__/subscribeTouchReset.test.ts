import assert from 'node:assert/strict';
import test from 'node:test';
import { subscribeTouchReset } from '../subscribeTouchReset.ts';

test('touch reset handles rotation, backgrounding, blur and subscription cleanup', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const orientation = new EventTarget();
  const windowTarget = Object.assign(new EventTarget(), { matchMedia: () => orientation });
  const documentTarget = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowTarget });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentTarget });
  try {
    let resets = 0;
    const cleanup = subscribeTouchReset(() => resets++);
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(resets, 0);
    documentTarget.visibilityState = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    windowTarget.dispatchEvent(new Event('blur'));
    windowTarget.dispatchEvent(new Event('orientationchange'));
    orientation.dispatchEvent(new Event('change'));
    assert.equal(resets, 4);
    cleanup?.();
    assert.equal(resets, 5);
    windowTarget.dispatchEvent(new Event('blur'));
    orientation.dispatchEvent(new Event('change'));
    assert.equal(resets, 5);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

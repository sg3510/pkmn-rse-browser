import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { GameButton } from '../../core/InputMap';

interface MobileControlDeckProps {
  enabled: boolean;
  onPress: (button: GameButton, pointerId: number) => void;
  onReleasePointer: (pointerId: number) => void;
}

type ControlButton = typeof CONTROL_BUTTONS[number];
type DpadButton = typeof DPAD_BUTTONS[number];

const CONTROL_BUTTONS = [
  GameButton.UP,
  GameButton.DOWN,
  GameButton.LEFT,
  GameButton.RIGHT,
  GameButton.A,
  GameButton.B,
  GameButton.START,
  GameButton.SELECT,
] as const;

const DPAD_BUTTONS = [
  GameButton.UP,
  GameButton.DOWN,
  GameButton.LEFT,
  GameButton.RIGHT,
] as const;

const BUTTON_LABELS: Record<ControlButton, string> = {
  [GameButton.UP]: 'Up',
  [GameButton.DOWN]: 'Down',
  [GameButton.LEFT]: 'Left',
  [GameButton.RIGHT]: 'Right',
  [GameButton.A]: 'A',
  [GameButton.B]: 'B',
  [GameButton.START]: 'Start',
  [GameButton.SELECT]: 'Select',
};

const INITIAL_ACTIVE_COUNTS: Record<ControlButton, number> = {
  [GameButton.UP]: 0,
  [GameButton.DOWN]: 0,
  [GameButton.LEFT]: 0,
  [GameButton.RIGHT]: 0,
  [GameButton.A]: 0,
  [GameButton.B]: 0,
  [GameButton.START]: 0,
  [GameButton.SELECT]: 0,
};

const DPAD_DEADZONE_RATIO = 0.18;
const DPAD_AXIS_LOCK_RATIO = 1.15;

function getButtonClass(baseClass: string, isActive: boolean, enabled: boolean): string {
  return [
    baseClass,
    isActive ? 'is-active' : '',
    !enabled ? 'is-disabled' : '',
  ].filter(Boolean).join(' ');
}

function resolveDpadDirection(
  event: PointerEvent<HTMLDivElement>,
  currentButton: DpadButton | null
): DpadButton | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const maxAxis = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const deadzone = maxAxis * DPAD_DEADZONE_RATIO;

  if (Math.hypot(dx, dy) <= deadzone) {
    return currentButton;
  }

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX > absY * DPAD_AXIS_LOCK_RATIO) {
    return dx < 0 ? GameButton.LEFT : GameButton.RIGHT;
  }
  if (absY > absX * DPAD_AXIS_LOCK_RATIO) {
    return dy < 0 ? GameButton.UP : GameButton.DOWN;
  }

  if (absX >= absY) {
    return dx < 0 ? GameButton.LEFT : GameButton.RIGHT;
  }
  return dy < 0 ? GameButton.UP : GameButton.DOWN;
}

export function MobileControlDeck({ enabled, onPress, onReleasePointer }: MobileControlDeckProps) {
  const [activeCounts, setActiveCounts] = useState<Record<ControlButton, number>>(INITIAL_ACTIVE_COUNTS);
  const pointerToButtonRef = useRef<Map<number, ControlButton>>(new Map());

  const adjustButtonCount = useCallback((button: ControlButton, delta: number) => {
    setActiveCounts((prev) => {
      const nextCount = Math.max(0, prev[button] + delta);
      if (nextCount === prev[button]) return prev;
      return { ...prev, [button]: nextCount };
    });
  }, []);

  const releaseTrackedPointer = useCallback((pointerId: number, notifyBridge: boolean) => {
    const button = pointerToButtonRef.current.get(pointerId);
    if (!button) return;

    pointerToButtonRef.current.delete(pointerId);
    adjustButtonCount(button, -1);
    if (notifyBridge) {
      onReleasePointer(pointerId);
    }
  }, [adjustButtonCount, onReleasePointer]);

  const pressTrackedPointer = useCallback((button: ControlButton, pointerId: number) => {
    const existingButton = pointerToButtonRef.current.get(pointerId);
    if (existingButton === button) return;
    if (existingButton) {
      releaseTrackedPointer(pointerId, true);
    }

    pointerToButtonRef.current.set(pointerId, button);
    adjustButtonCount(button, 1);
    onPress(button, pointerId);
  }, [adjustButtonCount, onPress, releaseTrackedPointer]);

  const handleButtonPointerDown = useCallback((button: Exclude<ControlButton, DpadButton>, event: PointerEvent<HTMLButtonElement>) => {
    if (!enabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pressTrackedPointer(button, event.pointerId);
  }, [enabled, pressTrackedPointer]);

  const handleButtonPointerRelease = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releaseTrackedPointer(event.pointerId, true);
  }, [releaseTrackedPointer]);

  const handleDpadPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextButton = resolveDpadDirection(event, null);
    if (nextButton) {
      pressTrackedPointer(nextButton, event.pointerId);
    }
  }, [enabled, pressTrackedPointer]);

  const handleDpadPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const currentButton = pointerToButtonRef.current.get(event.pointerId) as DpadButton | undefined;
    const nextButton = resolveDpadDirection(event, currentButton ?? null);
    if (nextButton) {
      pressTrackedPointer(nextButton, event.pointerId);
      return;
    }
    if (currentButton) {
      releaseTrackedPointer(event.pointerId, true);
    }
  }, [enabled, pressTrackedPointer, releaseTrackedPointer]);

  const handleDpadPointerRelease = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releaseTrackedPointer(event.pointerId, true);
  }, [releaseTrackedPointer]);

  useEffect(() => {
    if (enabled) return;
    const pointerIds = Array.from(pointerToButtonRef.current.keys());
    for (const pointerId of pointerIds) {
      releaseTrackedPointer(pointerId, true);
    }
  }, [enabled, releaseTrackedPointer]);

  useEffect(() => {
    return () => {
      const pointerIds = Array.from(pointerToButtonRef.current.keys());
      for (const pointerId of pointerIds) {
        onReleasePointer(pointerId);
      }
      pointerToButtonRef.current.clear();
    };
  }, [onReleasePointer]);

  return (
    <div className="mobile-control-deck" aria-hidden={!enabled}>
      <div
        className={getButtonClass('mobile-control-deck__dpad', DPAD_BUTTONS.some((button) => activeCounts[button] > 0), enabled)}
        onPointerDown={handleDpadPointerDown}
        onPointerMove={handleDpadPointerMove}
        onPointerUp={handleDpadPointerRelease}
        onPointerCancel={handleDpadPointerRelease}
        onLostPointerCapture={handleDpadPointerRelease}
      >
        <div className={getButtonClass('mobile-control-dpad__segment mobile-control-dpad__segment--up', activeCounts[GameButton.UP] > 0, enabled)} aria-hidden="true">
          ▲
        </div>
        <div className={getButtonClass('mobile-control-dpad__segment mobile-control-dpad__segment--left', activeCounts[GameButton.LEFT] > 0, enabled)} aria-hidden="true">
          ◀
        </div>
        <div className="mobile-control-dpad__core" aria-hidden="true" />
        <div className={getButtonClass('mobile-control-dpad__segment mobile-control-dpad__segment--right', activeCounts[GameButton.RIGHT] > 0, enabled)} aria-hidden="true">
          ▶
        </div>
        <div className={getButtonClass('mobile-control-dpad__segment mobile-control-dpad__segment--down', activeCounts[GameButton.DOWN] > 0, enabled)} aria-hidden="true">
          ▼
        </div>
      </div>

      <div className="mobile-control-deck__actions">
        <div className="mobile-control-deck__face-buttons">
          <button
            type="button"
            className={getButtonClass('mobile-control-btn mobile-control-btn--face mobile-control-btn--b', activeCounts[GameButton.B] > 0, enabled)}
            onPointerDown={(event) => handleButtonPointerDown(GameButton.B, event)}
            onPointerUp={handleButtonPointerRelease}
            onPointerCancel={handleButtonPointerRelease}
            onLostPointerCapture={handleButtonPointerRelease}
            aria-label={BUTTON_LABELS[GameButton.B]}
            disabled={!enabled}
          >
            B
          </button>
          <button
            type="button"
            className={getButtonClass('mobile-control-btn mobile-control-btn--face mobile-control-btn--a', activeCounts[GameButton.A] > 0, enabled)}
            onPointerDown={(event) => handleButtonPointerDown(GameButton.A, event)}
            onPointerUp={handleButtonPointerRelease}
            onPointerCancel={handleButtonPointerRelease}
            onLostPointerCapture={handleButtonPointerRelease}
            aria-label={BUTTON_LABELS[GameButton.A]}
            disabled={!enabled}
          >
            A
          </button>
        </div>

        <div className="mobile-control-deck__meta-buttons">
          <button
            type="button"
            className={getButtonClass('mobile-control-btn mobile-control-btn--meta', activeCounts[GameButton.SELECT] > 0, enabled)}
            onPointerDown={(event) => handleButtonPointerDown(GameButton.SELECT, event)}
            onPointerUp={handleButtonPointerRelease}
            onPointerCancel={handleButtonPointerRelease}
            onLostPointerCapture={handleButtonPointerRelease}
            aria-label={BUTTON_LABELS[GameButton.SELECT]}
            disabled={!enabled}
          >
            Select
          </button>
          <button
            type="button"
            className={getButtonClass('mobile-control-btn mobile-control-btn--meta', activeCounts[GameButton.START] > 0, enabled)}
            onPointerDown={(event) => handleButtonPointerDown(GameButton.START, event)}
            onPointerUp={handleButtonPointerRelease}
            onPointerCancel={handleButtonPointerRelease}
            onLostPointerCapture={handleButtonPointerRelease}
            aria-label={BUTTON_LABELS[GameButton.START]}
            disabled={!enabled}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

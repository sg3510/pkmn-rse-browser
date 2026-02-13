import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { GameButton } from '../../core/InputMap';

interface MobileControlDeckProps {
  enabled: boolean;
  onPress: (button: GameButton, pointerId: number) => void;
  onReleasePointer: (pointerId: number) => void;
}

type ControlButton = typeof CONTROL_BUTTONS[number];

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

function getButtonClass(baseClass: string, isActive: boolean, enabled: boolean): string {
  return [
    baseClass,
    isActive ? 'is-active' : '',
    !enabled ? 'is-disabled' : '',
  ].filter(Boolean).join(' ');
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

  const handlePointerDown = useCallback((button: ControlButton, event: PointerEvent<HTMLButtonElement>) => {
    if (!enabled) return;
    event.preventDefault();
    pressTrackedPointer(button, event.pointerId);
  }, [enabled, pressTrackedPointer]);

  const handlePointerRelease = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
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
      <div className="mobile-control-deck__dpad">
        <button
          type="button"
          className={getButtonClass('mobile-control-btn mobile-control-btn--dpad mobile-control-btn--up', activeCounts[GameButton.UP] > 0, enabled)}
          onPointerDown={(event) => handlePointerDown(GameButton.UP, event)}
          onPointerUp={handlePointerRelease}
          onPointerCancel={handlePointerRelease}
          onPointerLeave={handlePointerRelease}
          aria-label={BUTTON_LABELS[GameButton.UP]}
          disabled={!enabled}
        >
          ▲
        </button>
        <button
          type="button"
          className={getButtonClass('mobile-control-btn mobile-control-btn--dpad mobile-control-btn--left', activeCounts[GameButton.LEFT] > 0, enabled)}
          onPointerDown={(event) => handlePointerDown(GameButton.LEFT, event)}
          onPointerUp={handlePointerRelease}
          onPointerCancel={handlePointerRelease}
          onPointerLeave={handlePointerRelease}
          aria-label={BUTTON_LABELS[GameButton.LEFT]}
          disabled={!enabled}
        >
          ◀
        </button>
        <button
          type="button"
          className={getButtonClass('mobile-control-btn mobile-control-btn--dpad mobile-control-btn--right', activeCounts[GameButton.RIGHT] > 0, enabled)}
          onPointerDown={(event) => handlePointerDown(GameButton.RIGHT, event)}
          onPointerUp={handlePointerRelease}
          onPointerCancel={handlePointerRelease}
          onPointerLeave={handlePointerRelease}
          aria-label={BUTTON_LABELS[GameButton.RIGHT]}
          disabled={!enabled}
        >
          ▶
        </button>
        <button
          type="button"
          className={getButtonClass('mobile-control-btn mobile-control-btn--dpad mobile-control-btn--down', activeCounts[GameButton.DOWN] > 0, enabled)}
          onPointerDown={(event) => handlePointerDown(GameButton.DOWN, event)}
          onPointerUp={handlePointerRelease}
          onPointerCancel={handlePointerRelease}
          onPointerLeave={handlePointerRelease}
          aria-label={BUTTON_LABELS[GameButton.DOWN]}
          disabled={!enabled}
        >
          ▼
        </button>
      </div>

      <div className="mobile-control-deck__actions">
        <div className="mobile-control-deck__face-buttons">
          <button
            type="button"
            className={getButtonClass('mobile-control-btn mobile-control-btn--face mobile-control-btn--b', activeCounts[GameButton.B] > 0, enabled)}
            onPointerDown={(event) => handlePointerDown(GameButton.B, event)}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            onPointerLeave={handlePointerRelease}
            aria-label={BUTTON_LABELS[GameButton.B]}
            disabled={!enabled}
          >
            B
          </button>
          <button
            type="button"
            className={getButtonClass('mobile-control-btn mobile-control-btn--face mobile-control-btn--a', activeCounts[GameButton.A] > 0, enabled)}
            onPointerDown={(event) => handlePointerDown(GameButton.A, event)}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            onPointerLeave={handlePointerRelease}
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
            onPointerDown={(event) => handlePointerDown(GameButton.SELECT, event)}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            onPointerLeave={handlePointerRelease}
            aria-label={BUTTON_LABELS[GameButton.SELECT]}
            disabled={!enabled}
          >
            Select
          </button>
          <button
            type="button"
            className={getButtonClass('mobile-control-btn mobile-control-btn--meta', activeCounts[GameButton.START] > 0, enabled)}
            onPointerDown={(event) => handlePointerDown(GameButton.START, event)}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            onPointerLeave={handlePointerRelease}
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

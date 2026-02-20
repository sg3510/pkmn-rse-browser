import { GameButton, inputMap } from '../InputMap';

export type ModalInputAction =
  | 'confirm'
  | 'cancel'
  | 'select'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | null;

export function getModalInputAction(code: string): ModalInputAction {
  if (inputMap.matchesCode(code, GameButton.A)) {
    return 'confirm';
  }
  if (inputMap.matchesCode(code, GameButton.B)) {
    return 'cancel';
  }
  if (inputMap.matchesCode(code, GameButton.SELECT)) {
    return 'select';
  }
  if (inputMap.matchesCode(code, GameButton.UP)) {
    return 'up';
  }
  if (inputMap.matchesCode(code, GameButton.DOWN)) {
    return 'down';
  }
  if (inputMap.matchesCode(code, GameButton.LEFT)) {
    return 'left';
  }
  if (inputMap.matchesCode(code, GameButton.RIGHT)) {
    return 'right';
  }
  return null;
}

export function consumeModalInputEvent(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

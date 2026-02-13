/**
 * Faraway Island Mew movement/visibility logic.
 *
 * C references:
 * - public/pokeemerald/src/faraway_island.c
 * - public/pokeemerald/src/event_object_movement.c
 */

export type FarawayDirection = 'up' | 'down' | 'left' | 'right';

export interface FarawayMewMoveParams {
  stepCounter: number;
  playerPrevX: number;
  playerPrevY: number;
  playerCurrX: number;
  playerCurrY: number;
  mewX: number;
  mewY: number;
  canMoveTo: (x: number, y: number) => boolean;
}

const FARAWAY_ISLAND_ROCK_COORDS: ReadonlyArray<readonly [number, number]> = [
  [14, 9],
  [18, 9],
  [9, 10],
  [13, 13],
];

export function shouldFarawayMewBeVisible(stepCounter: number): boolean {
  return stepCounter % 8 === 0;
}

export function shouldFarawayMewPauseStep(stepCounter: number): boolean {
  return stepCounter % 9 === 0;
}

export function shouldFarawayMewShakeGrass(stepCounter: number): boolean {
  return stepCounter !== 0xffff && stepCounter % 4 === 0;
}

type CandidateList = Array<FarawayDirection>;

function randomCandidate(stepCounter: number, candidates: CandidateList): FarawayDirection | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  return candidates[stepCounter % candidates.length] ?? candidates[0] ?? null;
}

function getValidDirection(
  params: Pick<FarawayMewMoveParams, 'stepCounter' | 'mewX' | 'mewY' | 'canMoveTo'>,
  ignored: FarawayDirection | null
): FarawayDirection | null {
  const candidates: CandidateList = [];

  if (ignored !== 'up' && params.canMoveTo(params.mewX, params.mewY - 1)) {
    candidates.push('up');
  }
  if (ignored !== 'right' && params.canMoveTo(params.mewX + 1, params.mewY)) {
    candidates.push('right');
  }
  if (ignored !== 'down' && params.canMoveTo(params.mewX, params.mewY + 1)) {
    candidates.push('down');
  }
  if (ignored !== 'left' && params.canMoveTo(params.mewX - 1, params.mewY)) {
    candidates.push('left');
  }

  return randomCandidate(params.stepCounter, candidates);
}

function maybeNorth(
  deltaY: number,
  mewX: number,
  mewY: number,
  canMoveTo: (x: number, y: number) => boolean,
  candidates: CandidateList
): boolean {
  if (deltaY > 0 && canMoveTo(mewX, mewY - 1)) {
    candidates.push('up');
    return true;
  }
  return false;
}

function maybeSouth(
  deltaY: number,
  mewX: number,
  mewY: number,
  canMoveTo: (x: number, y: number) => boolean,
  candidates: CandidateList
): boolean {
  if (deltaY < 0 && canMoveTo(mewX, mewY + 1)) {
    candidates.push('down');
    return true;
  }
  return false;
}

function maybeEast(
  deltaX: number,
  mewX: number,
  mewY: number,
  canMoveTo: (x: number, y: number) => boolean,
  candidates: CandidateList
): boolean {
  if (deltaX < 0 && canMoveTo(mewX + 1, mewY)) {
    candidates.push('right');
    return true;
  }
  return false;
}

function maybeWest(
  deltaX: number,
  mewX: number,
  mewY: number,
  canMoveTo: (x: number, y: number) => boolean,
  candidates: CandidateList
): boolean {
  if (deltaX > 0 && canMoveTo(mewX - 1, mewY)) {
    candidates.push('left');
    return true;
  }
  return false;
}

/**
 * 1:1 behavior of GetMewMoveDirection from faraway_island.c.
 */
export function getFarawayMewMoveDirection(params: FarawayMewMoveParams): FarawayDirection | null {
  const {
    playerPrevX,
    playerPrevY,
    playerCurrX,
    playerCurrY,
    mewX,
    mewY,
    canMoveTo,
    stepCounter,
  } = params;

  const deltaX = playerPrevX - mewX;
  const deltaY = playerPrevY - mewY;

  // Player only turned, no move.
  if (playerPrevX === playerCurrX && playerPrevY === playerCurrY) {
    return null;
  }

  if (shouldFarawayMewPauseStep(stepCounter)) {
    return null;
  }

  // Trap-avoidance near rocks.
  for (const [rockX, rockY] of FARAWAY_ISLAND_ROCK_COORDS) {
    if (playerPrevX === rockX) {
      let mewSafeFromTrap = false;
      if (playerPrevY < rockY) {
        if (mewY <= rockY) mewSafeFromTrap = true;
      } else if (mewY >= rockY) {
        mewSafeFromTrap = true;
      }

      if (!mewSafeFromTrap) {
        if (deltaX > 0 && mewX + 1 === playerPrevX && canMoveTo(mewX + 1, mewY)) {
          return 'right';
        }
        if (deltaX < 0 && mewX - 1 === playerPrevX && canMoveTo(mewX - 1, mewY)) {
          return 'left';
        }

        if (mewX === playerPrevX) {
          if (deltaY > 0 && canMoveTo(mewX, mewY - 1)) return 'up';
          if (deltaY <= 0 && canMoveTo(mewX, mewY + 1)) return 'down';
        }
      }
    }

    if (playerPrevY === rockY) {
      let mewSafeFromTrap = false;
      if (playerPrevX < rockX) {
        if (mewX <= rockX) mewSafeFromTrap = true;
      } else if (mewX >= rockX) {
        mewSafeFromTrap = true;
      }

      if (!mewSafeFromTrap) {
        if (deltaY > 0 && mewY + 1 === playerPrevY && canMoveTo(mewX, mewY + 1)) {
          return 'down';
        }
        if (deltaY < 0 && mewY - 1 === playerPrevY && canMoveTo(mewX, mewY - 1)) {
          return 'up';
        }

        if (mewY === playerPrevY) {
          if (deltaX > 0 && canMoveTo(mewX - 1, mewY)) return 'left';
          if (deltaX <= 0 && canMoveTo(mewX + 1, mewY)) return 'right';
        }
      }
    }
  }

  // Try moving away from player axis.
  {
    const candidates: CandidateList = [];
    if (maybeNorth(deltaY, mewX, mewY, canMoveTo, candidates)) {
      if (maybeEast(deltaX, mewX, mewY, canMoveTo, candidates)) return randomCandidate(stepCounter, candidates);
      if (maybeWest(deltaX, mewX, mewY, canMoveTo, candidates)) return randomCandidate(stepCounter, candidates);
      return 'up';
    }
  }
  {
    const candidates: CandidateList = [];
    if (maybeSouth(deltaY, mewX, mewY, canMoveTo, candidates)) {
      if (maybeEast(deltaX, mewX, mewY, canMoveTo, candidates)) return randomCandidate(stepCounter, candidates);
      if (maybeWest(deltaX, mewX, mewY, canMoveTo, candidates)) return randomCandidate(stepCounter, candidates);
      return 'down';
    }
  }
  {
    const candidates: CandidateList = [];
    if (maybeEast(deltaX, mewX, mewY, canMoveTo, candidates)) {
      if (maybeNorth(deltaY, mewX, mewY, canMoveTo, candidates)) return randomCandidate(stepCounter, candidates);
      if (maybeSouth(deltaY, mewX, mewY, canMoveTo, candidates)) return randomCandidate(stepCounter, candidates);
      return 'right';
    }
  }
  {
    const candidates: CandidateList = [];
    if (maybeWest(deltaX, mewX, mewY, canMoveTo, candidates)) {
      if (maybeNorth(deltaY, mewX, mewY, canMoveTo, candidates)) return randomCandidate(stepCounter, candidates);
      if (maybeSouth(deltaY, mewX, mewY, canMoveTo, candidates)) return randomCandidate(stepCounter, candidates);
      return 'left';
    }
  }

  // No move avoids getting closer. Try axis-escape fallback.
  if (deltaY === 0) {
    if (playerCurrY > mewY && canMoveTo(mewX, mewY - 1)) return 'up';
    if (playerCurrY < mewY && canMoveTo(mewX, mewY + 1)) return 'down';
    if (canMoveTo(mewX, mewY - 1)) return 'up';
    if (canMoveTo(mewX, mewY + 1)) return 'down';
  }

  if (deltaX === 0) {
    if (playerCurrX > mewX && canMoveTo(mewX - 1, mewY)) return 'left';
    if (playerCurrX < mewX && canMoveTo(mewX + 1, mewY)) return 'right';
    if (canMoveTo(mewX + 1, mewY)) return 'right';
    if (canMoveTo(mewX - 1, mewY)) return 'left';
  }

  return getValidDirection({ stepCounter, mewX, mewY, canMoveTo }, null);
}


/**
 * Shared battle scene/layout constants.
 *
 * Centralizes 240x160 battle coordinates so sprite/UI alignment changes are
 * done in one place.
 */

export const BATTLE_LAYOUT = {
  scene: {
    width: 240,
    height: 160,
    textboxX: 0,
    textboxY: 112,
    textboxWidth: 240,
    textboxHeight: 48,
  },
  enemy: {
    spriteX: 144,
    spriteY: 12,
    healthboxX: 16,
    healthboxY: 8,
    partyBallsX: 18,
    partyBallsY: 40,
  },
  player: {
    spriteX: 40,
    spriteY: 56,
    healthboxX: 128,
    healthboxY: 76,
    partyBallsX: 174,
    partyBallsY: 68,
  },
  trainerThrow: {
    startX: 80,
    endX: -40,
    y: 80,
    ballStartX: 24,
    ballStartY: 68,
  },
  trainerIntro: {
    enemyStartX: 272,
    enemyHoldX: 176,
    enemyEndX: 280,
    enemyY: 40,
  },
} as const;

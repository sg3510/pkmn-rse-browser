/**
 * Legendary-island special handlers shared by ScriptRunner.
 *
 * C references:
 * - public/pokeemerald/src/field_specials.c (DoDeoxysRockInteraction, SetDeoxysRockPalette)
 * - public/pokeemerald/src/faraway_island.c (SetMewAboveGrass, DestroyMewEmergingGrassSprite)
 */

export interface ScriptCameraShakeRequest {
  verticalPan: number;
  horizontalPan: number;
  numShakes: number;
  delayFrames: number;
}

export interface ScriptCameraSpecialServices {
  spawnObject?: () => void | Promise<void>;
  removeObject?: () => void | Promise<void>;
  applyMovement?: (steps: readonly string[]) => Promise<void>;
  shake?: (request: ScriptCameraShakeRequest) => void | Promise<void>;
}

export interface ScriptLegendarySpecialServices {
  setDeoxysRockPalette?: (level: number) => void | Promise<void>;
  setDeoxysRockLevel?: (request: {
    level: number;
    x: number;
    y: number;
    // C parity: maps to Task_MoveDeoxysRock tMoveSteps (interpolation frame count).
    stepDelayFrames: number;
    failedReset: boolean;
  }) => void | Promise<void>;
  setMewAboveGrass?: (mode: number, facingDirection: number) => void | Promise<void>;
  destroyMewEmergingGrassSprite?: () => void | Promise<void>;
}

export interface LegendaryIslandSpecialContext {
  getVar: (varName: string) => number;
  setVar: (varName: string, value: number) => void;
  isFlagSet: (flagName: string) => boolean;
  setFlag: (flagName: string) => void;
  getFacingDirection: () => number;
  camera?: ScriptCameraSpecialServices;
  legendary?: ScriptLegendarySpecialServices;
}

export interface SpecialExecutionResult {
  handled: boolean;
  result?: number;
}

export const DEOXYS_ROCK_RESULT = {
  FAILED: 0,
  PROGRESSED: 1,
  SOLVED: 2,
  COMPLETE: 3,
} as const;

const DEOXYS_ROCK_LEVELS = 11;
const DEOXYS_MAX_STEP_COUNTS: readonly number[] = [4, 8, 8, 8, 4, 4, 4, 6, 3, 3];
const DEOXYS_ROCK_COORDS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 15, y: 12 },
  { x: 11, y: 14 },
  { x: 15, y: 8 },
  { x: 19, y: 14 },
  { x: 12, y: 11 },
  { x: 18, y: 11 },
  { x: 15, y: 14 },
  { x: 11, y: 14 },
  { x: 19, y: 14 },
  { x: 15, y: 15 },
  { x: 15, y: 10 },
];

async function applyDeoxysRockLevel(
  level: number,
  failedReset: boolean,
  ctx: LegendaryIslandSpecialContext
): Promise<void> {
  await ctx.legendary?.setDeoxysRockPalette?.(level);
  const coords = DEOXYS_ROCK_COORDS[level] ?? DEOXYS_ROCK_COORDS[0];
  // C parity from ChangeDeoxysRockLevel:
  // - failure reset uses 60 interpolation frames
  // - successful movement uses 5 interpolation frames
  const stepDelayFrames = level === 0 ? 60 : 5;
  await ctx.legendary?.setDeoxysRockLevel?.({
    level,
    x: coords.x,
    y: coords.y,
    stepDelayFrames,
    failedReset,
  });
}

async function runDeoxysRockInteraction(
  ctx: LegendaryIslandSpecialContext
): Promise<number> {
  if (ctx.isFlagSet('FLAG_DEOXYS_ROCK_COMPLETE')) {
    console.log('[Legendary] DoDeoxysRockInteraction result=COMPLETE');
    return DEOXYS_ROCK_RESULT.COMPLETE;
  }

  const rockLevel = ctx.getVar('VAR_DEOXYS_ROCK_LEVEL');
  const stepCount = ctx.getVar('VAR_DEOXYS_ROCK_STEP_COUNT');
  ctx.setVar('VAR_DEOXYS_ROCK_STEP_COUNT', 0);

  if (rockLevel !== 0 && DEOXYS_MAX_STEP_COUNTS[rockLevel - 1] < stepCount) {
    ctx.setVar('VAR_DEOXYS_ROCK_LEVEL', 0);
    await applyDeoxysRockLevel(0, true, ctx);
    console.log(
      `[Legendary] DoDeoxysRockInteraction result=FAILED rockLevel=${rockLevel} stepCount=${stepCount}`
    );
    return DEOXYS_ROCK_RESULT.FAILED;
  }

  if (rockLevel === DEOXYS_ROCK_LEVELS - 1) {
    ctx.setFlag('FLAG_DEOXYS_ROCK_COMPLETE');
    console.log('[Legendary] DoDeoxysRockInteraction result=SOLVED');
    return DEOXYS_ROCK_RESULT.SOLVED;
  }

  const nextLevel = rockLevel + 1;
  ctx.setVar('VAR_DEOXYS_ROCK_LEVEL', nextLevel);
  await applyDeoxysRockLevel(nextLevel, false, ctx);
  console.log(
    `[Legendary] DoDeoxysRockInteraction result=PROGRESSED nextLevel=${nextLevel} stepCount=${stepCount}`
  );
  return DEOXYS_ROCK_RESULT.PROGRESSED;
}

export async function executeLegendaryIslandSpecial(
  name: string,
  ctx: LegendaryIslandSpecialContext
): Promise<SpecialExecutionResult> {
  switch (name) {
    case 'SpawnCameraObject':
      await ctx.camera?.spawnObject?.();
      return { handled: true };
    case 'RemoveCameraObject':
      await ctx.camera?.removeObject?.();
      return { handled: true };
    case 'LoopWingFlapSE':
      // Audio task in C; no-op in web runtime (but handled to avoid warnings).
      return { handled: true };
    case 'ShakeCamera': {
      const request: ScriptCameraShakeRequest = {
        verticalPan: ctx.getVar('VAR_0x8004'),
        horizontalPan: ctx.getVar('VAR_0x8005'),
        numShakes: ctx.getVar('VAR_0x8006'),
        delayFrames: ctx.getVar('VAR_0x8007'),
      };
      await ctx.camera?.shake?.(request);
      return { handled: true };
    }
    case 'DoDeoxysRockInteraction':
      {
        const result = await runDeoxysRockInteraction(ctx);
        // C parity: ScrCmd_special reads gSpecialVar_Result after this special.
        // Birth Island scripts use `special DoDeoxysRockInteraction` + `switch VAR_RESULT`.
        ctx.setVar('VAR_RESULT', result);
        return { handled: true, result };
      }
    case 'SetDeoxysRockPalette':
      await ctx.legendary?.setDeoxysRockPalette?.(ctx.getVar('VAR_DEOXYS_ROCK_LEVEL'));
      return { handled: true };
    case 'SetMewAboveGrass':
      await ctx.legendary?.setMewAboveGrass?.(ctx.getVar('VAR_0x8004'), ctx.getFacingDirection());
      return { handled: true };
    case 'DestroyMewEmergingGrassSprite':
      await ctx.legendary?.destroyMewEmergingGrassSprite?.();
      return { handled: true };
    default:
      return { handled: false };
  }
}

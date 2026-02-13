import assert from 'node:assert';
import test from 'node:test';
import {
  DEOXYS_ROCK_RESULT,
  executeLegendaryIslandSpecial,
  type LegendaryIslandSpecialContext,
  type ScriptCameraShakeRequest,
} from '../legendaryIslandSpecials.ts';

interface LegendaryTestHarness {
  ctx: LegendaryIslandSpecialContext;
  vars: Map<string, number>;
  flags: Set<string>;
  paletteCalls: number[];
  levelCalls: Array<{
    level: number;
    x: number;
    y: number;
    stepDelayFrames: number;
    failedReset: boolean;
  }>;
  shakeCalls: ScriptCameraShakeRequest[];
}

function createHarness(
  initialVars: Record<string, number>,
  initialFlags: readonly string[] = []
): LegendaryTestHarness {
  const vars = new Map<string, number>(Object.entries(initialVars));
  const flags = new Set<string>(initialFlags);
  const paletteCalls: number[] = [];
  const levelCalls: Array<{
    level: number;
    x: number;
    y: number;
    stepDelayFrames: number;
    failedReset: boolean;
  }> = [];
  const shakeCalls: ScriptCameraShakeRequest[] = [];

  const ctx: LegendaryIslandSpecialContext = {
    getVar: (varName) => vars.get(varName) ?? 0,
    setVar: (varName, value) => {
      vars.set(varName, value);
    },
    isFlagSet: (flagName) => flags.has(flagName),
    setFlag: (flagName) => {
      flags.add(flagName);
    },
    getFacingDirection: () => 1,
    camera: {
      shake: async (request) => {
        shakeCalls.push(request);
      },
    },
    legendary: {
      setDeoxysRockPalette: async (level) => {
        paletteCalls.push(level);
      },
      setDeoxysRockLevel: async (request) => {
        levelCalls.push(request);
      },
    },
  };

  return { ctx, vars, flags, paletteCalls, levelCalls, shakeCalls };
}

test('DoDeoxysRockInteraction returns COMPLETE when puzzle flag is set', async () => {
  const harness = createHarness(
    {
      VAR_DEOXYS_ROCK_LEVEL: 4,
      VAR_DEOXYS_ROCK_STEP_COUNT: 2,
    },
    ['FLAG_DEOXYS_ROCK_COMPLETE']
  );

  const result = await executeLegendaryIslandSpecial('DoDeoxysRockInteraction', harness.ctx);
  assert.deepStrictEqual(result, {
    handled: true,
    result: DEOXYS_ROCK_RESULT.COMPLETE,
  });
  assert.strictEqual(harness.vars.get('VAR_RESULT'), DEOXYS_ROCK_RESULT.COMPLETE);
  assert.strictEqual(harness.levelCalls.length, 0);
  assert.strictEqual(harness.paletteCalls.length, 0);
});

test('DoDeoxysRockInteraction resets to level 0 when step limit is exceeded', async () => {
  const harness = createHarness({
    VAR_DEOXYS_ROCK_LEVEL: 1,
    VAR_DEOXYS_ROCK_STEP_COUNT: 5, // max for level 1 is 4
  });

  const result = await executeLegendaryIslandSpecial('DoDeoxysRockInteraction', harness.ctx);
  assert.deepStrictEqual(result, {
    handled: true,
    result: DEOXYS_ROCK_RESULT.FAILED,
  });
  assert.strictEqual(harness.vars.get('VAR_RESULT'), DEOXYS_ROCK_RESULT.FAILED);
  assert.strictEqual(harness.vars.get('VAR_DEOXYS_ROCK_LEVEL'), 0);
  assert.strictEqual(harness.vars.get('VAR_DEOXYS_ROCK_STEP_COUNT'), 0);
  assert.deepStrictEqual(harness.levelCalls, [
    { level: 0, x: 15, y: 12, stepDelayFrames: 60, failedReset: true },
  ]);
  assert.deepStrictEqual(harness.paletteCalls, [0]);
});

test('DoDeoxysRockInteraction progresses to next level with expected coordinates', async () => {
  const harness = createHarness({
    VAR_DEOXYS_ROCK_LEVEL: 0,
    VAR_DEOXYS_ROCK_STEP_COUNT: 0,
  });

  const result = await executeLegendaryIslandSpecial('DoDeoxysRockInteraction', harness.ctx);
  assert.deepStrictEqual(result, {
    handled: true,
    result: DEOXYS_ROCK_RESULT.PROGRESSED,
  });
  assert.strictEqual(harness.vars.get('VAR_RESULT'), DEOXYS_ROCK_RESULT.PROGRESSED);
  assert.strictEqual(harness.vars.get('VAR_DEOXYS_ROCK_LEVEL'), 1);
  assert.strictEqual(harness.vars.get('VAR_DEOXYS_ROCK_STEP_COUNT'), 0);
  assert.deepStrictEqual(harness.levelCalls, [
    { level: 1, x: 11, y: 14, stepDelayFrames: 5, failedReset: false },
  ]);
  assert.deepStrictEqual(harness.paletteCalls, [1]);
});

test('DoDeoxysRockInteraction returns SOLVED at final level and sets completion flag', async () => {
  const harness = createHarness({
    VAR_DEOXYS_ROCK_LEVEL: 10,
    VAR_DEOXYS_ROCK_STEP_COUNT: 0,
  });

  const result = await executeLegendaryIslandSpecial('DoDeoxysRockInteraction', harness.ctx);
  assert.deepStrictEqual(result, {
    handled: true,
    result: DEOXYS_ROCK_RESULT.SOLVED,
  });
  assert.strictEqual(harness.vars.get('VAR_RESULT'), DEOXYS_ROCK_RESULT.SOLVED);
  assert.ok(harness.flags.has('FLAG_DEOXYS_ROCK_COMPLETE'));
  assert.strictEqual(harness.levelCalls.length, 0);
});

test('SetDeoxysRockPalette passes current rock level to runtime palette service', async () => {
  const harness = createHarness({
    VAR_DEOXYS_ROCK_LEVEL: 7,
  });

  const result = await executeLegendaryIslandSpecial('SetDeoxysRockPalette', harness.ctx);
  assert.deepStrictEqual(result, { handled: true });
  assert.deepStrictEqual(harness.paletteCalls, [7]);
});

test('ShakeCamera reads request parameters from VAR_0x8004..VAR_0x8007', async () => {
  const harness = createHarness({
    VAR_0x8004: 2,
    VAR_0x8005: 3,
    VAR_0x8006: 4,
    VAR_0x8007: 5,
  });

  const result = await executeLegendaryIslandSpecial('ShakeCamera', harness.ctx);
  assert.deepStrictEqual(result, { handled: true });
  assert.deepStrictEqual(harness.shakeCalls, [
    {
      verticalPan: 2,
      horizontalPan: 3,
      numShakes: 4,
      delayFrames: 5,
    },
  ]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldAutoRecoverStoryScriptFade } from '../storyScriptFadeRecovery.ts';

test('stale black fade recovery guard only triggers for complete out fade with no blockers', () => {
  assert.equal(
    shouldAutoRecoverStoryScriptFade({
      fadeDirection: 'out',
      fadeIsComplete: true,
      fadeIsActive: true,
      hasActiveWarp: false,
      hasPendingScriptedWarp: false,
      hasOpenMenu: false,
    }),
    true
  );

  assert.equal(
    shouldAutoRecoverStoryScriptFade({
      fadeDirection: 'in',
      fadeIsComplete: true,
      fadeIsActive: true,
      hasActiveWarp: false,
      hasPendingScriptedWarp: false,
      hasOpenMenu: false,
    }),
    false
  );

  assert.equal(
    shouldAutoRecoverStoryScriptFade({
      fadeDirection: 'out',
      fadeIsComplete: false,
      fadeIsActive: true,
      hasActiveWarp: false,
      hasPendingScriptedWarp: false,
      hasOpenMenu: false,
    }),
    false
  );

  assert.equal(
    shouldAutoRecoverStoryScriptFade({
      fadeDirection: 'out',
      fadeIsComplete: true,
      fadeIsActive: true,
      hasActiveWarp: true,
      hasPendingScriptedWarp: false,
      hasOpenMenu: false,
    }),
    false
  );

  assert.equal(
    shouldAutoRecoverStoryScriptFade({
      fadeDirection: 'out',
      fadeIsComplete: true,
      fadeIsActive: true,
      hasActiveWarp: false,
      hasPendingScriptedWarp: true,
      hasOpenMenu: false,
    }),
    false
  );

  assert.equal(
    shouldAutoRecoverStoryScriptFade({
      fadeDirection: 'out',
      fadeIsComplete: true,
      fadeIsActive: true,
      hasActiveWarp: false,
      hasPendingScriptedWarp: false,
      hasOpenMenu: true,
    }),
    false
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { PromptPrinterEngine } from '../PromptPrinterEngine.ts';

test('A speed-up reveals text and A advances waiting message', async () => {
  const engine = new PromptPrinterEngine();
  const done = engine.showMessage('HELLO');

  engine.tick(10, 100);
  assert.equal(engine.getRenderState()?.visibleChars, 0);

  engine.handleInput({ confirmPressed: true, cancelPressed: false });
  const waiting = engine.getRenderState();
  assert.equal(waiting?.isFullyVisible, true);

  engine.handleInput({ confirmPressed: true, cancelPressed: false });
  assert.equal(engine.isActive(), false);
  await done;
});

test('B speed-up reveals text and B advances waiting message', async () => {
  const engine = new PromptPrinterEngine();
  const done = engine.showMessage('WORLD');

  engine.tick(10, 100);
  assert.equal(engine.getRenderState()?.visibleChars, 0);

  engine.handleInput({ confirmPressed: false, cancelPressed: true });
  const waiting = engine.getRenderState();
  assert.equal(waiting?.isFullyVisible, true);

  engine.handleInput({ confirmPressed: false, cancelPressed: true });
  assert.equal(engine.isActive(), false);
  await done;
});

test('pagination produces scroll transitions between prompt pages', async () => {
  const engine = new PromptPrinterEngine({
    maxLines: 2,
    maxCharsPerLine: 5,
    scrollDurationMs: 100,
  });
  const done = engine.showMessage('alpha beta gamma delta');

  engine.tick(1, 0);
  let state = engine.getRenderState();
  assert.equal(state?.isFullyVisible, true);
  assert.equal(state?.pageCount !== undefined && state.pageCount > 1, true);

  engine.handleInput({ confirmPressed: true, cancelPressed: false });
  state = engine.getRenderState();
  assert.equal(state?.mode, 'scrolling');

  engine.tick(50, 20);
  state = engine.getRenderState();
  assert.equal(state?.mode, 'scrolling');
  assert.equal((state?.scrollProgress ?? 0) > 0, true);

  engine.tick(60, 20);
  state = engine.getRenderState();
  assert.equal((state?.pageIndex ?? 0) >= 1, true);

  let guard = 0;
  while (engine.isActive() && guard < 16) {
    engine.handleInput({ confirmPressed: true, cancelPressed: false });
    engine.tick(200, 0);
    guard++;
  }
  assert.equal(engine.isActive(), false);
  await done;
});

test('yes/no cursor toggles with up/down and confirm resolves choice', async () => {
  const engine = new PromptPrinterEngine();
  const answerPromise = engine.showYesNo('Proceed?', true);

  engine.handleInput({ confirmPressed: true, cancelPressed: false });
  let state = engine.getRenderState();
  assert.equal(state?.type, 'yesNo');
  assert.equal(state?.isFullyVisible, true);
  assert.equal(state?.cursor, 0);

  engine.handleInput({ confirmPressed: false, cancelPressed: false, downPressed: true });
  state = engine.getRenderState();
  assert.equal(state?.cursor, 1);

  engine.handleInput({ confirmPressed: true, cancelPressed: false });
  const answer = await answerPromise;
  assert.equal(answer, false);
});

test('yes/no cancel resolves false on final wait state', async () => {
  const engine = new PromptPrinterEngine();
  const answerPromise = engine.showYesNo('Stop?', true);

  engine.handleInput({ confirmPressed: true, cancelPressed: false });
  engine.handleInput({ confirmPressed: false, cancelPressed: true });

  const answer = await answerPromise;
  assert.equal(answer, false);
});

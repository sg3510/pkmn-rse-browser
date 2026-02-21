import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIALOG_PROGRESSION_ACTION,
  getDialogProgressionAction,
  getProgressionActionForResolvedPrompt,
} from '../dialogProgression.ts';

test('not-last message with clear transition returns NEXT_MESSAGE', () => {
  const action = getDialogProgressionAction({
    messageIndex: 0,
    messageCount: 2,
    hasOptions: false,
    hasTextInput: false,
    nextMessageTransition: 'clear',
  });

  assert.equal(action, DIALOG_PROGRESSION_ACTION.NEXT_MESSAGE);
});

test('not-last message with scroll transition returns START_SCROLL', () => {
  const action = getDialogProgressionAction({
    messageIndex: 0,
    messageCount: 2,
    hasOptions: false,
    hasTextInput: false,
    nextMessageTransition: 'scroll',
  });

  assert.equal(action, DIALOG_PROGRESSION_ACTION.START_SCROLL);
});

test('last message with options returns SHOW_OPTIONS', () => {
  const action = getDialogProgressionAction({
    messageIndex: 1,
    messageCount: 2,
    hasOptions: true,
    hasTextInput: false,
  });

  assert.equal(action, DIALOG_PROGRESSION_ACTION.SHOW_OPTIONS);
});

test('last message with text input returns START_EDITING', () => {
  const action = getDialogProgressionAction({
    messageIndex: 1,
    messageCount: 2,
    hasOptions: false,
    hasTextInput: true,
  });

  assert.equal(action, DIALOG_PROGRESSION_ACTION.START_EDITING);
});

test('last message without options or text input returns CLOSE_AND_RESOLVE_VOID', () => {
  const action = getDialogProgressionAction({
    messageIndex: 0,
    messageCount: 1,
    hasOptions: false,
    hasTextInput: false,
  });

  assert.equal(action, DIALOG_PROGRESSION_ACTION.CLOSE_AND_RESOLVE_VOID);
});

test('boundary prompt resolution in printing state advances immediately', () => {
  const action = getProgressionActionForResolvedPrompt({
    stateType: 'printing',
    messageIndex: 0,
    messageCount: 2,
    hasOptions: false,
    hasTextInput: false,
    nextMessageTransition: 'clear',
  });

  assert.equal(action, DIALOG_PROGRESSION_ACTION.NEXT_MESSAGE);
});

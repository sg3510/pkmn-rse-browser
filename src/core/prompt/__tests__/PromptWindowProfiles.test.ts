import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BATTLE_ACTION_PROMPT_PROFILE,
  BATTLE_MESSAGE_PROFILE,
  BATTLE_YESNO_PROFILE,
  EVOLUTION_MESSAGE_PROFILE,
  FIELD_MESSAGE_PROFILE,
  PROMPT_WINDOW_PROFILES,
} from '../PromptWindowProfiles.ts';

function assertProfileTextFitsWindow(profile: {
  id: string;
  window: { x: number; y: number; width: number; height: number };
  text: { x: number; y: number; width: number; lineHeight: number; maxLines: number };
}): void {
  const textBottom = profile.text.y + (profile.text.lineHeight * profile.text.maxLines);
  const textRight = profile.text.x + profile.text.width;
  const windowBottom = profile.window.y + profile.window.height;
  const windowRight = profile.window.x + profile.window.width;

  assert.equal(textBottom <= windowBottom, true, `${profile.id} text overflows window height`);
  assert.equal(textRight <= windowRight, true, `${profile.id} text overflows window width`);
}

test('concrete prompt window profiles are exported', () => {
  assert.equal(PROMPT_WINDOW_PROFILES.field_message.id, 'field_message');
  assert.equal(PROMPT_WINDOW_PROFILES.battle_message.id, 'battle_message');
  assert.equal(PROMPT_WINDOW_PROFILES.battle_action_prompt.id, 'battle_action_prompt');
  assert.equal(PROMPT_WINDOW_PROFILES.battle_yesno.id, 'battle_yesno');
  assert.equal(PROMPT_WINDOW_PROFILES.evolution_message.id, 'evolution_message');
});

test('profile text metrics clip within profile windows', () => {
  const profiles = [
    FIELD_MESSAGE_PROFILE,
    BATTLE_MESSAGE_PROFILE,
    BATTLE_ACTION_PROMPT_PROFILE,
    BATTLE_YESNO_PROFILE,
    EVOLUTION_MESSAGE_PROFILE,
  ];

  for (const profile of profiles) {
    assert.equal(profile.text.maxLines > 0, true, `${profile.id} maxLines must be > 0`);
    assert.equal(profile.text.width > 0, true, `${profile.id} text width must be > 0`);
    assertProfileTextFitsWindow(profile);
  }
});

test('battle/evolution yes-no geometry stays inside 240x160 scene bounds', () => {
  const sceneWidth = 240;
  const sceneHeight = 160;

  for (const profile of [BATTLE_MESSAGE_PROFILE, BATTLE_YESNO_PROFILE, EVOLUTION_MESSAGE_PROFILE]) {
    const yesNo = profile.yesNo;
    assert.ok(yesNo, `${profile.id} must define yes-no layout`);

    if (!yesNo) {
      continue;
    }

    assert.equal(yesNo.boxX >= 0, true);
    assert.equal(yesNo.boxY >= 0, true);
    assert.equal(yesNo.boxX + yesNo.boxWidth <= sceneWidth, true);
    assert.equal(yesNo.boxY + yesNo.boxHeight <= sceneHeight, true);
  }
});

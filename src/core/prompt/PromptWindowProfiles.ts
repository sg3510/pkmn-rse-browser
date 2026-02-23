/**
 * Context-specific prompt window profiles.
 *
 * C refs:
 * - public/pokeemerald/src/field_message_box.c
 * - public/pokeemerald/src/menu.c
 * - public/pokeemerald/src/battle_message.c
 * - public/pokeemerald/src/battle_bg.c
 */
import type { PromptWindowProfile } from './PromptWindowProfile.ts';

const EMERALD_FONT = '"Pokemon Emerald", monospace';
const EMERALD_DIALOG_FONT = '"Pokemon Emerald", "Pokemon RS", monospace';

const SHARED_BATTLE_YESNO = {
  boxX: 182,
  boxY: 104,
  boxWidth: 48,
  boxHeight: 34,
  yesLabelX: 6,
  yesLabelY: 7,
  noLabelX: 6,
  noLabelY: 18,
  textColor: '#383838',
  backgroundColor: '#f8f8f8',
  borderColor: '#303030',
  borderWidth: 1,
  cursorText: '▶',
  yesLabel: 'YES',
  noLabel: 'NO',
  fontSize: 10,
  fontFamily: EMERALD_FONT,
} as const;

export const FIELD_MESSAGE_PROFILE: PromptWindowProfile = {
  id: 'field_message',
  skinVariant: 'field',
  window: {
    x: 0,
    y: 0,
    width: 240,
    height: 44,
  },
  text: {
    x: 8,
    y: 6,
    width: 224,
    lineHeight: 12,
    maxLines: 2,
    fontSize: 16,
    fontFamily: EMERALD_DIALOG_FONT,
    color: '#303030',
    shadowColor: '#a8a8a8',
    shadowOffsetX: 1,
    shadowOffsetY: 1,
  },
  arrow: {
    x: 224,
    y: 20,
    size: 8,
    color: '#d85058',
    anchor: 'textEnd',
    textGapX: 2,
    lineOffsetY: 2,
    animate: true,
  },
  yesNo: {
    ...SHARED_BATTLE_YESNO,
  },
  scrollDurationMs: 150,
};

export const BATTLE_MESSAGE_PROFILE: PromptWindowProfile = {
  id: 'battle_message',
  skinVariant: 'message',
  window: {
    x: 0,
    y: 112,
    width: 240,
    height: 48,
  },
  text: {
    x: 18,
    y: 121,
    width: 198,
    lineHeight: 16,
    maxLines: 2,
    fontSize: 10,
    fontFamily: EMERALD_FONT,
    color: '#383838',
  },
  yesNo: {
    ...SHARED_BATTLE_YESNO,
  },
};

export const BATTLE_ACTION_PROMPT_PROFILE: PromptWindowProfile = {
  id: 'battle_action_prompt',
  skinVariant: 'action',
  window: {
    x: 0,
    y: 112,
    width: 240,
    height: 48,
  },
  text: {
    x: 10,
    y: 121,
    width: 102,
    lineHeight: 16,
    maxLines: 2,
    fontSize: 10,
    fontFamily: EMERALD_FONT,
    color: '#383838',
  },
};

export const BATTLE_YESNO_PROFILE: PromptWindowProfile = {
  id: 'battle_yesno',
  skinVariant: 'message',
  window: {
    x: 0,
    y: 112,
    width: 240,
    height: 48,
  },
  text: {
    x: 18,
    y: 121,
    width: 198,
    lineHeight: 16,
    maxLines: 2,
    fontSize: 10,
    fontFamily: EMERALD_FONT,
    color: '#383838',
  },
  yesNo: {
    ...SHARED_BATTLE_YESNO,
  },
};

export const EVOLUTION_MESSAGE_PROFILE: PromptWindowProfile = {
  id: 'evolution_message',
  skinVariant: 'message',
  window: {
    x: 0,
    y: 112,
    width: 240,
    height: 48,
  },
  text: {
    x: 18,
    y: 121,
    width: 198,
    lineHeight: 16,
    maxLines: 2,
    fontSize: 10,
    fontFamily: EMERALD_FONT,
    color: '#383838',
  },
  yesNo: {
    ...SHARED_BATTLE_YESNO,
  },
};

export const PROMPT_WINDOW_PROFILES = {
  field_message: FIELD_MESSAGE_PROFILE,
  battle_message: BATTLE_MESSAGE_PROFILE,
  battle_action_prompt: BATTLE_ACTION_PROMPT_PROFILE,
  battle_yesno: BATTLE_YESNO_PROFILE,
  evolution_message: EVOLUTION_MESSAGE_PROFILE,
} as const;

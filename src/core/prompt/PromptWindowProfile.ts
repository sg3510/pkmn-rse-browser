export type PromptWindowProfileId =
  | 'field_message'
  | 'battle_message'
  | 'battle_action_prompt'
  | 'battle_yesno'
  | 'evolution_message';

export type PromptWindowSkinVariant = 'field' | 'message' | 'action' | 'move';

export interface PromptWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PromptTextProfile {
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  maxLines: number;
  fontSize: number;
  fontFamily: string;
  fontWeight?: 'normal' | 'bold';
  color: string;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export interface PromptArrowProfile {
  x: number;
  y: number;
  size: number;
  color: string;
  anchor?: 'fixed' | 'textEnd';
  textGapX?: number;
  lineOffsetY?: number;
  animate?: boolean;
}

export interface PromptYesNoProfile {
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  yesLabelX: number;
  yesLabelY: number;
  noLabelX: number;
  noLabelY: number;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  cursorText: string;
  yesLabel: string;
  noLabel: string;
  fontSize: number;
  fontFamily: string;
}

export interface PromptWindowProfile {
  id: PromptWindowProfileId;
  skinVariant: PromptWindowSkinVariant;
  window: PromptWindowRect;
  text: PromptTextProfile;
  arrow?: PromptArrowProfile;
  yesNo?: PromptYesNoProfile;
  scrollDurationMs?: number;
}

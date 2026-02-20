export interface PromptLayout {
  yesNoBoxX: number;
  yesNoBoxY: number;
  yesNoBoxWidth: number;
  yesNoBoxHeight: number;
  yesLabelX: number;
  yesLabelY: number;
  noLabelX: number;
  noLabelY: number;
}

export interface PromptTheme {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  font: string;
  cursorText: string;
  yesLabel: string;
  noLabel: string;
}

export const DEFAULT_YES_NO_LAYOUT: PromptLayout = {
  yesNoBoxX: 182,
  yesNoBoxY: 104,
  yesNoBoxWidth: 48,
  yesNoBoxHeight: 34,
  yesLabelX: 6,
  yesLabelY: 7,
  noLabelX: 6,
  noLabelY: 18,
};

export const DEFAULT_PROMPT_THEME: PromptTheme = {
  backgroundColor: '#f8f8f8',
  borderColor: '#303030',
  borderWidth: 1,
  textColor: '#383838',
  font: '10px "Pokemon Emerald", monospace',
  cursorText: '▶',
  yesLabel: 'YES',
  noLabel: 'NO',
};


import {
  type PromptLayout,
  type PromptTheme,
  DEFAULT_PROMPT_THEME,
  DEFAULT_YES_NO_LAYOUT,
} from './PromptHost';
import {
  PromptController,
  type PromptControllerOptions,
  type PromptInputFrame,
  type PromptRenderState,
} from './PromptController';

export type {
  PromptControllerOptions,
  PromptInputFrame,
  PromptRenderState,
} from './PromptController';

export class PromptService {
  private controller: PromptController;

  constructor(options?: PromptControllerOptions) {
    this.controller = new PromptController(options);
  }

  clear(): void {
    this.controller.clear();
  }

  isActive(): boolean {
    return this.controller.isActive();
  }

  getRenderState(): PromptRenderState | null {
    return this.controller.getRenderState();
  }

  tick(dt: number, charDelayMs: number): void {
    this.controller.tick(dt, charDelayMs);
  }

  handleInput(input: PromptInputFrame): void {
    this.controller.handleInput(input);
  }

  showMessage(text: string, options?: { initialVisibleChars?: number }): Promise<void> {
    return this.controller.showMessage(text, options);
  }

  showYesNo(
    text: string,
    defaultYes: boolean,
    options?: { initialVisibleChars?: number },
  ): Promise<boolean> {
    return this.controller.showYesNo(text, defaultYes, options);
  }
}

export function drawPromptYesNo(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  cursor: 0 | 1,
  layout: PromptLayout = DEFAULT_YES_NO_LAYOUT,
  theme: PromptTheme = DEFAULT_PROMPT_THEME,
): void {
  const boxX = offsetX + layout.yesNoBoxX;
  const boxY = offsetY + layout.yesNoBoxY;

  ctx.fillStyle = theme.backgroundColor;
  ctx.fillRect(boxX, boxY, layout.yesNoBoxWidth, layout.yesNoBoxHeight);
  ctx.strokeStyle = theme.borderColor;
  ctx.lineWidth = theme.borderWidth;
  ctx.strokeRect(boxX, boxY, layout.yesNoBoxWidth, layout.yesNoBoxHeight);

  ctx.fillStyle = theme.textColor;
  ctx.font = theme.font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    cursor === 0 ? `${theme.cursorText} ${theme.yesLabel}` : `  ${theme.yesLabel}`,
    boxX + layout.yesLabelX,
    boxY + layout.yesLabelY,
  );
  ctx.fillText(
    cursor === 1 ? `${theme.cursorText} ${theme.noLabel}` : `  ${theme.noLabel}`,
    boxX + layout.noLabelX,
    boxY + layout.noLabelY,
  );
}

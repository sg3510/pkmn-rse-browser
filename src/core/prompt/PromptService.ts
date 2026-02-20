import {
  type PromptLayout,
  type PromptTheme,
  DEFAULT_PROMPT_THEME,
  DEFAULT_YES_NO_LAYOUT,
} from './PromptHost';

export interface PromptInputFrame {
  confirmPressed: boolean;
  cancelPressed: boolean;
  upPressed?: boolean;
  downPressed?: boolean;
}

interface MessagePromptState {
  type: 'message';
  text: string;
  visibleChars: number;
  elapsedMs: number;
  resolve: () => void;
}

interface YesNoPromptState {
  type: 'yesNo';
  text: string;
  visibleChars: number;
  elapsedMs: number;
  cursor: 0 | 1;
  resolve: (answer: boolean) => void;
}

type PromptState = MessagePromptState | YesNoPromptState;

export interface PromptRenderState {
  type: 'message' | 'yesNo';
  text: string;
  visibleChars: number;
  isFullyVisible: boolean;
  cursor?: 0 | 1;
}

export class PromptService {
  private state: PromptState | null = null;

  clear(): void {
    this.state = null;
  }

  isActive(): boolean {
    return this.state !== null;
  }

  getRenderState(): PromptRenderState | null {
    if (!this.state) {
      return null;
    }
    return {
      type: this.state.type,
      text: this.state.text,
      visibleChars: this.state.visibleChars,
      isFullyVisible: this.state.visibleChars >= this.state.text.length,
      cursor: this.state.type === 'yesNo' ? this.state.cursor : undefined,
    };
  }

  tick(dt: number, charDelayMs: number): void {
    if (!this.state) {
      return;
    }
    const delay = Math.max(1, charDelayMs);
    this.state.elapsedMs += dt;
    const chars = Math.floor(this.state.elapsedMs / delay);
    this.state.visibleChars = Math.max(0, Math.min(this.state.text.length, chars));
  }

  handleInput(input: PromptInputFrame): void {
    const prompt = this.state;
    if (!prompt) {
      return;
    }

    if (prompt.visibleChars < prompt.text.length) {
      if (input.confirmPressed || input.cancelPressed) {
        prompt.visibleChars = prompt.text.length;
      }
      return;
    }

    if (prompt.type === 'message') {
      if (input.confirmPressed || input.cancelPressed) {
        const resolve = prompt.resolve;
        this.state = null;
        resolve();
      }
      return;
    }

    if (input.upPressed || input.downPressed) {
      prompt.cursor = prompt.cursor === 0 ? 1 : 0;
      return;
    }

    if (input.confirmPressed) {
      const resolve = prompt.resolve;
      const answer = prompt.cursor === 0;
      this.state = null;
      resolve(answer);
      return;
    }

    if (input.cancelPressed) {
      const resolve = prompt.resolve;
      this.state = null;
      resolve(false);
    }
  }

  showMessage(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.state = {
        type: 'message',
        text,
        visibleChars: 0,
        elapsedMs: 0,
        resolve,
      };
    });
  }

  showYesNo(text: string, defaultYes: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      this.state = {
        type: 'yesNo',
        text,
        visibleChars: 0,
        elapsedMs: 0,
        cursor: defaultYes ? 0 : 1,
        resolve,
      };
    });
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


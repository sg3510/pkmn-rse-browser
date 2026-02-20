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

interface PromptOpenOptions {
  initialVisibleChars?: number;
}

export interface PromptRenderState {
  type: 'message' | 'yesNo';
  text: string;
  visibleChars: number;
  isFullyVisible: boolean;
  cursor?: 0 | 1;
}

export class PromptController {
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
    if (this.state.visibleChars >= this.state.text.length) {
      return;
    }

    const delay = Math.max(1, charDelayMs);
    this.state.elapsedMs += dt;
    while (this.state.elapsedMs >= delay && this.state.visibleChars < this.state.text.length) {
      this.state.elapsedMs -= delay;
      this.state.visibleChars += 1;
    }
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

  showMessage(text: string, options?: PromptOpenOptions): Promise<void> {
    const initialVisibleChars = Math.max(0, Math.min(
      text.length,
      Math.trunc(options?.initialVisibleChars ?? 0),
    ));
    return new Promise((resolve) => {
      this.state = {
        type: 'message',
        text,
        visibleChars: initialVisibleChars,
        elapsedMs: 0,
        resolve,
      };
    });
  }

  showYesNo(text: string, defaultYes: boolean, options?: PromptOpenOptions): Promise<boolean> {
    const initialVisibleChars = Math.max(0, Math.min(
      text.length,
      Math.trunc(options?.initialVisibleChars ?? 0),
    ));
    return new Promise((resolve) => {
      this.state = {
        type: 'yesNo',
        text,
        visibleChars: initialVisibleChars,
        elapsedMs: 0,
        cursor: defaultYes ? 0 : 1,
        resolve,
      };
    });
  }
}

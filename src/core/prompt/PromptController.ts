import {
  PromptPrinterEngine,
  type PromptInputFrame,
  type PromptOpenOptions,
  type PromptPrinterEngineConfig,
} from './PromptPrinterEngine.ts';

export type { PromptInputFrame } from './PromptPrinterEngine.ts';

export interface PromptRenderState {
  type: 'message' | 'yesNo';
  text: string;
  visibleChars: number;
  isFullyVisible: boolean;
  cursor?: 0 | 1;
  mode?: 'printing' | 'waiting' | 'scrolling';
  scrollProgress?: number;
  pageIndex?: number;
  pageCount?: number;
}

export interface PromptControllerOptions extends PromptPrinterEngineConfig {}

export class PromptController {
  private readonly engine: PromptPrinterEngine;

  constructor(options?: PromptControllerOptions) {
    this.engine = new PromptPrinterEngine(options);
  }

  clear(): void {
    this.engine.clear();
  }

  isActive(): boolean {
    return this.engine.isActive();
  }

  getRenderState(): PromptRenderState | null {
    const state = this.engine.getRenderState();
    if (!state) {
      return null;
    }

    return {
      type: state.type,
      text: state.text,
      visibleChars: state.visibleChars,
      isFullyVisible: state.isFullyVisible,
      cursor: state.cursor,
      mode: state.mode,
      scrollProgress: state.scrollProgress,
      pageIndex: state.pageIndex,
      pageCount: state.pageCount,
    };
  }

  tick(dt: number, charDelayMs: number): void {
    this.engine.tick(dt, charDelayMs);
  }

  handleInput(input: PromptInputFrame): void {
    this.engine.handleInput(input);
  }

  showMessage(text: string, options?: PromptOpenOptions): Promise<void> {
    return this.engine.showMessage(text, options);
  }

  showYesNo(text: string, defaultYes: boolean, options?: PromptOpenOptions): Promise<boolean> {
    return this.engine.showYesNo(text, defaultYes, options);
  }
}

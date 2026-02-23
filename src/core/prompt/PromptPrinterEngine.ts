/**
 * Shared prompt printer state machine.
 *
 * C refs:
 * - public/pokeemerald/src/text.c
 */
import { wrapPromptLine } from './textLayout.ts';

export interface PromptInputFrame {
  confirmPressed: boolean;
  cancelPressed: boolean;
  upPressed?: boolean;
  downPressed?: boolean;
}

export interface PromptOpenOptions {
  initialVisibleChars?: number;
}

export interface PromptPrinterEngineConfig {
  maxLines?: number;
  maxCharsPerLine?: number;
  scrollDurationMs?: number;
}

type PromptKind = 'message' | 'yesNo';
type PromptPhase = 'printing' | 'waiting' | 'scrolling';
type PromptPageTransition = 'clear' | 'scroll';

interface PromptPage {
  text: string;
  transition: PromptPageTransition;
  prefilledChars: number;
}

interface PromptBaseRuntimeState {
  type: PromptKind;
  sourceText: string;
  pages: PromptPage[];
  pageIndex: number;
  visibleChars: number;
  elapsedMs: number;
  phase: PromptPhase;
  scrollElapsedMs: number;
}

interface MessageRuntimeState extends PromptBaseRuntimeState {
  type: 'message';
  resolve: () => void;
}

interface YesNoRuntimeState extends PromptBaseRuntimeState {
  type: 'yesNo';
  cursor: 0 | 1;
  resolve: (answer: boolean) => void;
}

type PromptRuntimeState = MessageRuntimeState | YesNoRuntimeState;

export interface PromptPrinterRenderState {
  type: PromptKind;
  text: string;
  visibleChars: number;
  isFullyVisible: boolean;
  cursor?: 0 | 1;
  mode: PromptPhase;
  scrollProgress: number;
  pageIndex: number;
  pageCount: number;
}

const DEFAULT_SCROLL_DURATION_MS = 150;

function clampToInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class PromptPrinterEngine {
  private state: PromptRuntimeState | null = null;
  private readonly config: PromptPrinterEngineConfig;

  constructor(config?: PromptPrinterEngineConfig) {
    this.config = {
      maxLines: config?.maxLines,
      maxCharsPerLine: config?.maxCharsPerLine,
      scrollDurationMs: config?.scrollDurationMs ?? DEFAULT_SCROLL_DURATION_MS,
    };
  }

  clear(): void {
    this.state = null;
  }

  isActive(): boolean {
    return this.state !== null;
  }

  getRenderState(): PromptPrinterRenderState | null {
    const prompt = this.state;
    if (!prompt) {
      return null;
    }

    const page = this.getCurrentPage(prompt);
    const pageText = page?.text ?? '';
    const clampedVisibleChars = clampToInt(prompt.visibleChars, 0, pageText.length);
    const scrollDuration = this.getScrollDurationMs();
    const scrollProgress = prompt.phase === 'scrolling'
      ? clamp01(prompt.scrollElapsedMs / scrollDuration)
      : 0;

    return {
      type: prompt.type,
      text: pageText,
      visibleChars: clampedVisibleChars,
      isFullyVisible: clampedVisibleChars >= pageText.length,
      cursor: prompt.type === 'yesNo' ? prompt.cursor : undefined,
      mode: prompt.phase,
      scrollProgress,
      pageIndex: prompt.pageIndex,
      pageCount: prompt.pages.length,
    };
  }

  tick(dt: number, charDelayMs: number): void {
    const prompt = this.state;
    if (!prompt) {
      return;
    }

    if (prompt.phase === 'scrolling') {
      prompt.scrollElapsedMs += Math.max(0, dt);
      if (prompt.scrollElapsedMs >= this.getScrollDurationMs()) {
        this.finishScroll(prompt);
      }
      return;
    }

    if (prompt.phase !== 'printing') {
      return;
    }

    const page = this.getCurrentPage(prompt);
    if (!page) {
      return;
    }

    if (prompt.visibleChars >= page.text.length) {
      prompt.phase = 'waiting';
      return;
    }

    if (charDelayMs <= 0) {
      prompt.visibleChars = page.text.length;
      prompt.phase = 'waiting';
      prompt.elapsedMs = 0;
      return;
    }

    const delay = Math.max(1, charDelayMs);
    prompt.elapsedMs += Math.max(0, dt);
    while (prompt.elapsedMs >= delay && prompt.visibleChars < page.text.length) {
      prompt.elapsedMs -= delay;
      prompt.visibleChars += 1;
    }

    if (prompt.visibleChars >= page.text.length) {
      prompt.phase = 'waiting';
      prompt.elapsedMs = 0;
    }
  }

  handleInput(input: PromptInputFrame): void {
    const prompt = this.state;
    if (!prompt) {
      return;
    }

    const confirmOrCancel = input.confirmPressed || input.cancelPressed;

    if (prompt.phase === 'scrolling') {
      if (confirmOrCancel) {
        this.finishScroll(prompt);
      }
      return;
    }

    const page = this.getCurrentPage(prompt);
    if (!page) {
      return;
    }

    if (prompt.phase === 'printing') {
      if (confirmOrCancel) {
        prompt.visibleChars = page.text.length;
        prompt.phase = 'waiting';
      }
      return;
    }

    if (prompt.type === 'yesNo' && this.isFinalPage(prompt)) {
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
      return;
    }

    if (!confirmOrCancel) {
      return;
    }

    if (this.hasNextPage(prompt)) {
      this.advanceToNextPage(prompt);
      return;
    }

    if (prompt.type === 'message') {
      const resolve = prompt.resolve;
      this.state = null;
      resolve();
      return;
    }

    const resolve = prompt.resolve;
    this.state = null;
    resolve(prompt.cursor === 0);
  }

  showMessage(text: string, options?: PromptOpenOptions): Promise<void> {
    const pages = this.paginateText(text);
    const initialVisibleChars = clampToInt(
      options?.initialVisibleChars ?? 0,
      0,
      (pages[0]?.text ?? '').length,
    );

    return new Promise((resolve) => {
      const nextState: MessageRuntimeState = {
        type: 'message',
        sourceText: text,
        pages,
        pageIndex: 0,
        visibleChars: 0,
        elapsedMs: 0,
        phase: 'printing',
        scrollElapsedMs: 0,
        resolve,
      };
      this.state = nextState;
      this.activatePage(nextState, 0, initialVisibleChars);
    });
  }

  showYesNo(text: string, defaultYes: boolean, options?: PromptOpenOptions): Promise<boolean> {
    const pages = this.paginateText(text);
    const initialVisibleChars = clampToInt(
      options?.initialVisibleChars ?? 0,
      0,
      (pages[0]?.text ?? '').length,
    );

    return new Promise((resolve) => {
      const nextState: YesNoRuntimeState = {
        type: 'yesNo',
        sourceText: text,
        pages,
        pageIndex: 0,
        visibleChars: 0,
        elapsedMs: 0,
        phase: 'printing',
        scrollElapsedMs: 0,
        cursor: defaultYes ? 0 : 1,
        resolve,
      };
      this.state = nextState;
      this.activatePage(nextState, 0, initialVisibleChars);
    });
  }

  private getScrollDurationMs(): number {
    return Math.max(1, Math.trunc(this.config.scrollDurationMs ?? DEFAULT_SCROLL_DURATION_MS));
  }

  private getCurrentPage(prompt: PromptRuntimeState): PromptPage | null {
    return prompt.pages[prompt.pageIndex] ?? null;
  }

  private hasNextPage(prompt: PromptRuntimeState): boolean {
    return prompt.pageIndex + 1 < prompt.pages.length;
  }

  private isFinalPage(prompt: PromptRuntimeState): boolean {
    return !this.hasNextPage(prompt);
  }

  private advanceToNextPage(prompt: PromptRuntimeState): void {
    const nextIndex = prompt.pageIndex + 1;
    const nextPage = prompt.pages[nextIndex];
    if (!nextPage) {
      return;
    }

    if (nextPage.transition === 'scroll') {
      prompt.phase = 'scrolling';
      prompt.scrollElapsedMs = 0;
      return;
    }

    this.activatePage(prompt, nextIndex, nextPage.prefilledChars);
  }

  private finishScroll(prompt: PromptRuntimeState): void {
    const nextIndex = prompt.pageIndex + 1;
    const nextPage = prompt.pages[nextIndex];
    if (!nextPage) {
      prompt.phase = 'waiting';
      prompt.scrollElapsedMs = this.getScrollDurationMs();
      return;
    }

    this.activatePage(prompt, nextIndex, nextPage.prefilledChars);
  }

  private activatePage(prompt: PromptRuntimeState, pageIndex: number, initialVisibleChars: number): void {
    const page = prompt.pages[pageIndex] ?? { text: '', transition: 'clear', prefilledChars: 0 };
    const clampedVisibleChars = clampToInt(initialVisibleChars, 0, page.text.length);

    prompt.pageIndex = pageIndex;
    prompt.visibleChars = clampedVisibleChars;
    prompt.elapsedMs = 0;
    prompt.scrollElapsedMs = 0;
    prompt.phase = clampedVisibleChars >= page.text.length ? 'waiting' : 'printing';
  }

  private paginateText(text: string): PromptPage[] {
    if (text.length === 0) {
      return [{ text: '', transition: 'clear', prefilledChars: 0 }];
    }

    const maxCharsPerLine = this.resolveMaxCharsPerLine();
    const maxLines = this.resolveMaxLines();
    const tokens = text.replace(/\r\n/g, '\n').split(/(\\[nlp]|\n)/);

    const pages: PromptPage[] = [];
    let currentLines: string[] = [];
    let nextTransition: PromptPageTransition = 'clear';
    let nextPrefilledChars = 0;

    const emitPage = () => {
      if (currentLines.length === 0) {
        return;
      }

      const visualLines: string[] = [];
      for (const line of currentLines) {
        if (line.length === 0) {
          visualLines.push('');
          continue;
        }

        if (!Number.isFinite(maxCharsPerLine)) {
          visualLines.push(line);
          continue;
        }

        visualLines.push(...wrapPromptLine(line, {
          maxWidth: maxCharsPerLine,
          measureText: (value) => value.length,
        }));
      }

      if (visualLines.length <= maxLines) {
        pages.push({
          text: visualLines.join('\n'),
          transition: nextTransition,
          prefilledChars: nextPrefilledChars,
        });
      } else {
        const firstPageLines = visualLines.slice(0, maxLines);
        pages.push({
          text: firstPageLines.join('\n'),
          transition: nextTransition,
          prefilledChars: nextPrefilledChars,
        });

        let lineCursor = maxLines - 1;
        while (lineCursor < visualLines.length) {
          const end = Math.min(lineCursor + maxLines, visualLines.length);
          const subPageLines = visualLines.slice(lineCursor, end);
          const carriedLine = subPageLines[0] ?? '';

          pages.push({
            text: subPageLines.join('\n'),
            transition: 'scroll',
            prefilledChars: carriedLine.length + (subPageLines.length > 1 ? 1 : 0),
          });

          if (end >= visualLines.length) {
            break;
          }

          lineCursor = end - 1;
        }
      }

      currentLines = [];
      nextTransition = 'clear';
      nextPrefilledChars = 0;
    };

    for (const token of tokens) {
      if (token === '\\n' || token === '\n') {
        currentLines.push('');
        continue;
      }

      if (token === '\\l') {
        if (currentLines.length > 0) {
          emitPage();
          const lastPage = pages[pages.length - 1];
          if (lastPage) {
            const lastPageLines = lastPage.text.split('\n');
            const carriedLine = lastPageLines[lastPageLines.length - 1] ?? '';
            currentLines = [carriedLine];
            nextTransition = 'scroll';
            nextPrefilledChars = carriedLine.length + 1;
          }
        }
        continue;
      }

      if (token === '\\p') {
        emitPage();
        nextTransition = 'clear';
        nextPrefilledChars = 0;
        continue;
      }

      if (currentLines.length === 0) {
        currentLines.push(token);
      } else {
        currentLines[currentLines.length - 1] += token;
      }
    }

    if (currentLines.some((line) => line.length > 0) || pages.length === 0) {
      emitPage();
    }

    return pages.length > 0 ? pages : [{ text: '', transition: 'clear', prefilledChars: 0 }];
  }

  private resolveMaxCharsPerLine(): number {
    const raw = this.config.maxCharsPerLine;
    if (raw === undefined || !Number.isFinite(raw)) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(1, Math.trunc(raw));
  }

  private resolveMaxLines(): number {
    const raw = this.config.maxLines;
    if (raw === undefined || !Number.isFinite(raw)) {
      return Number.POSITIVE_INFINITY;
    }

    // Scroll carry semantics expect at least 2 lines visible.
    return Math.max(2, Math.trunc(raw));
  }
}

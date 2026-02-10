/**
 * Auto-pagination for dialog text.
 *
 * The GBA dialog box shows 2 lines at a time. Text is split into pages
 * based on explicit markers (\l for scroll, \p for paragraph break) or
 * auto-wrapping when lines overflow.
 *
 * Uses canvas measureText with the actual dialog font for pixel-accurate
 * line width measurement.
 */

import { DIALOG_DIMENSIONS, TILE_SIZE, TEXT_SPECS } from './types';

/** A single page of dialog text with transition metadata */
export interface PaginatedPage {
  /** The display text for this page (lines joined by \n) */
  text: string;
  /** How to transition INTO this page from the previous */
  transition: 'scroll' | 'clear';
  /** Number of chars already visible after a scroll (skip typewriter for these) */
  prefilledChars: number;
}

/** Cached canvas context for text measurement */
let measureCtx: CanvasRenderingContext2D | null = null;

function getCtx(font: string): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d')!;
  }
  measureCtx.font = font;
  return measureCtx;
}

/**
 * Word-wrap a single line to fit within maxWidth pixels.
 * Breaks at word boundaries (spaces).
 */
function wordWrapLine(
  line: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
): string[] {
  if (ctx.measureText(line).width <= maxWidth) return [line];

  const words = line.split(' ');
  const result: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) result.push(current);
      current = word;
    }
  }
  if (current) result.push(current);

  return result.length > 0 ? result : [line];
}

/**
 * Auto-paginate dialog text so each page fits within the 2-line dialog box.
 *
 * Handles:
 * - `\\l` (literal backslash-l from generated scripts): scroll transition
 * - `\\p` (literal backslash-p from generated scripts): clear/paragraph break
 * - `\\n` (literal backslash-n from generated scripts): newline within page
 * - Real `\n` characters (from hand-coded scripts): newline within page
 * - Auto-wrapping long lines that overflow the dialog width
 * - Auto-pagination when wrapped lines exceed 2 visible lines
 */
export function paginateDialogText(
  text: string,
  zoom: number = 1,
  fontFamily: string = '"Pokemon Emerald", "Pokemon RS", monospace',
): PaginatedPage[] {
  if (!text) return [{ text: '', transition: 'clear', prefilledChars: 0 }];

  const fontSize = TEXT_SPECS.fontSizePx * zoom;
  const font = `${fontSize}px ${fontFamily}`;
  const ctx = getCtx(font);

  const innerWidth =
    (DIALOG_DIMENSIONS.widthTiles - 2 * DIALOG_DIMENSIONS.paddingTiles) *
    TILE_SIZE *
    zoom;

  const maxLines = TEXT_SPECS.maxVisibleLines; // 2

  // Tokenize: split on literal escape sequences \\n, \\l, \\p while keeping them
  // Also treat real \n as a separator
  const tokens = text.split(/(\\[nlp]|\n)/);

  const pages: PaginatedPage[] = [];
  let currentLines: string[] = [];
  let nextTransition: 'scroll' | 'clear' = 'clear';
  let nextPrefilledChars = 0;

  function emitPage() {
    if (currentLines.length === 0) return;
    // Word-wrap each line, then flatten
    const visualLines: string[] = [];
    for (const line of currentLines) {
      if (line.length === 0) {
        visualLines.push('');
      } else {
        visualLines.push(...wordWrapLine(line, innerWidth, ctx));
      }
    }

    // If visual lines exceed maxLines, split into sub-pages with scroll
    if (visualLines.length <= maxLines) {
      pages.push({
        text: visualLines.join('\n'),
        transition: nextTransition,
        prefilledChars: nextPrefilledChars,
      });
    } else {
      // First sub-page
      const firstPageLines = visualLines.slice(0, maxLines);
      pages.push({
        text: firstPageLines.join('\n'),
        transition: nextTransition,
        prefilledChars: nextPrefilledChars,
      });

      // Remaining sub-pages with scroll carry
      let i = maxLines - 1; // carry last line
      while (i < visualLines.length) {
        const end = Math.min(i + maxLines, visualLines.length);
        const subPageLines = visualLines.slice(i, end);
        const carriedLine = subPageLines[0];
        pages.push({
          text: subPageLines.join('\n'),
          transition: 'scroll',
          prefilledChars: carriedLine.length + (subPageLines.length > 1 ? 1 : 0), // +1 for \n
        });
        if (end >= visualLines.length) break;
        i = end - 1; // carry last line
      }
    }

    currentLines = [];
    nextTransition = 'clear';
    nextPrefilledChars = 0;
  }

  for (const token of tokens) {
    if (token === '\\n' || token === '\n') {
      // Newline within current page
      currentLines.push('');
    } else if (token === '\\l') {
      // Scroll: emit current page, carry last line to next page
      if (currentLines.length > 0) {
        emitPage();
        // Set up carry for the next page
        const lastPage = pages[pages.length - 1];
        if (lastPage) {
          const lastPageLines = lastPage.text.split('\n');
          const carriedLine = lastPageLines[lastPageLines.length - 1];
          currentLines = [carriedLine];
          nextTransition = 'scroll';
          nextPrefilledChars = carriedLine.length + 1; // +1 for the \n after carried line
        }
      }
    } else if (token === '\\p') {
      // Paragraph: emit current page, start completely fresh
      emitPage();
      nextTransition = 'clear';
      nextPrefilledChars = 0;
    } else {
      // Regular text — append to current line
      if (currentLines.length === 0) {
        currentLines.push(token);
      } else {
        currentLines[currentLines.length - 1] += token;
      }
    }
  }

  // Emit any remaining text
  if (currentLines.length > 0 && currentLines.some(l => l.length > 0)) {
    emitPage();
  }

  return pages.length > 0 ? pages : [{ text: '', transition: 'clear', prefilledChars: 0 }];
}

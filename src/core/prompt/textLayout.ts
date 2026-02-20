export interface PromptTextWrapOptions {
  maxWidth: number;
  measureText: (value: string) => number;
}

export function wrapPromptLine(line: string, options: PromptTextWrapOptions): string[] {
  if (options.measureText(line) <= options.maxWidth) {
    return [line];
  }

  const words = line.split(' ');
  const wrapped: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (options.measureText(candidate) <= options.maxWidth) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      wrapped.push(current);
    }
    current = word;
  }

  if (current.length > 0) {
    wrapped.push(current);
  }

  return wrapped.length > 0 ? wrapped : [line];
}

export function wrapPromptParagraphs(
  text: string,
  options: PromptTextWrapOptions,
  maxLines: number = Number.POSITIVE_INFINITY,
): string[] {
  const wrappedLines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    const nextLines = paragraph.length === 0
      ? ['']
      : wrapPromptLine(paragraph, options);

    for (const line of nextLines) {
      wrappedLines.push(line);
      if (wrappedLines.length >= maxLines) {
        return wrappedLines;
      }
    }
  }

  return wrappedLines;
}

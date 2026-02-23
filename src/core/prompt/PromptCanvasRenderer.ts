/**
 * Shared prompt canvas renderer with profile-driven layout.
 *
 * C refs:
 * - public/pokeemerald/src/text_window.c
 * - public/pokeemerald/src/battle_bg.c
 */
import type { PromptRenderState } from './PromptController.ts';
import type { PromptWindowProfile } from './PromptWindowProfile.ts';
import type { PromptWindowSkin } from './PromptWindowSkin.ts';
import { wrapPromptParagraphs } from './textLayout.ts';

export interface PromptCanvasRendererRequest {
  profile: PromptWindowProfile;
  skin: PromptWindowSkin;
  state: PromptRenderState | null;
  originX: number;
  originY: number;
  scale?: number;
  frameStyle?: number;
  showArrow?: boolean;
  arrowFrameIndex?: number;
  scrollProgress?: number;
  textColor?: string;
  shadowColor?: string;
  fontFamily?: string;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const DOWN_ARROW_Y_OFFSETS = [0, 1, 2, 1] as const;

interface PromptTextLayoutSnapshot {
  clipX: number;
  clipY: number;
  clipWidth: number;
  lineHeightPx: number;
  lines: string[];
  lineWidths: number[];
}

function drawDownArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const unit = size / 8;
  const outline = '#303030';
  const pixels = [
    '01111110',
    '12222222',
    '01222221',
    '00122210',
    '00012200',
    '00011000',
    '00000000',
    '00000000',
  ] as const;

  for (let row = 0; row < pixels.length; row++) {
    const line = pixels[row];
    if (!line) continue;
    for (let col = 0; col < line.length; col++) {
      const value = line[col];
      if (value === '0') continue;
      ctx.fillStyle = value === '1' ? outline : color;
      ctx.fillRect(
        x + (col * unit),
        y + (row * unit),
        Math.ceil(unit),
        Math.ceil(unit),
      );
    }
  }
}

export class PromptCanvasRenderer {
  async preload(skin: PromptWindowSkin, options?: { frameStyle?: number }): Promise<void> {
    await skin.preload?.({ frameStyle: options?.frameStyle });
  }

  render(ctx: CanvasRenderingContext2D, request: PromptCanvasRendererRequest): void {
    const {
      profile,
      skin,
      state,
      originX,
      originY,
      frameStyle,
      showArrow = false,
      textColor,
      shadowColor,
      fontFamily,
    } = request;
    const scale = request.scale ?? 1;

    skin.draw(ctx, {
      originX,
      originY,
      scale,
      profile,
      frameStyle,
    });

    if (!state) {
      return;
    }

    const textLayout = this.drawText(ctx, {
      profile,
      state,
      originX,
      originY,
      scale,
      textColor,
      shadowColor,
      fontFamily,
      scrollProgress: request.scrollProgress,
    });

    if (showArrow && profile.arrow) {
      const arrowPosition = this.resolveArrowPosition({
        profile,
        originX,
        originY,
        scale,
        textLayout,
      });
      const arrowFrameIndex = Math.max(0, Math.trunc(request.arrowFrameIndex ?? 0));
      const bobOffset = profile.arrow.animate === false
        ? 0
        : DOWN_ARROW_Y_OFFSETS[arrowFrameIndex & 3] * scale;

      drawDownArrow(
        ctx,
        arrowPosition.x,
        arrowPosition.y + bobOffset,
        profile.arrow.size * scale,
        profile.arrow.color,
      );
    }

    if (state.type === 'yesNo' && state.isFullyVisible) {
      this.drawYesNoMenu(ctx, {
        profile,
        cursor: state.cursor ?? 0,
        originX,
        originY,
        scale,
      });
    }
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    options: {
      profile: PromptWindowProfile;
      state: PromptRenderState;
      originX: number;
      originY: number;
      scale: number;
      textColor?: string;
      shadowColor?: string;
      fontFamily?: string;
      scrollProgress?: number;
    },
  ): PromptTextLayoutSnapshot {
    const { profile, state, originX, originY, scale } = options;
    const clampedVisibleChars = Math.max(0, Math.min(state.text.length, Math.trunc(state.visibleChars)));
    const visibleText = state.text.slice(0, clampedVisibleChars);

    const resolvedColor = options.textColor ?? profile.text.color;
    const resolvedShadowColor = options.shadowColor ?? profile.text.shadowColor;
    const resolvedFontFamily = options.fontFamily ?? profile.text.fontFamily;
    const fontSizePx = profile.text.fontSize * scale;
    const fontWeight = profile.text.fontWeight ?? 'normal';

    ctx.save();
    ctx.fillStyle = resolvedColor;
    ctx.font = `${fontWeight} ${fontSizePx}px ${resolvedFontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = wrapPromptParagraphs(
      visibleText,
      {
        maxWidth: profile.text.width * scale,
        measureText: (value) => ctx.measureText(value).width,
      },
      Math.max(1, profile.text.maxLines + 1),
    );

    const lineHeightPx = profile.text.lineHeight * scale;
    const scrollOffset = clamp01(options.scrollProgress ?? 0) * lineHeightPx;
    const clipX = originX + (profile.text.x * scale);
    const clipY = originY + (profile.text.y * scale);
    const clipWidth = profile.text.width * scale;
    const clipHeight = Math.max(
      Math.max(1, profile.text.maxLines) * lineHeightPx,
      Math.max(1, profile.text.maxLines) * fontSizePx,
    );

    ctx.beginPath();
    ctx.rect(clipX, clipY, clipWidth, clipHeight);
    ctx.clip();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const drawX = clipX;
      const drawY = clipY + (i * lineHeightPx) - scrollOffset;

      if (resolvedShadowColor) {
        ctx.fillStyle = resolvedShadowColor;
        ctx.fillText(
          line,
          drawX + ((profile.text.shadowOffsetX ?? 0) * scale),
          drawY + ((profile.text.shadowOffsetY ?? 0) * scale),
        );
      }

      ctx.fillStyle = resolvedColor;
      ctx.fillText(line, drawX, drawY);
    }

    const lineWidths = lines.map((line) => ctx.measureText(line).width);
    ctx.restore();

    return {
      clipX,
      clipY,
      clipWidth,
      lineHeightPx,
      lines,
      lineWidths,
    };
  }

  private resolveArrowPosition(options: {
    profile: PromptWindowProfile;
    originX: number;
    originY: number;
    scale: number;
    textLayout: PromptTextLayoutSnapshot;
  }): { x: number; y: number } {
    const { profile, originX, originY, scale, textLayout } = options;
    const arrow = profile.arrow;

    if (!arrow) {
      return { x: originX, y: originY };
    }

    if (arrow.anchor !== 'textEnd') {
      return {
        x: originX + (arrow.x * scale),
        y: originY + (arrow.y * scale),
      };
    }

    const lineCount = Math.max(1, textLayout.lines.length);
    const lineIndex = lineCount - 1;
    const lineWidth = textLayout.lineWidths[lineIndex] ?? 0;
    const arrowSizePx = arrow.size * scale;
    const gap = (arrow.textGapX ?? 2) * scale;
    const lineOffsetY = (arrow.lineOffsetY ?? 0) * scale;

    const minX = textLayout.clipX;
    const maxX = (textLayout.clipX + textLayout.clipWidth) - arrowSizePx;
    const anchoredX = textLayout.clipX + lineWidth + gap;

    return {
      x: Math.max(minX, Math.min(maxX, anchoredX)),
      y: textLayout.clipY + (lineIndex * textLayout.lineHeightPx) + lineOffsetY,
    };
  }

  private drawYesNoMenu(
    ctx: CanvasRenderingContext2D,
    options: {
      profile: PromptWindowProfile;
      cursor: 0 | 1;
      originX: number;
      originY: number;
      scale: number;
    },
  ): void {
    const { profile, cursor, originX, originY, scale } = options;
    const yesNo = profile.yesNo;
    if (!yesNo) {
      return;
    }

    const boxX = originX + (yesNo.boxX * scale);
    const boxY = originY + (yesNo.boxY * scale);
    const boxWidth = yesNo.boxWidth * scale;
    const boxHeight = yesNo.boxHeight * scale;

    ctx.save();
    ctx.fillStyle = yesNo.backgroundColor;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    ctx.strokeStyle = yesNo.borderColor;
    ctx.lineWidth = yesNo.borderWidth * scale;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = yesNo.textColor;
    ctx.font = `${yesNo.fontSize * scale}px ${yesNo.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillText(
      cursor === 0 ? `${yesNo.cursorText} ${yesNo.yesLabel}` : `  ${yesNo.yesLabel}`,
      boxX + (yesNo.yesLabelX * scale),
      boxY + (yesNo.yesLabelY * scale),
    );
    ctx.fillText(
      cursor === 1 ? `${yesNo.cursorText} ${yesNo.noLabel}` : `  ${yesNo.noLabel}`,
      boxX + (yesNo.noLabelX * scale),
      boxY + (yesNo.noLabelY * scale),
    );
    ctx.restore();
  }
}

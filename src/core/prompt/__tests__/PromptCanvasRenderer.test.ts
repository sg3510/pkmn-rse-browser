import assert from 'node:assert/strict';
import test from 'node:test';
import { PromptCanvasRenderer } from '../PromptCanvasRenderer.ts';
import {
  BATTLE_MESSAGE_PROFILE,
  EVOLUTION_MESSAGE_PROFILE,
  FIELD_MESSAGE_PROFILE,
} from '../PromptWindowProfiles.ts';
import type { PromptWindowSkin } from '../PromptWindowSkin.ts';
import type { PromptRenderState } from '../PromptController.ts';

class MockCanvasContext {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  lineWidth = 1;
  font = '';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  imageSmoothingEnabled = true;

  readonly ops: string[] = [];

  private fmt(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }

  save(): void {
    this.ops.push('save');
  }

  restore(): void {
    this.ops.push('restore');
  }

  beginPath(): void {
    this.ops.push('beginPath');
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.ops.push(`rect:${this.fmt(x)},${this.fmt(y)},${this.fmt(width)},${this.fmt(height)}`);
  }

  clip(): void {
    this.ops.push('clip');
  }

  moveTo(x: number, y: number): void {
    this.ops.push(`moveTo:${this.fmt(x)},${this.fmt(y)}`);
  }

  lineTo(x: number, y: number): void {
    this.ops.push(`lineTo:${this.fmt(x)},${this.fmt(y)}`);
  }

  closePath(): void {
    this.ops.push('closePath');
  }

  fill(): void {
    this.ops.push(`fill:${String(this.fillStyle)}`);
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.ops.push(`fillRect:${this.fmt(x)},${this.fmt(y)},${this.fmt(width)},${this.fmt(height)}:${String(this.fillStyle)}`);
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    this.ops.push(`strokeRect:${this.fmt(x)},${this.fmt(y)},${this.fmt(width)},${this.fmt(height)}:${String(this.strokeStyle)}:${this.fmt(this.lineWidth)}`);
  }

  fillText(text: string, x: number, y: number): void {
    this.ops.push(`fillText:${text}:${this.fmt(x)},${this.fmt(y)}:${this.font}:${String(this.fillStyle)}`);
  }

  measureText(text: string): TextMetrics {
    return {
      width: text.length * 6,
    } as TextMetrics;
  }
}

function createRecordingSkin(): PromptWindowSkin {
  return {
    id: 'recording-skin',
    draw: (ctx, request) => {
      const mock = ctx as unknown as MockCanvasContext;
      mock.ops.push(
        `skin:${request.profile.id}:${request.profile.skinVariant}:${request.originX}:${request.originY}:${request.scale}`,
      );
      mock.fillStyle = '#202020';
      mock.fillRect(
        request.originX + (request.profile.window.x * request.scale),
        request.originY + (request.profile.window.y * request.scale),
        request.profile.window.width * request.scale,
        request.profile.window.height * request.scale,
      );
    },
  };
}

function createMessageState(text: string): PromptRenderState {
  return {
    type: 'message',
    text,
    visibleChars: text.length,
    isFullyVisible: true,
  };
}

test('battle message renderer operations are deterministic', () => {
  const renderer = new PromptCanvasRenderer();
  const ctx = new MockCanvasContext();

  renderer.render(ctx as unknown as CanvasRenderingContext2D, {
    profile: BATTLE_MESSAGE_PROFILE,
    skin: createRecordingSkin(),
    state: createMessageState('BATTLE'),
    originX: 0,
    originY: 0,
    scale: 1,
    showArrow: false,
  });

  assert.deepEqual(ctx.ops, [
    'skin:battle_message:message:0:0:1',
    'fillRect:0,112,240,48:#202020',
    'save',
    'beginPath',
    'rect:18,121,198,32',
    'clip',
    'fillText:BATTLE:18,121:normal 10px "Pokemon Emerald", monospace:#383838',
    'restore',
  ]);
});

test('field message renderer operations are deterministic', () => {
  const renderer = new PromptCanvasRenderer();
  const ctx = new MockCanvasContext();

  renderer.render(ctx as unknown as CanvasRenderingContext2D, {
    profile: FIELD_MESSAGE_PROFILE,
    skin: createRecordingSkin(),
    state: createMessageState('HI'),
    originX: 0,
    originY: 0,
    scale: 2,
    showArrow: false,
  });

  assert.deepEqual(ctx.ops, [
    'skin:field_message:field:0:0:2',
    'fillRect:0,0,480,88:#202020',
    'save',
    'beginPath',
    'rect:16,12,448,48',
    'clip',
    'fillText:HI:18,14:normal 32px "Pokemon Emerald", "Pokemon RS", monospace:#a8a8a8',
    'fillText:HI:16,12:normal 32px "Pokemon Emerald", "Pokemon RS", monospace:#303030',
    'restore',
  ]);
});

test('evolution yes/no renderer operations are deterministic', () => {
  const renderer = new PromptCanvasRenderer();
  const ctx = new MockCanvasContext();

  const state: PromptRenderState = {
    type: 'yesNo',
    text: 'EVOLVE?',
    visibleChars: 7,
    isFullyVisible: true,
    cursor: 1,
  };

  renderer.render(ctx as unknown as CanvasRenderingContext2D, {
    profile: EVOLUTION_MESSAGE_PROFILE,
    skin: createRecordingSkin(),
    state,
    originX: 0,
    originY: 0,
    scale: 1,
    showArrow: false,
  });

  assert.deepEqual(ctx.ops, [
    'skin:evolution_message:message:0:0:1',
    'fillRect:0,112,240,48:#202020',
    'save',
    'beginPath',
    'rect:18,121,198,32',
    'clip',
    'fillText:EVOLVE?:18,121:normal 10px "Pokemon Emerald", monospace:#383838',
    'restore',
    'save',
    'fillRect:182,104,48,34:#f8f8f8',
    'strokeRect:182,104,48,34:#303030:1',
    'fillText:  YES:188,111:10px "Pokemon Emerald", monospace:#383838',
    'fillText:▶ NO:188,122:10px "Pokemon Emerald", monospace:#383838',
    'restore',
  ]);
});

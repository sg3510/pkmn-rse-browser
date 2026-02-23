/**
 * Battle textbox skin adapter.
 *
 * C refs:
 * - public/pokeemerald/src/battle_bg.c
 * - public/pokeemerald/src/battle_message.c
 */
import {
  drawBattleWindowPageChrome,
  preloadBattleInterfaceAssets,
  type BattleWindowPage,
} from '../../../battle/render/BattleHealthBox';
import type { PromptWindowSkin, PromptWindowSkinDrawRequest } from '../PromptWindowSkin';

const VARIANT_TO_PAGE: Record<string, BattleWindowPage> = {
  message: 'message',
  action: 'action',
  move: 'move',
};

export class BattleTextboxSkin implements PromptWindowSkin {
  readonly id = 'BattleTextboxSkin';

  async preload(): Promise<void> {
    await preloadBattleInterfaceAssets();
  }

  draw(ctx: CanvasRenderingContext2D, request: PromptWindowSkinDrawRequest): void {
    const page = VARIANT_TO_PAGE[request.profile.skinVariant] ?? 'message';
    drawBattleWindowPageChrome(ctx, request.originX, request.originY, page);
  }
}

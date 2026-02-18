/**
 * Battle UI rendering (health boxes, bars, text boxes, menus).
 *
 * C refs:
 * - public/pokeemerald/src/battle_interface.c
 * - public/pokeemerald/src/battle_bg.c
 */
import { loadImageCanvasAsset } from '../../utils/assetLoader';
import { STATUS } from '../../pokemon/types';
import { BATTLE_LAYOUT } from './BattleLayout';

interface BattleInterfaceAssets {
  enemyHealthbox: HTMLCanvasElement;
  playerHealthbox: HTMLCanvasElement;
  statusIcons: HTMLCanvasElement;
  textbox: HTMLCanvasElement;
  ballDisplay: HTMLCanvasElement;
}

export type PartyBallState = 'healthy' | 'status' | 'fainted' | 'empty';

let assets: BattleInterfaceAssets | null = null;
let assetsPromise: Promise<void> | null = null;

const ENEMY_HEALTHBOX_SRC = { x: 1, y: 2, width: 100, height: 28 };
const PLAYER_HEALTHBOX_SRC = { x: 1, y: 2, width: 103, height: 36 };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function setBattleFont(
  ctx: CanvasRenderingContext2D,
  sizePx: number,
  weight: 'normal' | 'bold' = 'normal',
): void {
  ctx.font = `${weight} ${sizePx}px "Pokemon Emerald", monospace`;
}

/**
 * Preload battle UI assets. Call once during battle state enter.
 */
export async function preloadBattleInterfaceAssets(): Promise<void> {
  if (assets) {
    return;
  }
  if (assetsPromise) {
    return assetsPromise;
  }

  assetsPromise = (async () => {
    try {
      const [enemyHealthbox, playerHealthbox, statusIcons, textbox, ballDisplay] = await Promise.all([
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/healthbox_singles_opponent.png', {
          transparency: { type: 'top-left' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/healthbox_singles_player.png', {
          transparency: { type: 'top-left' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/status.png', {
          transparency: { type: 'none' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/textbox.png', {
          transparency: { type: 'none' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/ball_display.png', {
          transparency: { type: 'top-left' },
        }),
      ]);

      assets = {
        enemyHealthbox,
        playerHealthbox,
        statusIcons,
        textbox,
        ballDisplay,
      };
    } catch (error) {
      console.warn('[BattleHealthBox] Failed to preload interface assets:', error);
    }
  })();

  return assetsPromise;
}

/** HP bar color by percentage. */
function getHpColor(percent: number): string {
  if (percent > 0.5) return '#48d848';
  if (percent > 0.2) return '#f8d030';
  return '#f85858';
}

function statusRowFromStatus(status: number): number | null {
  if ((status & STATUS.TOXIC) !== 0 || (status & STATUS.POISON) !== 0) return 0; // PSN
  if ((status & STATUS.PARALYSIS) !== 0) return 1; // PRZ
  if ((status & STATUS.SLEEP) !== 0) return 2; // SLP
  if ((status & STATUS.FREEZE) !== 0) return 3; // FRZ
  if ((status & STATUS.BURN) !== 0) return 4; // BRN
  return null;
}


function partyBallFrameFromState(state: PartyBallState): number {
  if (state === 'healthy') return 0;
  if (state === 'empty') return 1;
  if (state === 'fainted') return 2;
  return 3;
}

function drawPartyBallRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  states: readonly PartyBallState[],
): void {
  const max = Math.min(6, states.length);
  for (let i = 0; i < max; i++) {
    const state = states[i] ?? 'empty';
    const frame = partyBallFrameFromState(state);
    const dx = x + (i * 8);

    if (assets) {
      ctx.drawImage(assets.ballDisplay, frame * 8, 0, 8, 8, dx, y, 8, 8);
    } else {
      ctx.fillStyle = state === 'fainted' ? '#8a8a8a' : (state === 'status' ? '#f8d030' : '#f8f8f8');
      ctx.fillRect(dx + 1, y + 1, 6, 6);
      ctx.strokeStyle = '#303030';
      ctx.strokeRect(dx + 1, y + 1, 6, 6);
    }
  }
}

function drawStatusIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  status: number,
): void {
  const row = statusRowFromStatus(status);
  if (row === null) return;

  if (assets) {
    ctx.drawImage(assets.statusIcons, 0, row * 8, 20, 8, x, y, 20, 8);
    return;
  }

  const labels = ['PSN', 'PAR', 'SLP', 'FRZ', 'BRN'];
  ctx.fillStyle = '#383838';
  setBattleFont(ctx, 7);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(labels[row] ?? '', x, y);
}

function drawTextboxBackdrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (assets) {
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(assets.textbox, 0, 0, assets.textbox.width, assets.textbox.height, x, y, width, height);
    ctx.imageSmoothingEnabled = prevSmoothing;
    return;
  }

  ctx.fillStyle = '#303030';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x + 4, y + 4, width - 8, height - 8);
}

/** Draw the enemy's health box (single battle). */
export function drawEnemyHealthBox(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  name: string,
  level: number,
  currentHp: number,
  maxHp: number,
  status: number = STATUS.NONE,
): void {
  const x = offsetX + BATTLE_LAYOUT.enemy.healthboxX;
  const y = offsetY + BATTLE_LAYOUT.enemy.healthboxY;
  const boxW = ENEMY_HEALTHBOX_SRC.width;

  if (assets) {
    ctx.drawImage(
      assets.enemyHealthbox,
      ENEMY_HEALTHBOX_SRC.x,
      ENEMY_HEALTHBOX_SRC.y,
      ENEMY_HEALTHBOX_SRC.width,
      ENEMY_HEALTHBOX_SRC.height,
      x,
      y,
      ENEMY_HEALTHBOX_SRC.width,
      ENEMY_HEALTHBOX_SRC.height,
    );
  } else {
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(x, y, boxW, ENEMY_HEALTHBOX_SRC.height);
    ctx.strokeStyle = '#585048';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, boxW, ENEMY_HEALTHBOX_SRC.height);
  }

  ctx.fillStyle = '#383028';
  setBattleFont(ctx, 9);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x + 4, y + 2);
  ctx.textAlign = 'right';
  ctx.fillText(`Lv${level}`, x + boxW - 5, y + 2);

  const hpPercent = maxHp > 0 ? clamp01(currentHp / maxHp) : 0;
  const barX = x + 19;
  const barY = y + 14;
  const barW = 77;
  const barH = 4;

  ctx.fillStyle = '#484848';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = getHpColor(hpPercent);
  ctx.fillRect(barX, barY, Math.floor(barW * hpPercent), barH);

  drawStatusIcon(ctx, x + 75, y + 16, status);
}

/** Draw the player's health box (single battle). */
export function drawPlayerHealthBox(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  name: string,
  level: number,
  currentHp: number,
  maxHp: number,
  expPercent = 0,
  status: number = STATUS.NONE,
): void {
  const x = offsetX + BATTLE_LAYOUT.player.healthboxX;
  const y = offsetY + BATTLE_LAYOUT.player.healthboxY;
  const boxW = PLAYER_HEALTHBOX_SRC.width;

  if (assets) {
    ctx.drawImage(
      assets.playerHealthbox,
      PLAYER_HEALTHBOX_SRC.x,
      PLAYER_HEALTHBOX_SRC.y,
      PLAYER_HEALTHBOX_SRC.width,
      PLAYER_HEALTHBOX_SRC.height,
      x,
      y,
      PLAYER_HEALTHBOX_SRC.width,
      PLAYER_HEALTHBOX_SRC.height,
    );
  } else {
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(x, y, boxW, PLAYER_HEALTHBOX_SRC.height);
    ctx.strokeStyle = '#585048';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, boxW, PLAYER_HEALTHBOX_SRC.height);
  }

  ctx.fillStyle = '#383028';
  setBattleFont(ctx, 9);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x + 4, y + 2);
  ctx.textAlign = 'right';
  ctx.fillText(`Lv${level}`, x + boxW - 6, y + 2);

  const hpPercent = maxHp > 0 ? clamp01(currentHp / maxHp) : 0;
  const barX = x + 20;
  const barY = y + 14;
  const barW = 76;
  const barH = 5;

  ctx.fillStyle = '#484848';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = getHpColor(hpPercent);
  ctx.fillRect(barX, barY, Math.floor(barW * hpPercent), barH);

  ctx.fillStyle = '#383028';
  setBattleFont(ctx, 8);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.max(0, currentHp)}/${maxHp}`, x + boxW - 6, y + 21);

  const expBarX = x + 8;
  const expBarY = y + 31;
  const expBarW = boxW - 16;
  const expBarH = 3;
  const clampedExpPercent = clamp01(expPercent);

  ctx.fillStyle = '#404040';
  ctx.fillRect(expBarX, expBarY, expBarW, expBarH);
  ctx.fillStyle = '#58a8f8';
  ctx.fillRect(expBarX, expBarY, Math.floor(expBarW * clampedExpPercent), expBarH);

  drawStatusIcon(ctx, x + 7, y + 21, status);
}

/** Draw the battle message text box. */
export function drawTextBox(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  text: string,
): void {
  const x = offsetX + BATTLE_LAYOUT.scene.textboxX;
  const y = offsetY + BATTLE_LAYOUT.scene.textboxY;
  const w = BATTLE_LAYOUT.scene.textboxWidth;
  const h = BATTLE_LAYOUT.scene.textboxHeight;

  drawTextboxBackdrop(ctx, x, y, w, h);

  ctx.fillStyle = '#383838';
  setBattleFont(ctx, 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const maxCharsPerLine = 28;
  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';
  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  for (let i = 0; i < Math.min(lines.length, 2); i++) {
    ctx.fillText(lines[i] ?? '', x + 12, y + 10 + i * 16);
  }
}

/** Draw the action menu (FIGHT / BAG / POKEMON / RUN). */
export function drawActionMenu(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  selectedIndex: number,
  pokemonName: string,
  firstBattle: boolean,
): void {
  const x = offsetX;
  const y = offsetY + BATTLE_LAYOUT.scene.textboxY;

  drawTextboxBackdrop(ctx, x, y, BATTLE_LAYOUT.scene.textboxWidth, BATTLE_LAYOUT.scene.textboxHeight);

  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x + 4, y + 4, 116, 40);
  ctx.fillStyle = '#d8d8d0';
  ctx.fillRect(x + 124, y + 4, 112, 40);

  ctx.fillStyle = '#383838';
  setBattleFont(ctx, 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('What will', x + 12, y + 10);
  ctx.fillText(`${pokemonName} do?`, x + 12, y + 26);

  const actions = ['FIGHT', 'BAG', 'POKeMON', 'RUN'];
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = x + 128 + col * 54;
    const by = y + 8 + row * 18;
    const isSelected = i === selectedIndex;
    const disabled = firstBattle && i !== 0;

    if (isSelected) {
      ctx.fillStyle = '#383838';
      ctx.fillText('>', bx - 2, by);
    }

    ctx.fillStyle = disabled ? '#989898' : '#383838';
    setBattleFont(ctx, 9);
    ctx.fillText(actions[i] ?? '', bx + 8, by);
  }
}

/** Draw the move selection menu. */
export function drawMoveMenu(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  moves: Array<{ name: string; pp: number; maxPp: number; type: string }>,
  selectedIndex: number,
): void {
  const x = offsetX;
  const y = offsetY + BATTLE_LAYOUT.scene.textboxY;

  drawTextboxBackdrop(ctx, x, y, BATTLE_LAYOUT.scene.textboxWidth, BATTLE_LAYOUT.scene.textboxHeight);

  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x + 4, y + 4, 160, 40);
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(x + 168, y + 4, 68, 40);

  setBattleFont(ctx, 9);
  ctx.textBaseline = 'top';

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const mx = x + 8 + col * 80;
    const my = y + 8 + row * 18;

    if (i < moves.length) {
      const move = moves[i];
      const isSelected = i === selectedIndex;

      if (isSelected) {
        ctx.fillStyle = '#383838';
        ctx.textAlign = 'left';
        ctx.fillText('>', mx - 2, my);
      }

      ctx.fillStyle = '#383838';
      ctx.textAlign = 'left';
      ctx.fillText(move?.name ?? '-', mx + 8, my);
    } else {
      ctx.fillStyle = '#a0a0a0';
      ctx.textAlign = 'left';
      ctx.fillText('-', mx + 8, my);
    }
  }

  if (selectedIndex < moves.length) {
    const move = moves[selectedIndex];
    ctx.fillStyle = '#383838';
    setBattleFont(ctx, 8);
    ctx.textAlign = 'left';
    ctx.fillText(`PP ${move?.pp ?? 0}/${move?.maxPp ?? 0}`, x + 174, y + 10);
    ctx.fillText(`TYPE/${move?.type ?? 'NORMAL'}`, x + 174, y + 26);
  }
}


/** Draw party ball indicators (6 slots each side). */
export function drawPartyBallIndicators(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  playerStates: readonly PartyBallState[],
  enemyStates: readonly PartyBallState[],
): void {
  drawPartyBallRow(ctx, offsetX + BATTLE_LAYOUT.enemy.partyBallsX, offsetY + BATTLE_LAYOUT.enemy.partyBallsY, enemyStates);
  drawPartyBallRow(
    ctx,
    offsetX + BATTLE_LAYOUT.player.partyBallsX,
    offsetY + BATTLE_LAYOUT.player.partyBallsY,
    playerStates,
  );
}

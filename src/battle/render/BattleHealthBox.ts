/**
 * Battle UI rendering (health boxes, bars, text boxes, menus).
 *
 * C refs:
 * - public/pokeemerald/src/battle_interface.c
 * - public/pokeemerald/src/battle_bg.c
 */
import { loadBinaryAsset, loadImageCanvasAsset, loadTextAsset } from '../../utils/assetLoader';
import { decodeGbaBgTilemap, drawGbaBgTilemap, type IndexedGbaTilesetSource } from '../../rendering/gbaTilemap';
import { loadTilesetImage, parsePalette, type TilesetImageData } from '../../utils/mapLoader';
import { STATUS } from '../../pokemon/types';
import { BATTLE_LAYOUT } from './BattleLayout';

interface BattleInterfaceAssets {
  enemyHealthbox: HTMLCanvasElement;
  playerHealthbox: HTMLCanvasElement;
  statusIcons: HTMLCanvasElement;
  ballDisplay: HTMLCanvasElement;
  windowPages: Record<BattleWindowPage, HTMLCanvasElement>;
}

export type PartyBallState = 'healthy' | 'status' | 'fainted' | 'empty';
type BattleWindowPage = 'message' | 'action' | 'move';

let assets: BattleInterfaceAssets | null = null;
let assetsPromise: Promise<void> | null = null;
let fontReadyPromise: Promise<void> | null = null;

const ENEMY_HEALTHBOX_SRC = { x: 1, y: 2, width: 100, height: 28 };
const PLAYER_HEALTHBOX_SRC = { x: 1, y: 2, width: 103, height: 36 };
const BATTLE_BG0_MAP_WIDTH_TILES = 32;
const BATTLE_BG0_MAP_HEIGHT_TILES = 64;
const BATTLE_BG0_TILE_SIZE = 8;
const BATTLE_BG0_CANVAS_WIDTH = BATTLE_BG0_MAP_WIDTH_TILES * BATTLE_BG0_TILE_SIZE;
const BATTLE_BG0_CANVAS_HEIGHT = BATTLE_BG0_MAP_HEIGHT_TILES * BATTLE_BG0_TILE_SIZE;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toIndexedTilesetSource(tileset: TilesetImageData): IndexedGbaTilesetSource {
  return {
    kind: 'indexed',
    pixels: tileset.data,
    width: tileset.width,
    height: tileset.height,
  };
}

function createBattlePageCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BATTLE_LAYOUT.scene.width;
  canvas.height = BATTLE_LAYOUT.scene.height;
  return canvas;
}

function sliceWindowPage(fullCanvas: HTMLCanvasElement, scrollY: number): HTMLCanvasElement {
  const pageCanvas = createBattlePageCanvas();
  const pageCtx = pageCanvas.getContext('2d');
  if (!pageCtx) {
    return pageCanvas;
  }

  pageCtx.imageSmoothingEnabled = false;
  pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
  pageCtx.drawImage(
    fullCanvas,
    0,
    scrollY,
    BATTLE_LAYOUT.scene.width,
    BATTLE_LAYOUT.scene.height,
    0,
    0,
    BATTLE_LAYOUT.scene.width,
    BATTLE_LAYOUT.scene.height,
  );
  return pageCanvas;
}

async function buildBattleWindowPages(): Promise<Record<BattleWindowPage, HTMLCanvasElement>> {
  const [
    textboxTiles,
    textboxMapBuffer,
    textboxPalette0,
    textboxPalette1,
  ] = await Promise.all([
    loadTilesetImage('/pokeemerald/graphics/battle_interface/textbox.png', true),
    loadBinaryAsset('/pokeemerald/graphics/battle_interface/textbox_map.bin'),
    loadTextAsset('/pokeemerald/graphics/battle_interface/textbox_0.pal'),
    loadTextAsset('/pokeemerald/graphics/battle_interface/textbox_1.pal'),
  ]);

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = BATTLE_BG0_CANVAS_WIDTH;
  fullCanvas.height = BATTLE_BG0_CANVAS_HEIGHT;
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) {
    return {
      message: createBattlePageCanvas(),
      action: createBattlePageCanvas(),
      move: createBattlePageCanvas(),
    };
  }

  const paletteBanks = [
    parsePalette(textboxPalette0).colors,
    parsePalette(textboxPalette1).colors,
  ];

  fullCtx.imageSmoothingEnabled = false;
  drawGbaBgTilemap(
    fullCtx,
    toIndexedTilesetSource(textboxTiles),
    decodeGbaBgTilemap(textboxMapBuffer),
    {
      mapWidthTiles: BATTLE_BG0_MAP_WIDTH_TILES,
      mapHeightTiles: BATTLE_BG0_MAP_HEIGHT_TILES,
      visibleWidthPx: BATTLE_BG0_CANVAS_WIDTH,
      visibleHeightPx: BATTLE_BG0_CANVAS_HEIGHT,
      layoutMode: 'screenblock',
      paletteBanks,
      transparentColorIndexZero: true,
    },
  );

  return {
    message: sliceWindowPage(fullCanvas, BATTLE_LAYOUT.uiPages.messageScrollY),
    action: sliceWindowPage(fullCanvas, BATTLE_LAYOUT.uiPages.actionScrollY),
    move: sliceWindowPage(fullCanvas, BATTLE_LAYOUT.uiPages.moveScrollY),
  };
}

function setBattleFont(
  ctx: CanvasRenderingContext2D,
  sizePx: number,
  weight: 'normal' | 'bold' = 'normal',
): void {
  ctx.font = `${weight} ${sizePx}px "Pokemon Emerald", monospace`;
}

function preloadBattleFonts(): Promise<void> {
  if (fontReadyPromise) {
    return fontReadyPromise;
  }

  fontReadyPromise = (async () => {
    if (typeof document === 'undefined' || !('fonts' in document)) {
      return;
    }

    try {
      await Promise.all([
        document.fonts.load('8px "Pokemon Emerald"'),
        document.fonts.load('9px "Pokemon Emerald"'),
        document.fonts.load('10px "Pokemon Emerald"'),
      ]);
    } catch (error) {
      console.warn('[BattleHealthBox] Failed to preload Pokemon Emerald font:', error);
    }
  })();

  return fontReadyPromise;
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
      const [
        enemyHealthbox,
        playerHealthbox,
        statusIcons,
        ballDisplay,
        windowPages,
      ] = await Promise.all([
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/healthbox_singles_opponent.png', {
          transparency: { type: 'top-left' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/healthbox_singles_player.png', {
          transparency: { type: 'top-left' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/status.png', {
          transparency: { type: 'none' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/ball_display.png', {
          transparency: { type: 'top-left' },
        }),
        buildBattleWindowPages(),
        preloadBattleFonts(),
      ]);

      assets = {
        enemyHealthbox,
        playerHealthbox,
        statusIcons,
        ballDisplay,
        windowPages,
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
  ctx.fillStyle = '#303030';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x + 4, y + 4, width - 8, height - 8);
}

function drawBattleWindowPage(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  page: BattleWindowPage,
): void {
  const pageCanvas = assets?.windowPages[page];
  if (pageCanvas) {
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pageCanvas, offsetX, offsetY);
    ctx.imageSmoothingEnabled = previousSmoothing;
    return;
  }

  drawTextboxBackdrop(
    ctx,
    offsetX + BATTLE_LAYOUT.scene.textboxX,
    offsetY + BATTLE_LAYOUT.scene.textboxY,
    BATTLE_LAYOUT.scene.textboxWidth,
    BATTLE_LAYOUT.scene.textboxHeight,
  );
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
  ctx.fillText(name, x + 8, y + 2);
  ctx.textAlign = 'right';
  ctx.fillText(`Lv${level}`, x + boxW - 8, y + 2);

  const hpPercent = maxHp > 0 ? clamp01(currentHp / maxHp) : 0;
  const barX = x + 37;
  const barY = y + 14;
  const barW = 48;
  const barH = 4;

  ctx.fillStyle = '#484848';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = getHpColor(hpPercent);
  ctx.fillRect(barX, barY, Math.floor(barW * hpPercent), barH);

  drawStatusIcon(ctx, x + 73, y + 16, status);
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
  ctx.fillText(name, x + 8, y + 2);
  ctx.textAlign = 'right';
  ctx.fillText(`Lv${level}`, x + boxW - 8, y + 2);

  const hpPercent = maxHp > 0 ? clamp01(currentHp / maxHp) : 0;
  const barX = x + 47;
  const barY = y + 14;
  const barW = 48;
  const barH = 4;

  ctx.fillStyle = '#484848';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = getHpColor(hpPercent);
  ctx.fillRect(barX, barY, Math.floor(barW * hpPercent), barH);

  ctx.fillStyle = '#383028';
  setBattleFont(ctx, 8);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.max(0, currentHp)}/${maxHp}`, x + boxW - 6, y + 21);

  const expBarX = x + 31;
  const expBarY = y + 31;
  const expBarW = 64;
  const expBarH = 4;
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
  visibleChars?: number,
): void {
  drawBattleWindowPage(ctx, offsetX, offsetY, 'message');

  const window = BATTLE_LAYOUT.windows.message;
  ctx.fillStyle = '#383838';
  setBattleFont(ctx, 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const clampedVisibleChars = visibleChars === undefined
    ? text.length
    : Math.max(0, Math.min(text.length, Math.trunc(visibleChars)));
  const visibleText = text.slice(0, clampedVisibleChars);

  const lines: string[] = [];
  const paragraphs = visibleText.split('\n');
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let currentLine = '';
    for (const word of words) {
      const nextLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
      if (ctx.measureText(nextLine).width > window.textWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = nextLine;
      }
      if (lines.length >= window.maxLines) break;
    }
    if (lines.length >= window.maxLines) break;
    if (currentLine.length > 0 || paragraph.length === 0) {
      lines.push(currentLine);
    }
    if (lines.length >= window.maxLines) break;
  }

  for (let i = 0; i < Math.min(lines.length, window.maxLines); i++) {
    ctx.fillText(
      lines[i] ?? '',
      offsetX + window.textX,
      offsetY + window.textY + (i * window.lineHeight),
    );
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
  drawBattleWindowPage(ctx, offsetX, offsetY, 'action');

  const promptWindow = BATTLE_LAYOUT.windows.actionPrompt;
  const actionWindow = BATTLE_LAYOUT.windows.actionMenu;
  const displayName = pokemonName.length > 10 ? `${pokemonName.slice(0, 10)}...` : pokemonName;
  ctx.fillStyle = '#383838';
  setBattleFont(ctx, 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('What will', offsetX + promptWindow.textX, offsetY + promptWindow.textY);
  ctx.fillText(
    `${displayName} do?`,
    offsetX + promptWindow.textX,
    offsetY + promptWindow.textY + promptWindow.lineHeight,
  );

  const actions = ['FIGHT', 'BAG', 'POKeMON', 'RUN'];
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = col === 0 ? actionWindow.leftColumnX : actionWindow.rightColumnX;
    const by = row === 0 ? actionWindow.topRowY : actionWindow.bottomRowY;
    const isSelected = i === selectedIndex;
    const disabled = firstBattle && i !== 0;

    if (isSelected) {
      ctx.fillStyle = '#383838';
      ctx.fillText('▶', offsetX + bx - actionWindow.cursorOffsetX, offsetY + by);
    }

    ctx.fillStyle = disabled ? '#989898' : '#383838';
    setBattleFont(ctx, 9);
    ctx.fillText(actions[i] ?? '', offsetX + bx, offsetY + by);
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
  drawBattleWindowPage(ctx, offsetX, offsetY, 'move');

  setBattleFont(ctx, 9);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const moveWindows = [
    BATTLE_LAYOUT.windows.moveName1,
    BATTLE_LAYOUT.windows.moveName2,
    BATTLE_LAYOUT.windows.moveName3,
    BATTLE_LAYOUT.windows.moveName4,
  ];

  for (let i = 0; i < 4; i++) {
    const window = moveWindows[i];
    if (!window) continue;
    const mx = offsetX + window.textX;
    const my = offsetY + window.textY;

    if (i < moves.length) {
      const move = moves[i];
      const isSelected = i === selectedIndex;

      if (isSelected) {
        ctx.fillStyle = '#383838';
        ctx.fillText('▶', mx - 8, my);
      }

      ctx.fillStyle = '#383838';
      ctx.fillText(move?.name ?? '-', mx, my);
    } else {
      ctx.fillStyle = '#a0a0a0';
      ctx.fillText('-', mx, my);
    }
  }

  if (selectedIndex < moves.length) {
    const move = moves[selectedIndex];
    const ppLabel = BATTLE_LAYOUT.windows.movePpLabel;
    const ppValue = BATTLE_LAYOUT.windows.movePpValue;
    const moveType = BATTLE_LAYOUT.windows.moveType;

    ctx.fillStyle = '#383838';
    setBattleFont(ctx, 9);
    ctx.fillText('PP', offsetX + ppLabel.textX, offsetY + ppLabel.textY);
    ctx.fillText(`${move?.pp ?? 0}/${move?.maxPp ?? 0}`, offsetX + ppValue.textX, offsetY + ppValue.textY);

    setBattleFont(ctx, 8);
    ctx.fillText(`TYPE/${move?.type ?? 'NORMAL'}`, offsetX + moveType.textX, offsetY + moveType.textY);
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

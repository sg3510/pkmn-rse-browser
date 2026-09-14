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
import { wrapPromptParagraphs } from '../../core/prompt/textLayout';
import { BATTLE_LAYOUT } from './BattleLayout';
import { drawGbaText, measureGbaText, preloadGbaFonts } from '../../rendering/GbaFont';

interface BattleInterfaceAssets {
  enemyHealthbox: HTMLCanvasElement;
  playerHealthbox: HTMLCanvasElement;
  statusIcons: HTMLCanvasElement;
  hpBar: HTMLCanvasElement;
  expBar: HTMLCanvasElement;
  ballDisplay: HTMLCanvasElement;
  windowPages: Record<BattleWindowPage, HTMLCanvasElement>;
}

export type PartyBallState = 'healthy' | 'status' | 'fainted' | 'empty';
export type BattleWindowPage = 'message' | 'action' | 'move';

let assets: BattleInterfaceAssets | null = null;
let assetsPromise: Promise<void> | null = null;


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
        hpBar,
        expBar,
        ballDisplay,
        windowPages,
      ] = await Promise.all([
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/healthbox_singles_opponent.png', {
          transparency: { type: 'indexed-zero' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/healthbox_singles_player.png', {
          transparency: { type: 'indexed-zero' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/status.png', {
          transparency: { type: 'none' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/hpbar.png', {
          transparency: { type: 'indexed-zero' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/expbar.png', {
          transparency: { type: 'indexed-zero' },
        }),
        loadImageCanvasAsset('/pokeemerald/graphics/battle_interface/ball_display.png', {
          transparency: { type: 'indexed-zero' },
        }),
        buildBattleWindowPages(),
        preloadGbaFonts(),
      ]);

      assets = {
        enemyHealthbox,
        playerHealthbox,
        statusIcons,
        hpBar,
        expBar,
        ballDisplay,
        windowPages,
      };
    } catch (error) {
      console.warn('[BattleHealthBox] Failed to preload interface assets:', error);
    }
  })();

  return assetsPromise;
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
  drawGbaText(ctx, labels[row] ?? '', x, y, { font: 'small' });
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

export function drawBattleWindowPageChrome(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  page: BattleWindowPage,
): void {
  const pageCanvas = assets?.windowPages[page];
  if (pageCanvas) {
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    // BG0 color zero exposes the GBA backdrop, never the battlefield behind a menu corner.
    ctx.fillStyle = '#4a4152';
    ctx.fillRect(offsetX, offsetY + 112, 240, 48);
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

/** Six 8-pixel HP tiles, with the original label, white rails, and two-tone fill. */
function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, maxHp: number, showLabel = true): void {
  if (!assets) return;
  const pixels = getHpBarPixels(hp, maxHp);
  if (showLabel) ctx.drawImage(assets.hpBar, 8, 0, 16, 8, x, y, 16, 8);
  for (let tile = 0; tile < 6; tile++) {
    ctx.drawImage(assets.hpBar, 24, 0, 8, 8, x + 16 + tile * 8, y, 8, 8);
  }
  // Rectangles reproduce the two ink rows; rails and rounded caps remain intact.
  const colors = pixels > 24 ? ['#5ad583', '#73ffac']
    : pixels > 9 ? ['#cdac08', '#ffe639'] : ['#ac414a', '#ff5a39'];
  for (let row = 0; row < 2; row++) {
    ctx.fillStyle = colors[row];
    ctx.fillRect(x + 16, y + 3 + row, pixels, 1);
  }
}

export function getHpBarPixels(hp: number, maxHp: number): number {
  if (hp <= 0 || maxHp <= 0) return 0;
  return Math.max(1, Math.floor(48 * clamp01(hp / maxHp)));
}

function drawHealthboxHeading(
  ctx: CanvasRenderingContext2D, x: number, y: number, name: string, level: number, gender: string,
): void {
  const levelText = `⒧${level}`;
  const nameWidth = 80 - measureGbaText(levelText, 'small') - 1;
  // Nidoran's default species name already contains its gender glyph.
  const symbol = name.endsWith('♂') || name.endsWith('♀') ? '' : gender;
  let displayName = name;
  while (measureGbaText(displayName + symbol, 'small') > nameWidth && displayName.length > 0) {
    displayName = displayName.slice(0, -1);
  }
  drawGbaText(ctx, displayName, x, y, { font: 'small', shadow: '#ded5b4' });
  drawGbaText(ctx, symbol, x + measureGbaText(displayName, 'small'), y, {
    font: 'small', color: symbol === '♀' ? '#f69c7b' : '#5aace6', shadow: '#ded5b4',
  });
  drawGbaText(ctx, levelText, x + 80, y, { font: 'small', align: 'right', shadow: '#ded5b4' });
}

/** Draw the enemy's health box (single battle). Coordinates include the full shadow. */
export function drawEnemyHealthBox(
  ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number,
  name: string, level: number, currentHp: number, maxHp: number,
  status: number = STATUS.NONE, gender = '',
): void {
  const x = offsetX + BATTLE_LAYOUT.enemy.healthboxX;
  const y = offsetY + BATTLE_LAYOUT.enemy.healthboxY;
  if (assets) ctx.drawImage(assets.enemyHealthbox, x, y);
  drawHealthboxHeading(ctx, x + 8, y + 3, name, level, gender);
  drawHpBar(ctx, x + 24, y + 16, currentHp, maxHp, statusRowFromStatus(status) === null);
  drawStatusIcon(ctx, x + 8, y + 16, status);
}

/** Draw the player's health box (single battle). */
export function drawPlayerHealthBox(
  ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number,
  name: string, level: number, currentHp: number, maxHp: number,
  expPercent = 0, status: number = STATUS.NONE, gender = '',
): void {
  const x = offsetX + BATTLE_LAYOUT.player.healthboxX;
  const y = offsetY + BATTLE_LAYOUT.player.healthboxY;
  if (assets) ctx.drawImage(assets.playerHealthbox, x, y);
  drawHealthboxHeading(ctx, x + 16, y + 3, name, level, gender);
  drawHpBar(ctx, x + 32, y + 16, currentHp, maxHp);
  drawGbaText(ctx, `${Math.max(0, Math.round(currentHp))}/${maxHp}`, x + 96, y + 21,
    { font: 'small', align: 'right', shadow: '#ded5b4' });
  const expPixels = level >= 100 ? 0 : Math.floor(clamp01(expPercent) * 64);
  if (assets) {
    for (let tile = 0; tile < 8; tile++) {
      const fill = Math.max(0, Math.min(8, expPixels - tile * 8));
      ctx.drawImage(assets.expBar, fill * 8, 0, 8, 8, x + 32 + tile * 8, y + 32, 8, 8);
    }
  }
  drawStatusIcon(ctx, x + 16, y + 24, status);
}

/** Draw the battle message text box. */
export function drawTextBox(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  text: string,
  visibleChars?: number,
): void {
  drawBattleWindowPageChrome(ctx, offsetX, offsetY, 'message');

  const window = BATTLE_LAYOUT.windows.message;

  const clampedVisibleChars = visibleChars === undefined
    ? text.length
    : Math.max(0, Math.min(text.length, Math.trunc(visibleChars)));
  const visibleText = text.slice(0, clampedVisibleChars);

  const lines = wrapPromptParagraphs(
    visibleText,
    {
      maxWidth: window.textWidth,
      measureText: (value) => measureGbaText(value),
    },
    window.maxLines,
  );

  for (let i = 0; i < Math.min(lines.length, window.maxLines); i++) {
    drawGbaText(ctx,
      lines[i] ?? '',
      offsetX + window.textX,
      offsetY + window.textY + (i * window.lineHeight),
      { color: '#ffffff', shadow: '#6a5a73' },
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
  drawBattleWindowPageChrome(ctx, offsetX, offsetY, 'action');

  const promptWindow = BATTLE_LAYOUT.windows.actionPrompt;
  const actionWindow = BATTLE_LAYOUT.windows.actionMenu;
  const displayName = pokemonName.length > 10 ? `${pokemonName.slice(0, 10)}...` : pokemonName;
  const promptStyle = { color: '#ffffff', shadow: '#6a5a73' };
  drawGbaText(ctx, 'What will', offsetX + promptWindow.textX, offsetY + promptWindow.textY, promptStyle);
  drawGbaText(ctx,
    `${displayName} do?`,
    offsetX + promptWindow.textX,
    offsetY + promptWindow.textY + promptWindow.lineHeight,
    promptStyle,
  );

  const actions = ['FIGHT', 'BAG', 'POKéMON', 'RUN'];
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = col === 0 ? actionWindow.leftColumnX : actionWindow.rightColumnX;
    const by = row === 0 ? actionWindow.topRowY : actionWindow.bottomRowY;
    const isSelected = i === selectedIndex;
    const disabled = firstBattle && i !== 0;

    if (isSelected) {
      drawGbaText(ctx, '▶', offsetX + bx - actionWindow.cursorOffsetX, offsetY + by);
    }

    drawGbaText(ctx, actions[i] ?? '', offsetX + bx, offsetY + by,
      { color: disabled ? '#989898' : '#414141' });
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
  drawBattleWindowPageChrome(ctx, offsetX, offsetY, 'move');


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
        drawGbaText(ctx, '▶', mx - 8, my);
      }

      drawGbaText(ctx, move?.name ?? '-', mx, my, { font: 'narrow' });
    } else {
      drawGbaText(ctx, '-', mx, my, { color: '#a0a0a0' });
    }
  }

  if (selectedIndex < moves.length) {
    const move = moves[selectedIndex];
    const ppLabel = BATTLE_LAYOUT.windows.movePpLabel;
    const ppValue = BATTLE_LAYOUT.windows.movePpValue;
    const moveType = BATTLE_LAYOUT.windows.moveType;

    drawGbaText(ctx, 'PP', offsetX + ppLabel.textX, offsetY + ppLabel.textY, { font: 'narrow' });
    drawGbaText(ctx, `${move?.pp ?? 0}/${move?.maxPp ?? 0}`, offsetX + ppValue.textX, offsetY + ppValue.textY);
    drawGbaText(ctx, `TYPE/${move?.type ?? 'NORMAL'}`, offsetX + moveType.textX, offsetY + moveType.textY, { font: 'narrow' });
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

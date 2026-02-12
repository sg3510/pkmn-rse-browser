/**
 * New-game Birch intro state.
 *
 * C references:
 * - public/pokeemerald/src/main_menu.c (Task_NewGameBirchSpeech_*)
 * - public/pokeemerald/src/field_effect.c (AddNewGameBirchObject)
 * - public/pokeemerald/data/text/birch_speech.inc
 */

import {
  GameState,
  type InputState,
  type RenderContext,
  type StateRenderer,
  type StateTransition,
} from '../core/GameState';
import type { ViewportConfig } from '../config/viewport';
import type { LocationState } from '../save/types';
import { saveManager } from '../save/SaveManager';
import { initializeNewGameStoryState } from '../game/NewGameFlow';
import { getDialogBridge, type DialogBridgeApi } from '../components/dialog/DialogBridge';
import { BIRCH_SCENE_WIDTH, BIRCH_SCENE_HEIGHT, getBirchSceneFit, drawSceneWithEdgeExtension } from './birchSceneLayout';
import { loadImageCanvasAsset, loadUint16LEAsset } from '../utils/assetLoader';

type BirchPhase = 'birchIntro' | 'pokemonIntro' | 'gender' | 'name' | 'confirm';

const BG_TILEMAP_WIDTH = 32;
const BG_TILEMAP_HEIGHT = 20;
const BG_TILE_SIZE = 8;
const MAX_PLAYER_NAME_LENGTH = 7;

const BIRCH_INTRO_MESSAGES = [
  'Hi! Sorry to keep you waiting!',
  'Welcome to the world of POKeMON!',
  'My name is BIRCH.',
  'But everyone calls me the POKeMON PROFESSOR.',
];

const BIRCH_POKEMON_MESSAGES = [
  'This is what we call a "POKeMON."',
  'This world is widely inhabited by creatures known as POKeMON.',
  "To unravel POKeMON mysteries, I've been undertaking research.",
];

function createInitialLocationState(): LocationState {
  return {
    pos: { x: 2, y: 2 },
    location: { mapId: 'MAP_INSIDE_OF_TRUCK', warpId: 0, x: 2, y: 2 },
    continueGameWarp: { mapId: 'MAP_INSIDE_OF_TRUCK', warpId: 0, x: 2, y: 2 },
    lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
    escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
    direction: 'down',
    elevation: 3,
    isSurfing: false,
    isUnderwater: false,
  };
}

export class BirchSpeechState implements StateRenderer {
  readonly id = GameState.NEW_GAME_BIRCH;

  private phase: BirchPhase = 'birchIntro';
  private selectedGender: 0 | 1 = 0;
  private playerName = 'BRENDAN';

  private pendingTransition: StateTransition | null = null;
  private exiting = false;
  private flowStarted = false;

  private assetsLoaded = false;
  private birchSprite: HTMLCanvasElement | null = null;
  private shadowTileset: HTMLCanvasElement | null = null;
  private lotadSprite: HTMLCanvasElement | null = null;
  private brendanSprite: HTMLCanvasElement | null = null;
  private maySprite: HTMLCanvasElement | null = null;
  private bgMapEntries: Uint16Array | null = null;
  private sceneCanvas: HTMLCanvasElement | null = null;
  private sceneCtx: CanvasRenderingContext2D | null = null;

  async enter(viewport: ViewportConfig): Promise<void> {
    void viewport;
    this.pendingTransition = null;
    this.exiting = false;
    this.flowStarted = false;
    this.phase = 'birchIntro';

    const profile = saveManager.getProfile();
    this.selectedGender = profile.gender;
    this.playerName = profile.gender === 1 ? 'MAY' : 'BRENDAN';

    await this.loadAssets();
    this.flowStarted = true;
    void this.runIntroFlow();
  }

  async exit(): Promise<void> {
    this.exiting = true;
    getDialogBridge()?.close();
  }

  update(dt: number, frameCount: number): void {
    void dt;
    void frameCount;
  }

  handleInput(input: InputState): StateTransition | null {
    if (this.pendingTransition) {
      const transition = this.pendingTransition;
      this.pendingTransition = null;
      return transition;
    }

    const cancelPressed = input.pressed.has('Escape') || input.pressed.has('KeyX');
    const dialogOpen = getDialogBridge()?.isOpen() ?? false;

    if (cancelPressed && !dialogOpen) {
      this.exiting = true;
      return { to: GameState.MAIN_MENU };
    }

    return null;
  }

  render(context: RenderContext): void {
    const { ctx2d, viewport } = context;
    const { width, height } = viewport;

    this.ensureSceneCanvas();
    if (!this.sceneCanvas || !this.sceneCtx) {
      return;
    }

    this.renderGbaScene(this.sceneCtx);

    ctx2d.imageSmoothingEnabled = false;

    // Edge-extend the scene to fill the entire viewport — no black bars.
    // The outermost pixel rows/columns stretch to cover any aspect-ratio
    // mismatch, similar to GL_CLAMP_TO_EDGE.
    const sceneFit = getBirchSceneFit(width, height);
    drawSceneWithEdgeExtension(ctx2d, this.sceneCanvas, width, height, sceneFit);
  }

  private ensureSceneCanvas(): void {
    if (!this.sceneCanvas) {
      this.sceneCanvas = document.createElement('canvas');
      this.sceneCanvas.width = BIRCH_SCENE_WIDTH;
      this.sceneCanvas.height = BIRCH_SCENE_HEIGHT;
      this.sceneCtx = this.sceneCanvas.getContext('2d');
    }
  }

  private renderGbaScene(ctx2d: CanvasRenderingContext2D): void {
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.fillStyle = '#000000';
    ctx2d.fillRect(0, 0, BIRCH_SCENE_WIDTH, BIRCH_SCENE_HEIGHT);

    this.drawBirchBackground(ctx2d);
    this.drawCharacterLayer(ctx2d);
  }

  private drawBirchBackground(ctx2d: CanvasRenderingContext2D): void {
    if (!this.shadowTileset || !this.bgMapEntries) return;

    const sourceTileCols = Math.floor(this.shadowTileset.width / BG_TILE_SIZE);
    const sourceTileRows = Math.floor(this.shadowTileset.height / BG_TILE_SIZE);
    const sourceTileCount = sourceTileCols * sourceTileRows;

    for (let tileY = 0; tileY < BG_TILEMAP_HEIGHT; tileY++) {
      for (let tileX = 0; tileX < BG_TILEMAP_WIDTH; tileX++) {
        const entry = this.bgMapEntries[tileY * BG_TILEMAP_WIDTH + tileX];
        const tileId = entry & 0x03ff;
        if (tileId === 0 || tileId >= sourceTileCount) continue;

        const hFlip = (entry & 0x0400) !== 0;
        const vFlip = (entry & 0x0800) !== 0;
        const srcX = (tileId % sourceTileCols) * BG_TILE_SIZE;
        const srcY = Math.floor(tileId / sourceTileCols) * BG_TILE_SIZE;
        const destX = tileX * BG_TILE_SIZE;
        const destY = tileY * BG_TILE_SIZE;

        if (!hFlip && !vFlip) {
          ctx2d.drawImage(this.shadowTileset, srcX, srcY, BG_TILE_SIZE, BG_TILE_SIZE, destX, destY, BG_TILE_SIZE, BG_TILE_SIZE);
          continue;
        }

        ctx2d.save();
        ctx2d.translate(destX + (hFlip ? BG_TILE_SIZE : 0), destY + (vFlip ? BG_TILE_SIZE : 0));
        ctx2d.scale(hFlip ? -1 : 1, vFlip ? -1 : 1);
        ctx2d.drawImage(this.shadowTileset, srcX, srcY, BG_TILE_SIZE, BG_TILE_SIZE, 0, 0, BG_TILE_SIZE, BG_TILE_SIZE);
        ctx2d.restore();
      }
    }
  }

  private drawCharacterLayer(ctx2d: CanvasRenderingContext2D): void {
    if (this.phase === 'gender' || this.phase === 'name' || this.phase === 'confirm') {
      const trainerSprite = this.selectedGender === 1 ? this.maySprite : this.brendanSprite;
      this.drawSpriteCentered(ctx2d, trainerSprite, 180, 60);
      return;
    }

    this.drawSpriteCentered(ctx2d, this.birchSprite, 136, 60);

    if (this.phase === 'pokemonIntro') {
      this.drawSpriteCentered(ctx2d, this.lotadSprite, 100, 75);
    }
  }

  private drawSpriteCentered(
    ctx2d: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement | HTMLImageElement | null,
    centerX: number,
    centerY: number
  ): void {
    if (!sprite) return;

    const frameWidth = 64;
    const frameHeight = 64;
    const drawX = Math.floor(centerX - frameWidth / 2);
    const drawY = Math.floor(centerY - frameHeight / 2);
    ctx2d.drawImage(sprite, 0, 0, frameWidth, frameHeight, drawX, drawY, frameWidth, frameHeight);
  }

  private async runIntroFlow(): Promise<void> {
    const dialog = await this.waitForDialogBridge();
    if (!dialog || this.exiting || !this.flowStarted) return;

    this.phase = 'birchIntro';
    for (const message of BIRCH_INTRO_MESSAGES) {
      if (this.exiting) return;
      await dialog.showMessage(message);
    }

    this.phase = 'pokemonIntro';
    for (const message of BIRCH_POKEMON_MESSAGES) {
      if (this.exiting) return;
      await dialog.showMessage(message);
    }

    let confirmedName = false;
    while (!confirmedName && !this.exiting) {
      this.phase = 'gender';
      const gender = await dialog.showChoice(
        'Are you a boy?\nOr are you a girl?',
        [
          { label: 'BOY', value: 0 as const },
          { label: 'GIRL', value: 1 as const },
        ],
        {
          cancelable: false,
          defaultIndex: this.selectedGender === 0 ? 0 : 1,
          // GBA-like upper-left menu placement for the gender prompt.
          menuPosition: { leftRatio: 0.08, topRatio: 0.22 },
          onSelectionChange: (index) => {
            this.selectedGender = index as 0 | 1;
          },
        }
      );
      if (gender === null || this.exiting) return;

      this.selectedGender = gender;
      if (!this.playerName || this.playerName === 'BRENDAN' || this.playerName === 'MAY') {
        this.playerName = this.selectedGender === 1 ? 'MAY' : 'BRENDAN';
      }

      this.phase = 'name';
      await dialog.showMessage("All right.\nWhat's your name?");
      if (this.exiting) return;
      const enteredName = await dialog.showTextEntry("Enter name:", {
        initialValue: this.playerName,
        maxLength: MAX_PLAYER_NAME_LENGTH,
        allowEmpty: false,
        cancelable: false,
        mapKey: (event) => {
          const letterMatch = event.code.match(/^Key([A-Z])$/);
          return letterMatch ? letterMatch[1] : null;
        },
        normalize: (value) => value.trim().toUpperCase().slice(0, MAX_PLAYER_NAME_LENGTH),
      });
      if (enteredName == null || this.exiting) return;
      this.playerName = enteredName;

      this.phase = 'confirm';
      const accepted = await dialog.showChoice(
        `So it's ${this.playerName}?`,
        [
          { label: 'YES', value: true },
          { label: 'NO', value: false },
        ],
        { cancelable: false, defaultIndex: 0 }
      );
      confirmedName = accepted === true;
    }

    if (this.exiting) return;

    await dialog.showMessage(`Ah, okay!\nYou're ${this.playerName}.`);
    await dialog.showMessage(
      'All right, are you ready?\nYour very own adventure is about to unfold.'
    );

    if (this.exiting) return;
    const trimmedName = this.playerName.trim().toUpperCase().slice(0, MAX_PLAYER_NAME_LENGTH)
      || (this.selectedGender === 1 ? 'MAY' : 'BRENDAN');

    saveManager.setProfile({ name: trimmedName, gender: this.selectedGender });
    initializeNewGameStoryState();

    this.pendingTransition = {
      to: GameState.OVERWORLD,
      data: {
        fromNewGame: true,
        savedLocation: createInitialLocationState(),
      },
    };
  }

  private async waitForDialogBridge(): Promise<DialogBridgeApi | null> {
    for (let i = 0; i < 180; i++) {
      const dialog = getDialogBridge();
      if (dialog) return dialog;
      await new Promise<void>((resolve) => setTimeout(resolve, 16));
      if (this.exiting) return null;
    }
    return null;
  }

  private async loadAssets(): Promise<void> {
    if (this.assetsLoaded) return;

    const results = await Promise.allSettled([
      loadImageCanvasAsset('/pokeemerald/graphics/birch_speech/birch.png'),
      loadImageCanvasAsset('/pokeemerald/graphics/birch_speech/shadow.png', {
        transparency: { type: 'top-left' },
      }),
      loadImageCanvasAsset('/pokeemerald/graphics/pokemon/lotad/front.png'),
      loadImageCanvasAsset('/pokeemerald/graphics/trainers/front_pics/brendan.png'),
      loadImageCanvasAsset('/pokeemerald/graphics/trainers/front_pics/may.png'),
      loadUint16LEAsset('/pokeemerald/graphics/birch_speech/map.bin'),
    ] as const);

    if (results[0].status === 'fulfilled') this.birchSprite = results[0].value;
    if (results[1].status === 'fulfilled') this.shadowTileset = results[1].value;
    if (results[2].status === 'fulfilled') this.lotadSprite = results[2].value;
    if (results[3].status === 'fulfilled') this.brendanSprite = results[3].value;
    if (results[4].status === 'fulfilled') this.maySprite = results[4].value;
    if (results[5].status === 'fulfilled') this.bgMapEntries = results[5].value;

    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length > 0) {
      console.warn('[BirchSpeechState] Some Birch intro assets failed to load:', failed);
    }

    this.assetsLoaded = true;
  }
}

export function createBirchSpeechState(): StateRenderer {
  return new BirchSpeechState();
}

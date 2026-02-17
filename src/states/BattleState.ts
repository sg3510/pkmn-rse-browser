/**
 * Battle state with WebGL rendering and real type effectiveness.
 *
 * C references:
 * - public/pokeemerald/src/battle_setup.c (BattleSetup_StartWildBattle)
 * - public/pokeemerald/src/battle_main.c
 * - public/pokeemerald/src/pokemon.c (CalculateBaseDamage)
 */

import {
  GameState,
  type InputState,
  type RenderContext,
  type StateRenderer,
  type StateTransition,
} from '../core/GameState';
import { inputMap, GameButton } from '../core/InputMap';
import type { ViewportConfig } from '../config/viewport';
import type { LocationState } from '../save/types';
import { saveManager } from '../save/SaveManager';
import { gameFlags } from '../game/GameFlags';
import { gameVariables, GAME_VARS } from '../game/GameVariables';
import { bagManager } from '../game/BagManager';
import { SPECIES, getSpeciesName } from '../data/species';
import { ITEMS, getItemName } from '../data/items';
import { getMoveInfo, getMoveName, MOVES } from '../data/moves';
import { getSpeciesInfo } from '../data/speciesInfo';
import { calculateLevelFromExp, getAbility, getExpForLevel, recalculatePartyStats } from '../pokemon/stats';
import { createTestPokemon } from '../pokemon/testFactory';
import { STATUS, type PartyPokemon } from '../pokemon/types';
import type { SpriteInstance } from '../rendering/types';
import { BattleEngine } from '../battle/engine/BattleEngine';
import {
  createDefaultStages,
  createDefaultVolatile,
  type BattleAction,
  type BattleEvent,
  type BattlePokemon,
  type BattleOutcome,
} from '../battle/engine/types';
import { B_OUTCOME } from '../data/battleConstants.gen';
import { getDialogBridge } from '../components/dialog/DialogBridge';
import { menuStateManager } from '../menu';
import type { ObjectEventRuntimeState } from '../types/objectEvents';
import {
  clearBattleStatusMask,
  getBattleHealAmount,
  getBattleStatusCureMask,
  isBattlePokeBallItem,
} from '../battle/items/battleItemRules';

// WebGL rendering
import { BattleWebGLContext, BATTLE_WIDTH, BATTLE_HEIGHT } from '../battle/render/BattleWebGLContext';
import {
  loadPokemonBattleSprites,
  loadBattleIntroSprites,
  loadBattleMiscSprites,
  createFrontSprite,
  createBackSprite,
  getPokemonBattleFrontFrameCount,
  getPokemonBattleBackFrameCount,
  createEnemyShadowSprite,
  createTrainerBackSprite,
  createPokeballSprite,
} from '../battle/render/BattleSpriteLoader';
import {
  loadBattleBackground,
  createBackgroundSprite,
  type BattleTerrain,
  type BattleBackgroundProfile,
} from '../battle/render/BattleBackground';
import type { PokemonSpriteCoords } from '../data/pokemonSpriteCoords.gen';

// Health box rendering (ctx2d overlay)
import {
  preloadBattleInterfaceAssets,
  drawEnemyHealthBox,
  drawPlayerHealthBox,
  drawTextBox,
  drawActionMenu,
  drawMoveMenu,
} from '../battle/render/BattleHealthBox';

type BattlePhase = 'message' | 'action' | 'move' | 'finished';
const HP_ANIMATION_RATE = 96; // HP units per second
const EXP_ANIMATION_RATE = 0.9; // fraction of bar per second
const ENEMY_INTRO_MS = 280;
const INTRO_FRAME_MS = 1000 / 60;
const TRAINER_THROW_TRANSLATE_FRAMES = 50;
const TRAINER_SEND_OUT_DELAY_FRAMES = 31;
const BALL_SEND_OUT_TASK_SETUP_FRAMES = 1;
const BALL_ARC_FRAMES = 25;
const BALL_OPEN_FRAMES = 10;
const MON_EMERGE_FRAMES = 12;
const MON_SPRITE_ANIM_FRAME_MS = 140;
const TRAINER_THROW_START_X = 80;
const TRAINER_THROW_END_X = -40;
const TRAINER_THROW_Y = 80;
const BALL_START_X = 24;
const BALL_START_Y = 68;
const BALL_ARC_AMPLITUDE = -30;
const MOVE_FLASH_MS = 120;
const BATTLE_FADE_MS = 220;

const TRAINER_THROW_FRAMES: ReadonlyArray<{ frame: number; duration: number }> = [
  { frame: 0, duration: 24 },
  { frame: 1, duration: 9 },
  { frame: 2, duration: 24 },
  { frame: 0, duration: 9 },
  { frame: 3, duration: 50 },
];

interface MoveAnimationSequence {
  flashDurationMs: number;
  flashColor: string;
}

const DEFAULT_MOVE_ANIMATION: MoveAnimationSequence = {
  flashDurationMs: MOVE_FLASH_MS,
  flashColor: '255, 255, 255',
};

const MOVE_ANIMATIONS = new Map<number, MoveAnimationSequence>([
  [MOVES.EMBER, { flashDurationMs: 140, flashColor: '255, 140, 96' }],
  [MOVES.WATER_GUN, { flashDurationMs: 140, flashColor: '112, 176, 255' }],
  [MOVES.THUNDER_SHOCK, { flashDurationMs: 130, flashColor: '255, 236, 112' }],
  [MOVES.VINE_WHIP, { flashDurationMs: 125, flashColor: '144, 220, 112' }],
  [MOVES.TACKLE, { flashDurationMs: 100, flashColor: '255, 255, 255' }],
  [MOVES.POUND, { flashDurationMs: 100, flashColor: '255, 255, 255' }],
]);

interface BattleStateData {
  playerPokemon?: PartyPokemon;
  wildSpecies?: number;
  wildLevel?: number;
  wildHeldItem?: number;
  terrain?: BattleTerrain;
  backgroundProfile?: BattleBackgroundProfile;
  battleType?: 'wild' | 'trainer';
  returnLocation?: LocationState;
  returnObjectEventRuntimeState?: ObjectEventRuntimeState;
  firstBattle?: boolean;
}

interface StatIndicator {
  battler: 0 | 1;
  text: string;
  ttlMs: number;
}

interface PlayerSendOutVisualState {
  showTrainer: boolean;
  trainerFrame: number;
  trainerX: number;
  trainerY: number;
  showBall: boolean;
  ballFrame: number;
  ballX: number;
  ballY: number;
  showPokemon: boolean;
  pokemonScale: number;
  pokemonYOffset: number;
}

export class BattleState implements StateRenderer {
  readonly id = GameState.BATTLE;

  private phase: BattlePhase = 'message';
  private messageQueue: string[] = [];
  private onMessagesFinished: (() => void) | null = null;

  private actionIndex = 0;
  private moveIndex = 0;

  private engine: BattleEngine | null = null;
  private playerMon: BattlePokemon | null = null;
  private enemyMon: BattlePokemon | null = null;
  private displayedPlayerHp = 0;
  private displayedEnemyHp = 0;
  private displayedPlayerExpPercent = 0;
  private displayedPlayerExpLevel = 1;
  private introElapsedMs = 0;
  private spriteAnimationElapsedMs = 0;
  private playerSendOutElapsedMs = 0;
  private playerSendOutStarted = false;
  private moveFlashMs = 0;
  private moveFlashColor = DEFAULT_MOVE_ANIMATION.flashColor;
  private playerDamageFlashMs = 0;
  private enemyDamageFlashMs = 0;
  private playerFaintProgress = 0;
  private enemyFaintProgress = 0;
  private statIndicators: StatIndicator[] = [];
  private fadeState: 'none' | 'in' | 'out' = 'none';
  private fadeAlpha = 0;
  private transitionReady = false;
  private returnLocation: LocationState | null = null;
  private returnObjectEventRuntimeState: ObjectEventRuntimeState | null = null;
  private firstBattle = false;
  private battleType: 'wild' | 'trainer' = 'wild';
  private playerPartyIndex = 0;
  private playerGender: 0 | 1 = 0;
  private waitingForBattleMenu = false;
  private usingSharedDialogMessages = false;

  private pendingTransition: StateTransition | null = null;

  // WebGL rendering
  private webgl: BattleWebGLContext | null = null;
  private playerSpriteCoords: PokemonSpriteCoords | undefined;
  private enemySpriteCoords: PokemonSpriteCoords | undefined;

  async enter(_viewport: ViewportConfig, data?: Record<string, unknown>): Promise<void> {
    const typedData = (data ?? {}) as BattleStateData;
    this.returnLocation = typedData.returnLocation ?? null;
    this.returnObjectEventRuntimeState = typedData.returnObjectEventRuntimeState ?? null;
    this.firstBattle = typedData.firstBattle === true;
    this.battleType = typedData.battleType ?? 'wild';
    this.pendingTransition = null;
    this.transitionReady = false;
    this.waitingForBattleMenu = false;
    this.usingSharedDialogMessages = false;
    gameVariables.setVar(GAME_VARS.VAR_RESULT, 0);

    const playerFromData = typedData.playerPokemon;
    const party = saveManager.getParty();
    const playerFromSave = party.find((mon): mon is PartyPokemon => mon !== null) ?? null;
    const playerPokemon = playerFromData ?? playerFromSave;
    if (!playerPokemon) {
      throw new Error('BattleState requires a player Pokemon.');
    }
    const playerIndex = party.findIndex((mon) => (
      mon !== null
      && mon.personality === playerPokemon.personality
      && mon.otId === playerPokemon.otId
    ));
    this.playerPartyIndex = playerIndex >= 0 ? playerIndex : 0;
    this.playerGender = saveManager.getProfile().gender;

    if (
      typedData.wildSpecies !== undefined
      && (!Number.isFinite(typedData.wildSpecies) || typedData.wildSpecies <= 0)
    ) {
      console.warn('[BattleState] Invalid wildSpecies payload, falling back to SPECIES.POOCHYENA:', {
        wildSpecies: typedData.wildSpecies,
        battleType: typedData.battleType,
        payload: typedData,
      });
    }
    if (
      typedData.wildLevel !== undefined
      && (!Number.isFinite(typedData.wildLevel) || typedData.wildLevel <= 0)
    ) {
      console.warn('[BattleState] Invalid wildLevel payload, falling back to level 2:', {
        wildLevel: typedData.wildLevel,
        battleType: typedData.battleType,
        payload: typedData,
      });
    }

    const wildSpecies = (
      Number.isFinite(typedData.wildSpecies)
      && (typedData.wildSpecies as number) > 0
    )
      ? Math.trunc(typedData.wildSpecies as number)
      : SPECIES.POOCHYENA;
    const wildLevel = (
      Number.isFinite(typedData.wildLevel)
      && (typedData.wildLevel as number) > 0
    )
      ? Math.trunc(typedData.wildLevel as number)
      : 2;
    const backgroundProfile: BattleBackgroundProfile = typedData.backgroundProfile ?? {
      terrain: typedData.terrain ?? 'tall_grass',
      variant: 'default',
    };
    const wildPokemon = createTestPokemon({
      species: wildSpecies,
      level: wildLevel,
      heldItem: Number.isFinite(typedData.wildHeldItem)
        ? Math.max(0, Math.trunc(typedData.wildHeldItem as number))
        : 0,
      moves: [MOVES.TACKLE, 0, 0, 0],
    });

    this.engine = new BattleEngine({
      config: {
        type: this.battleType,
        firstBattle: this.firstBattle,
        wildSpecies,
        wildLevel,
      },
      playerPokemon: { ...playerPokemon },
      enemyPokemon: wildPokemon,
    });
    this.playerMon = this.engine.getPlayer();
    this.enemyMon = this.engine.getEnemy();
    this.displayedPlayerHp = this.playerMon.currentHp;
    this.displayedEnemyHp = this.enemyMon.currentHp;
    this.displayedPlayerExpLevel = this.playerMon.pokemon.level;
    this.displayedPlayerExpPercent = this.getPlayerExpTarget().percent;
    this.introElapsedMs = 0;
    this.spriteAnimationElapsedMs = 0;
    this.playerSendOutElapsedMs = 0;
    this.playerSendOutStarted = false;
    this.moveFlashMs = 0;
    this.moveFlashColor = DEFAULT_MOVE_ANIMATION.flashColor;
    this.playerDamageFlashMs = 0;
    this.enemyDamageFlashMs = 0;
    this.playerFaintProgress = 0;
    this.enemyFaintProgress = 0;
    this.statIndicators = [];
    this.fadeState = 'in';
    this.fadeAlpha = 1;

    this.actionIndex = 0;
    this.moveIndex = 0;
    this.phase = 'message';

    // Initialize WebGL battle renderer
    try {
      this.webgl = new BattleWebGLContext();

      // Load sprites and background in parallel
      const [playerCoords, enemyCoords] = await Promise.all([
        loadPokemonBattleSprites(this.webgl, playerPokemon.species),
        loadPokemonBattleSprites(this.webgl, wildSpecies),
        loadBattleBackground(this.webgl, backgroundProfile),
        loadBattleIntroSprites(this.webgl, this.playerGender),
        loadBattleMiscSprites(this.webgl),
        preloadBattleInterfaceAssets(),
      ]);
      this.playerSpriteCoords = playerCoords;
      this.enemySpriteCoords = enemyCoords;
    } catch (err) {
      console.warn('Failed to initialize battle WebGL:', err);
      this.webgl = null;
    }

    const introMessages = this.battleType === 'trainer'
      ? ['Trainer would like to battle!', `Trainer sent out ${this.enemyMon.name}!`, `Go! ${this.playerMon.name}!`]
      : [`Wild ${this.enemyMon.name} appeared!`, `Go! ${this.playerMon.name}!`];

    this.queueMessages(introMessages, () => {
      this.phase = 'action';
    });
  }

  async exit(): Promise<void> {
    this.engine = null;
    this.playerMon = null;
    this.enemyMon = null;
    this.waitingForBattleMenu = false;
    this.usingSharedDialogMessages = false;
    if (menuStateManager.isMenuOpen()) {
      menuStateManager.close();
    }
    if (this.webgl) {
      this.webgl.dispose();
      this.webgl = null;
    }
  }

  update(_dt: number, _frameCount: number): void {
    this.introElapsedMs += _dt;
    this.spriteAnimationElapsedMs += _dt;
    if (!this.playerSendOutStarted) {
      const activeMessage = this.messageQueue[0] ?? '';
      if (
        activeMessage.startsWith('Go! ')
        || this.phase === 'action'
        || this.phase === 'move'
        || this.phase === 'finished'
      ) {
        this.playerSendOutStarted = true;
      }
    }
    if (this.playerSendOutStarted) {
      this.playerSendOutElapsedMs += _dt;
    }
    this.tickHpAnimation(_dt);
    this.tickExpAnimation(_dt);
    this.moveFlashMs = Math.max(0, this.moveFlashMs - _dt);
    this.playerDamageFlashMs = Math.max(0, this.playerDamageFlashMs - _dt);
    this.enemyDamageFlashMs = Math.max(0, this.enemyDamageFlashMs - _dt);
    this.tickFaintAnimation(_dt);
    this.tickStatIndicators(_dt);
    this.tickFade(_dt);
  }

  handleInput(input: InputState): StateTransition | null {
    if (this.pendingTransition && this.transitionReady) {
      return this.pendingTransition;
    }

    const confirmPressed = inputMap.isPressed(input, GameButton.A);
    const cancelPressed = inputMap.isPressed(input, GameButton.B);
    const dialogOpen = getDialogBridge()?.isOpen() ?? false;

    if (
      menuStateManager.isMenuOpen()
      || this.waitingForBattleMenu
      || this.usingSharedDialogMessages
      || dialogOpen
    ) {
      return null;
    }

    if (this.phase === 'message') {
      if (confirmPressed) {
        this.advanceMessage();
      }
      return null;
    }

    if (this.phase === 'action') {
      if (inputMap.isPressed(input, GameButton.UP)) {
        this.actionIndex = this.actionIndex >= 2 ? this.actionIndex - 2 : this.actionIndex;
      }
      if (inputMap.isPressed(input, GameButton.DOWN)) {
        this.actionIndex = this.actionIndex < 2 ? this.actionIndex + 2 : this.actionIndex;
      }
      if (inputMap.isPressed(input, GameButton.LEFT)) {
        this.actionIndex = this.actionIndex % 2 === 1 ? this.actionIndex - 1 : this.actionIndex;
      }
      if (inputMap.isPressed(input, GameButton.RIGHT)) {
        this.actionIndex = this.actionIndex % 2 === 0 ? this.actionIndex + 1 : this.actionIndex;
      }

      if (confirmPressed) {
        const actions = ['FIGHT', 'BAG', 'POKEMON', 'RUN'] as const;
        const action = actions[this.actionIndex];
        switch (action) {
          case 'FIGHT':
            this.phase = 'move';
            this.moveIndex = 0;
            break;
          case 'RUN':
            this.executeRunAction();
            break;
          case 'BAG':
            if (this.firstBattle) {
              this.queueMessages(["There's no time for that!"], () => {
                this.phase = 'action';
              });
            } else {
              void this.handleBagAction();
            }
            break;
          case 'POKEMON':
            if (this.firstBattle) {
              this.queueMessages(["There's no time for that!"], () => {
                this.phase = 'action';
              });
            } else {
              void this.handlePokemonAction();
            }
            break;
        }
      }

      return null;
    }

    if (this.phase === 'move') {
      const moves = this.getPlayerMoves();
      if (moves.length === 0) {
        this.phase = 'action';
        return null;
      }

      if (inputMap.isPressed(input, GameButton.UP)) {
        this.moveIndex = this.moveIndex >= 2 ? this.moveIndex - 2 : this.moveIndex;
      }
      if (inputMap.isPressed(input, GameButton.DOWN)) {
        this.moveIndex = this.moveIndex < 2 && this.moveIndex + 2 < moves.length
          ? this.moveIndex + 2 : this.moveIndex;
      }
      if (inputMap.isPressed(input, GameButton.LEFT)) {
        this.moveIndex = this.moveIndex % 2 === 1 ? this.moveIndex - 1 : this.moveIndex;
      }
      if (inputMap.isPressed(input, GameButton.RIGHT)) {
        this.moveIndex = this.moveIndex % 2 === 0 && this.moveIndex + 1 < moves.length
          ? this.moveIndex + 1 : this.moveIndex;
      }

      if (cancelPressed) {
        this.phase = 'action';
        return null;
      }

      if (confirmPressed) {
        const selectedMove = moves[this.moveIndex];
        this.executeTurn(selectedMove.moveId, selectedMove.moveSlot);
      }

      return null;
    }

    if (this.phase === 'finished' && confirmPressed) {
      if (this.fadeState !== 'out') {
        saveManager.stagePendingObjectEventRuntimeState(this.returnObjectEventRuntimeState);
        this.pendingTransition = {
          to: GameState.OVERWORLD,
          data: {
            savedLocation: this.returnLocation ?? undefined,
          },
        };
        this.fadeState = 'out';
      }
      return null;
    }

    return null;
  }

  render(context: RenderContext): void {
    const { ctx2d, viewport } = context;
    const viewportWidth = viewport.width;
    const viewportHeight = viewport.height;

    // Calculate offset for centering the 240×160 battle scene
    const offsetX = Math.floor((viewportWidth - BATTLE_WIDTH) / 2);
    const offsetY = Math.floor((viewportHeight - BATTLE_HEIGHT) / 2);

    const player = this.playerMon;
    const enemy = this.enemyMon;
    const playerSendOut = this.getPlayerSendOutVisualState();

    // --- WebGL layer: background + Pokemon sprites ---
    if (this.webgl) {
      this.webgl.clear(0.53, 0.75, 0.44, 1); // green fallback

      const sprites: SpriteInstance[] = [];

      // Background
      sprites.push(createBackgroundSprite());

      // Enemy front sprite
      if (enemy) {
        const enemySprite = createFrontSprite(
          enemy.pokemon.species,
          this.enemySpriteCoords,
          this.getPokemonSpriteFrame(enemy.pokemon.species, 'front'),
        );
        const enemyProgress = Math.max(0, Math.min(1, this.introElapsedMs / ENEMY_INTRO_MS));
        const enemyStartX = BATTLE_WIDTH + 12;
        enemySprite.worldX = Math.round(lerp(enemyStartX, enemySprite.worldX, enemyProgress));
        enemySprite.alpha = enemyProgress;
        enemySprite.worldY = Math.round(enemySprite.worldY + (this.enemyFaintProgress * 34));
        enemySprite.alpha *= (1 - (this.enemyFaintProgress * 0.85));
        if (this.enemyDamageFlashMs > 0 && Math.floor(this.enemyDamageFlashMs / 40) % 2 === 0) {
          enemySprite.alpha *= 0.3;
        }

        const enemyElevation = this.enemySpriteCoords?.elevation ?? 0;
        if (enemyElevation > 0) {
          const shadowX = enemySprite.worldX + 16;
          const shadowY = enemySprite.worldY + 53 + enemyElevation;
          sprites.push(createEnemyShadowSprite(shadowX, shadowY, enemySprite.alpha * 0.82));
        }

        this.applyStatusTint(enemySprite, enemy.pokemon.status);
        sprites.push(enemySprite);
      }

      if (playerSendOut.showTrainer) {
        sprites.push(
          createTrainerBackSprite(
            this.playerGender,
            playerSendOut.trainerFrame,
            playerSendOut.trainerX,
            playerSendOut.trainerY,
          ),
        );
      }

      // Player back sprite
      if (player && playerSendOut.showPokemon) {
        const playerSprite = createBackSprite(
          player.pokemon.species,
          this.playerSpriteCoords,
          this.getPokemonSpriteFrame(player.pokemon.species, 'back'),
        );
        const scale = playerSendOut.pokemonScale;
        const scaledW = Math.max(1, Math.round(playerSprite.width * scale));
        const scaledH = Math.max(1, Math.round(playerSprite.height * scale));
        playerSprite.worldX = Math.round(playerSprite.worldX + (playerSprite.width - scaledW) / 2);
        playerSprite.worldY = Math.round(
          playerSprite.worldY + (playerSprite.height - scaledH) + playerSendOut.pokemonYOffset,
        );
        playerSprite.width = scaledW;
        playerSprite.height = scaledH;
        playerSprite.alpha = 1;
        playerSprite.worldY = Math.round(playerSprite.worldY + (this.playerFaintProgress * 34));
        playerSprite.alpha *= (1 - (this.playerFaintProgress * 0.85));
        if (this.playerDamageFlashMs > 0 && Math.floor(this.playerDamageFlashMs / 40) % 2 === 0) {
          playerSprite.alpha *= 0.3;
        }
        this.applyStatusTint(playerSprite, player.pokemon.status);
        sprites.push(playerSprite);
      }

      if (playerSendOut.showBall) {
        sprites.push(
          createPokeballSprite(
            playerSendOut.ballX,
            playerSendOut.ballY,
            playerSendOut.ballFrame,
          ),
        );
      }

      this.webgl.renderSprites(sprites);

      // Composite WebGL onto ctx2d
      this.webgl.compositeOnto(ctx2d, viewportWidth, viewportHeight);
    } else {
      // Fallback: solid color fill
      ctx2d.fillStyle = '#88c070';
      ctx2d.fillRect(0, 0, viewportWidth, viewportHeight);
    }

    if (this.moveFlashMs > 0) {
      const alpha = Math.max(0, Math.min(1, this.moveFlashMs / MOVE_FLASH_MS)) * 0.35;
      ctx2d.fillStyle = `rgba(${this.moveFlashColor}, ${alpha})`;
      ctx2d.fillRect(offsetX, offsetY, BATTLE_WIDTH, BATTLE_HEIGHT);
    }

    this.renderWeatherEffects(ctx2d, offsetX, offsetY);

    if (this.fadeAlpha > 0) {
      ctx2d.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
      ctx2d.fillRect(offsetX, offsetY, BATTLE_WIDTH, BATTLE_HEIGHT);
    }

    // --- ctx2d overlay: health boxes, text, menus ---

    // Enemy health box
    if (enemy) {
      drawEnemyHealthBox(
        ctx2d, offsetX, offsetY,
        enemy.name, enemy.pokemon.level,
        this.displayedEnemyHp, enemy.maxHp,
        enemy.pokemon.status,
      );
    }

    // Player health box
    if (player) {
      drawPlayerHealthBox(
        ctx2d, offsetX, offsetY,
        player.name, player.pokemon.level,
        this.displayedPlayerHp, player.maxHp,
        this.displayedPlayerExpPercent,
        player.pokemon.status,
      );
    }

    this.renderStatIndicators(ctx2d, offsetX, offsetY);

    // Text box / menus
    if (this.phase === 'message') {
      if (!this.usingSharedDialogMessages) {
        const message = this.messageQueue[0] ?? '';
        drawTextBox(ctx2d, offsetX, offsetY, message);
      }
      return;
    }

    if (this.phase === 'action') {
      drawActionMenu(
        ctx2d, offsetX, offsetY,
        this.actionIndex,
        player?.name ?? 'POKéMON',
        this.firstBattle,
      );
      return;
    }

    if (this.phase === 'move') {
      const moveChoices = this.getPlayerMoves();
      const moves = moveChoices.map(({ moveId, moveSlot }) => {
        const info = getMoveInfo(moveId);
        return {
          name: getMoveName(moveId),
          pp: player?.pokemon.pp[moveSlot] ?? 0,
          maxPp: info?.pp ?? 0,
          type: info?.type ?? 'NORMAL',
        };
      });
      drawMoveMenu(ctx2d, offsetX, offsetY, moves, this.moveIndex);
      return;
    }

    drawTextBox(ctx2d, offsetX, offsetY, 'Battle finished.');
  }

  // --- Internal battle logic ---

  private queueMessages(messages: string[], onComplete?: () => void): void {
    const dialog = getDialogBridge();
    if (dialog) {
      this.phase = 'message';
      this.messageQueue = [...messages];
      this.onMessagesFinished = null;
      this.usingSharedDialogMessages = true;
      void this.showMessagesWithDialog(dialog, messages, onComplete);
      return;
    }

    this.messageQueue = [...messages];
    this.phase = 'message';
    this.onMessagesFinished = onComplete ?? null;
  }

  private async showMessagesWithDialog(
    dialog: { showMessage: (text: string) => Promise<void> },
    messages: readonly string[],
    onComplete?: () => void,
  ): Promise<void> {
    try {
      for (const message of messages) {
        await dialog.showMessage(message);
      }
    } catch (error) {
      console.warn('[BattleState] Dialog bridge message flow failed, continuing:', error);
    } finally {
      this.usingSharedDialogMessages = false;
      onComplete?.();
    }
  }

  private advanceMessage(): void {
    if (this.messageQueue.length > 0) {
      this.messageQueue.shift();
    }

    if (this.messageQueue.length === 0) {
      const callback = this.onMessagesFinished;
      this.onMessagesFinished = null;
      callback?.();
    }
  }

  private getPlayerMoves(): Array<{ moveId: number; moveSlot: number }> {
    if (!this.playerMon) return [];
    const moves: Array<{ moveId: number; moveSlot: number }> = [];
    for (let moveSlot = 0; moveSlot < this.playerMon.pokemon.moves.length; moveSlot++) {
      const moveId = this.playerMon.pokemon.moves[moveSlot];
      if (moveId !== 0) {
        moves.push({ moveId, moveSlot });
      }
    }
    return moves;
  }

  private async handleBagAction(): Promise<void> {
    this.waitingForBattleMenu = true;
    try {
      const itemId = await this.openBattleBagMenu();
      if (itemId === null) {
        this.phase = 'action';
        return;
      }
      this.handleBattleItemSelection(itemId);
    } finally {
      this.waitingForBattleMenu = false;
    }
  }

  private async handlePokemonAction(): Promise<void> {
    this.waitingForBattleMenu = true;
    try {
      const partyIndex = await this.openBattlePartyMenu();
      if (partyIndex === null) {
        this.phase = 'action';
        return;
      }
      await this.switchPlayerPokemon(partyIndex);
    } finally {
      this.waitingForBattleMenu = false;
    }
  }

  private openBattleBagMenu(): Promise<number | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: number | null): void => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(value);
      };
      const unsubscribe = menuStateManager.subscribe((state) => {
        if (!state.isOpen) {
          finish(null);
        }
      });

      menuStateManager.open('bag', {
        mode: 'battle',
        onBattleItemSelected: (itemId: number | null) => {
          finish(itemId);
        },
      });
    });
  }

  private openBattlePartyMenu(): Promise<number | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: number | null): void => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(value);
      };
      const unsubscribe = menuStateManager.subscribe((state) => {
        if (!state.isOpen) {
          finish(null);
        }
      });

      menuStateManager.open('party', {
        mode: 'battle',
        activePartyIndex: this.playerPartyIndex,
        onBattlePartySelected: (partyIndex: number | null) => {
          finish(partyIndex);
        },
      });
    });
  }

  private handleBattleItemSelection(itemId: number): void {
    if (!this.playerMon) {
      this.phase = 'action';
      return;
    }

    if (isBattlePokeBallItem(itemId)) {
      if (this.battleType === 'trainer') {
        this.queueMessages(['The TRAINER blocked the BALL!'], () => {
          this.phase = 'action';
        });
        return;
      }

      this.queueMessages(['Poké Ball capture flow is next in the battle checklist.'], () => {
        this.phase = 'action';
      });
      return;
    }

    const applied = this.applyItemToActivePokemon(itemId);
    if (!applied.used) {
      this.queueMessages([applied.message], () => {
        this.phase = 'action';
      });
      return;
    }

    if (!bagManager.removeItem(itemId, 1)) {
      this.queueMessages([`You don't have any ${getItemName(itemId)} left!`], () => {
        this.phase = 'action';
      });
      return;
    }

    this.executePlayerAction(
      { type: 'item', itemId },
      [`${saveManager.getPlayerName()} used ${getItemName(itemId)}!`, applied.message],
    );
  }

  private applyItemToActivePokemon(itemId: number): { used: boolean; message: string } {
    const player = this.playerMon;
    if (!player) {
      return { used: false, message: 'But it had no effect.' };
    }

    const healAmount = getBattleHealAmount(itemId);
    const canCureAllStatus = itemId === ITEMS.ITEM_FULL_RESTORE
      || itemId === ITEMS.ITEM_FULL_HEAL
      || itemId === ITEMS.ITEM_LAVA_COOKIE;
    const cureMask = getBattleStatusCureMask(itemId);

    if (itemId === ITEMS.ITEM_REVIVE || itemId === ITEMS.ITEM_MAX_REVIVE) {
      if (player.currentHp > 0) {
        return { used: false, message: "It won't have any effect." };
      }
      const revivedHp = itemId === ITEMS.ITEM_REVIVE
        ? Math.max(1, Math.floor(player.maxHp / 2))
        : player.maxHp;
      player.currentHp = revivedHp;
      player.pokemon.stats.hp = revivedHp;
      return { used: true, message: `${player.name} recovered to ${revivedHp} HP!` };
    }

    if (healAmount !== null) {
      if (player.currentHp <= 0 || player.currentHp >= player.maxHp) {
        if (!(itemId === ITEMS.ITEM_FULL_RESTORE && player.pokemon.status !== STATUS.NONE)) {
          return { used: false, message: "It won't have any effect." };
        }
      } else {
        const targetHp = healAmount === 'full'
          ? player.maxHp
          : Math.min(player.maxHp, player.currentHp + healAmount);
        player.currentHp = targetHp;
        player.pokemon.stats.hp = targetHp;
      }
    }

    let curedAnyStatus = false;
    if (canCureAllStatus && player.pokemon.status !== STATUS.NONE) {
      player.pokemon.status = STATUS.NONE;
      curedAnyStatus = true;
    } else if (cureMask !== 0) {
      const nextStatus = clearBattleStatusMask(player.pokemon.status, cureMask);
      curedAnyStatus = nextStatus !== player.pokemon.status;
      player.pokemon.status = nextStatus;
    }
    if (curedAnyStatus) {
      player.volatile.toxicCounter = 0;
    }

    if (healAmount !== null && (player.currentHp > 0)) {
      if (curedAnyStatus) {
        return { used: true, message: `${player.name}'s HP and status were restored!` };
      }
      return { used: true, message: `${player.name}'s HP was restored.` };
    }

    if (curedAnyStatus) {
      return { used: true, message: `${player.name} was cured of its status condition.` };
    }

    return { used: false, message: "It won't have any effect." };
  }

  private async switchPlayerPokemon(partyIndex: number): Promise<void> {
    if (!this.engine || !this.playerMon) {
      this.phase = 'action';
      return;
    }

    const party = saveManager.getParty();
    const target = party[partyIndex];
    if (!target) {
      this.phase = 'action';
      return;
    }
    if (partyIndex === this.playerPartyIndex) {
      this.queueMessages([`${target.nickname ?? getSpeciesName(target.species)} is already in battle!`], () => {
        this.phase = 'action';
      });
      return;
    }
    if (target.stats.hp <= 0) {
      this.queueMessages(["There's no will to battle!"], () => {
        this.phase = 'action';
      });
      return;
    }

    const current = this.playerMon;
    const currentName = current.name;
    const targetName = target.nickname?.trim() || getSpeciesName(target.species);
    const prevSpecies = current.pokemon.species;

    party[this.playerPartyIndex] = this.toPersistedPartyPokemon(current);
    saveManager.setParty(party);

    if (target.species !== prevSpecies) {
      await this.ensurePlayerSpriteLoaded(target.species);
    }

    const player = this.engine.getPlayer();
    player.pokemon = { ...target };
    player.name = targetName;
    player.currentHp = target.stats.hp;
    player.maxHp = target.stats.maxHp;
    player.stages = createDefaultStages();
    player.volatile = createDefaultVolatile();
    player.ability = getAbility(target.species, target.abilityNum);
    player.partyIndex = partyIndex;

    this.playerMon = player;
    this.playerPartyIndex = partyIndex;
    this.displayedPlayerHp = player.currentHp;
    this.displayedPlayerExpLevel = player.pokemon.level;
    this.displayedPlayerExpPercent = this.getPlayerExpTarget().percent;
    this.executePlayerAction(
      { type: 'switch', partyIndex },
      [`${currentName}, that's enough! Come back!`, `Go! ${targetName}!`],
    );
  }

  private async ensurePlayerSpriteLoaded(species: number): Promise<void> {
    if (!this.webgl) return;
    try {
      this.playerSpriteCoords = await loadPokemonBattleSprites(this.webgl, species);
    } catch (error) {
      console.warn(`[BattleState] Failed to load switched sprite for species ${species}:`, error);
    }
  }

  private executeRunAction(): void {
    this.executePlayerAction({ type: 'run' });
  }

  private executeTurn(playerMoveId: number, playerMoveSlot: number): void {
    if (!this.engine) return;
    this.executePlayerAction({
      type: 'fight',
      moveId: playerMoveId,
      moveSlot: playerMoveSlot,
    });
  }

  private executePlayerAction(action: BattleAction, prefixMessages: string[] = []): void {
    if (!this.engine) return;

    const result = this.engine.executeTurn(action);
    this.applyMoveAnimationFromEvents(result.events);
    this.applyStatIndicatorsFromEvents(result.events);
    this.syncFromEngine();
    this.persistPlayerBattleState();

    const turnMessages = this.collectTurnMessages(result.events, prefixMessages);
    this.handleTurnOutcome(result.outcome, turnMessages);
  }

  private collectTurnMessages(events: BattleEvent[], prefixMessages: string[]): string[] {
    const messages = events
      .map((event) => event.message?.trim() ?? '')
      .filter((message) => message.length > 0);
    if (messages.length > 0) {
      return [...prefixMessages, ...messages];
    }
    if (prefixMessages.length > 0) {
      return [...prefixMessages];
    }
    return ['...'];
  }

  private handleTurnOutcome(outcome: BattleOutcome | null, turnMessages: string[]): void {
    if (outcome === 'win') {
      this.handleWin(turnMessages);
      return;
    }
    if (outcome === 'lose') {
      this.handleLoss(turnMessages, 'B_OUTCOME_LOST');
      return;
    }
    if (outcome === 'draw') {
      this.handleLoss(turnMessages, 'B_OUTCOME_DREW');
      return;
    }
    if (outcome === 'flee') {
      this.setScriptBattleResult('B_OUTCOME_RAN');
      this.queueMessages(turnMessages, () => {
        this.phase = 'finished';
      });
      return;
    }

    this.queueMessages(turnMessages, () => {
      this.phase = 'action';
    });
  }

  private applyMoveAnimationFromEvents(events: BattleEvent[]): void {
    const damageEvent = events.find((event) => event.type === 'damage');
    if (!damageEvent) return;

    const sequence = damageEvent.moveId !== undefined
      ? MOVE_ANIMATIONS.get(damageEvent.moveId) ?? DEFAULT_MOVE_ANIMATION
      : DEFAULT_MOVE_ANIMATION;

    this.moveFlashMs = sequence.flashDurationMs;
    this.moveFlashColor = sequence.flashColor;

    if (damageEvent.battler === 0) {
      this.playerDamageFlashMs = 220;
    } else if (damageEvent.battler === 1) {
      this.enemyDamageFlashMs = 220;
    }
  }

  private tickStatIndicators(dt: number): void {
    for (const indicator of this.statIndicators) {
      indicator.ttlMs = Math.max(0, indicator.ttlMs - dt);
    }
    this.statIndicators = this.statIndicators.filter((indicator) => indicator.ttlMs > 0);
  }

  private applyStatIndicatorsFromEvents(events: BattleEvent[]): void {
    for (const event of events) {
      if (event.type !== 'stat_change' || !event.value || !event.detail) continue;
      if (event.value === 0) continue;

      const battler = (event.battler === 1 ? 1 : 0) as 0 | 1;
      const arrows = event.value > 0
        ? (Math.abs(event.value) >= 2 ? '↑↑' : '↑')
        : (Math.abs(event.value) >= 2 ? '↓↓' : '↓');

      this.statIndicators.push({
        battler,
        text: `${this.formatStatLabel(event.detail)} ${arrows}`,
        ttlMs: 900,
      });
    }
  }

  private renderStatIndicators(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
  ): void {
    for (const indicator of this.statIndicators) {
      const life = 1 - (indicator.ttlMs / 900);
      const x = indicator.battler === 0 ? offsetX + 182 : offsetX + 68;
      const baseY = indicator.battler === 0 ? offsetY + 74 : offsetY + 10;
      const y = baseY - (life * 10);

      const up = indicator.text.includes('↑');
      ctx.fillStyle = up ? '#48d848' : '#f85858';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(indicator.text, x, y);
    }
  }

  private renderWeatherEffects(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
  ): void {
    const weather = this.engine?.getWeather().type ?? 'none';
    if (weather === 'none') return;

    const t = this.introElapsedMs / 1000;

    if (weather === 'sun') {
      const pulse = 0.06 + (Math.sin(t * 5) * 0.02);
      ctx.fillStyle = `rgba(255, 236, 136, ${Math.max(0.02, pulse)})`;
      ctx.fillRect(offsetX, offsetY, BATTLE_WIDTH, BATTLE_HEIGHT);
      return;
    }

    if (weather === 'rain') {
      ctx.strokeStyle = 'rgba(164, 210, 255, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 36; i++) {
        const px = ((i * 17) + Math.floor(t * 260)) % (BATTLE_WIDTH + 24);
        const py = ((i * 23) + Math.floor(t * 420)) % (BATTLE_HEIGHT + 20);
        ctx.beginPath();
        ctx.moveTo(offsetX + px, offsetY + py);
        ctx.lineTo(offsetX + px - 4, offsetY + py + 8);
        ctx.stroke();
      }
      return;
    }

    if (weather === 'sandstorm') {
      ctx.fillStyle = 'rgba(214, 186, 120, 0.24)';
      for (let i = 0; i < 42; i++) {
        const px = ((i * 19) + Math.floor(t * 120)) % (BATTLE_WIDTH + 12);
        const py = ((i * 29) + Math.floor(t * 85)) % (BATTLE_HEIGHT + 8);
        ctx.fillRect(offsetX + px, offsetY + py, 2, 2);
      }
      return;
    }

    if (weather === 'hail') {
      ctx.fillStyle = 'rgba(232, 244, 255, 0.48)';
      for (let i = 0; i < 34; i++) {
        const px = ((i * 21) + Math.floor(t * 95)) % (BATTLE_WIDTH + 10);
        const py = ((i * 31) + Math.floor(t * 170)) % (BATTLE_HEIGHT + 10);
        ctx.fillRect(offsetX + px, offsetY + py, 2, 2);
      }
    }
  }

  /**
   * Mirrors pokeemerald send-out sequence:
   * - Trainer throw pose + 50f translation offscreen
   * - 31f task delay before ball send-out starts
   * - 1f setup delay in DoPokeballSendOutAnimation task
   * - 25f horizontal arc to battler coords
   * - Ball open and mon emerge affine
   *
   * C refs:
   * - public/pokeemerald/src/battle_controller_player.c (PlayerHandleIntroTrainerBallThrow, Task_StartSendOutAnim)
   * - public/pokeemerald/src/pokeball.c (Task_DoPokeballSendOutAnim, SpriteCB_PlayerMonSendOut_1/_2, SpriteCB_ReleaseMonFromBall)
   */
  private getPlayerSendOutVisualState(): PlayerSendOutVisualState {
    const frame = this.playerSendOutElapsedMs / INTRO_FRAME_MS;
    const playerSpecies = this.playerMon?.pokemon.species;
    const baseSprite = createBackSprite(
      playerSpecies ?? SPECIES.TREECKO,
      this.playerSpriteCoords,
      this.getPokemonSpriteFrame(playerSpecies ?? SPECIES.TREECKO, 'back'),
    );
    const ballTargetX = baseSprite.worldX + (baseSprite.width / 2);
    const ballTargetY = baseSprite.worldY + 24;

    const trainerShow = frame < TRAINER_THROW_TRANSLATE_FRAMES;
    const trainerProgress = clamp(frame / TRAINER_THROW_TRANSLATE_FRAMES, 0, 1);

    const ballArcStartFrame = TRAINER_SEND_OUT_DELAY_FRAMES + BALL_SEND_OUT_TASK_SETUP_FRAMES;
    const ballArcEndFrame = ballArcStartFrame + BALL_ARC_FRAMES;
    const ballOpenEndFrame = ballArcEndFrame + BALL_OPEN_FRAMES;

    let showBall = false;
    let ballFrame = 0;
    let ballX = BALL_START_X;
    let ballY = BALL_START_Y;

    if (frame >= ballArcStartFrame && frame < ballOpenEndFrame) {
      showBall = true;
      if (frame < ballArcEndFrame) {
        const t = clamp((frame - ballArcStartFrame) / BALL_ARC_FRAMES, 0, 1);
        ballX = lerp(BALL_START_X, ballTargetX, t);
        ballY = lerp(BALL_START_Y, ballTargetY, t) + (Math.sin(t * Math.PI) * BALL_ARC_AMPLITUDE);
        ballFrame = 0;
      } else {
        const openFrame = frame - ballArcEndFrame;
        ballX = ballTargetX;
        ballY = ballTargetY;
        ballFrame = openFrame < (BALL_OPEN_FRAMES / 2) ? 1 : 2;
      }
    }

    const pokemonShowFrame = ballArcEndFrame;
    const showPokemon = frame >= pokemonShowFrame;
    let pokemonScale = 1;
    let pokemonYOffset = 0;
    if (showPokemon) {
      const emergeProgress = clamp((frame - pokemonShowFrame) / MON_EMERGE_FRAMES, 0, 1);
      pokemonScale = lerp(0.15625, 1, emergeProgress);
      pokemonYOffset = Math.round((1 - emergeProgress) * 16);
    }

    if (!this.playerSendOutStarted) {
      return {
        showTrainer: false,
        trainerFrame: 0,
        trainerX: TRAINER_THROW_START_X,
        trainerY: TRAINER_THROW_Y,
        showBall: false,
        ballFrame: 0,
        ballX: BALL_START_X,
        ballY: BALL_START_Y,
        showPokemon: false,
        pokemonScale: 0.15625,
        pokemonYOffset: 16,
      };
    }

    return {
      showTrainer: trainerShow,
      trainerFrame: this.getTrainerThrowFrame(frame),
      trainerX: lerp(TRAINER_THROW_START_X, TRAINER_THROW_END_X, trainerProgress),
      trainerY: TRAINER_THROW_Y,
      showBall,
      ballFrame,
      ballX,
      ballY,
      showPokemon,
      pokemonScale,
      pokemonYOffset,
    };
  }

  private getTrainerThrowFrame(frame: number): number {
    let remaining = Math.max(0, Math.floor(frame));
    for (const step of TRAINER_THROW_FRAMES) {
      if (remaining < step.duration) return step.frame;
      remaining -= step.duration;
    }
    return TRAINER_THROW_FRAMES[TRAINER_THROW_FRAMES.length - 1]?.frame ?? 0;
  }

  private applyStatusTint(sprite: SpriteInstance, status: number): void {
    if ((status & STATUS.TOXIC) !== 0 || (status & STATUS.POISON) !== 0) {
      sprite.tintR = 0.78;
      sprite.tintG = 1.0;
      sprite.tintB = 0.78;
      return;
    }
    if ((status & STATUS.BURN) !== 0) {
      sprite.tintR = 1.0;
      sprite.tintG = 0.78;
      sprite.tintB = 0.78;
      return;
    }
    if ((status & STATUS.PARALYSIS) !== 0) {
      sprite.tintR = 1.0;
      sprite.tintG = 1.0;
      sprite.tintB = 0.72;
      return;
    }
    if ((status & STATUS.FREEZE) !== 0) {
      sprite.tintR = 0.78;
      sprite.tintG = 0.9;
      sprite.tintB = 1.0;
    }
  }

  private tickFaintAnimation(dt: number): void {
    if (this.playerMon?.currentHp === 0) {
      this.playerFaintProgress = Math.min(1, this.playerFaintProgress + (dt / 420));
    } else {
      this.playerFaintProgress = 0;
    }

    if (this.enemyMon?.currentHp === 0) {
      this.enemyFaintProgress = Math.min(1, this.enemyFaintProgress + (dt / 420));
    } else {
      this.enemyFaintProgress = 0;
    }
  }

  private formatStatLabel(stat: string): string {
    const key = stat.toLowerCase();
    if (key === 'attack') return 'ATK';
    if (key === 'defense') return 'DEF';
    if (key === 'speed') return 'SPD';
    if (key === 'spattack') return 'SpA';
    if (key === 'spdefense') return 'SpD';
    if (key === 'accuracy') return 'ACC';
    if (key === 'evasion') return 'EVA';
    return stat;
  }

  private tickFade(dt: number): void {
    if (this.fadeState === 'in') {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - (dt / BATTLE_FADE_MS));
      if (this.fadeAlpha <= 0) {
        this.fadeState = 'none';
      }
      return;
    }

    if (this.fadeState === 'out') {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + (dt / BATTLE_FADE_MS));
      if (this.fadeAlpha >= 1) {
        this.fadeState = 'none';
        this.transitionReady = true;
      }
    }
  }

  private getPokemonSpriteFrame(speciesId: number, side: 'front' | 'back'): number {
    const frameCount = side === 'front'
      ? getPokemonBattleFrontFrameCount(speciesId)
      : getPokemonBattleBackFrameCount(speciesId);
    if (frameCount <= 1) {
      return 0;
    }

    const elapsedFrames = Math.floor(this.spriteAnimationElapsedMs / MON_SPRITE_ANIM_FRAME_MS);
    const speciesOffset = speciesId % frameCount;
    return (elapsedFrames + speciesOffset) % frameCount;
  }

  private syncFromEngine(): void {
    if (!this.engine) return;
    this.playerMon = this.engine.getPlayer();
    this.enemyMon = this.engine.getEnemy();
  }

  private tickHpAnimation(dt: number): void {
    if (this.playerMon) {
      this.displayedPlayerHp = this.stepDisplayedHp(this.displayedPlayerHp, this.playerMon.currentHp, dt);
    }
    if (this.enemyMon) {
      this.displayedEnemyHp = this.stepDisplayedHp(this.displayedEnemyHp, this.enemyMon.currentHp, dt);
    }
  }

  private tickExpAnimation(dt: number): void {
    if (!this.playerMon) return;

    const target = this.getPlayerExpTarget();
    const step = Math.max(0.01, (dt / 1000) * EXP_ANIMATION_RATE);

    // Handle level-up rollover by filling previous bar, then resetting to 0.
    if (this.displayedPlayerExpLevel < target.level) {
      this.displayedPlayerExpPercent = Math.min(1, this.displayedPlayerExpPercent + step);
      if (this.displayedPlayerExpPercent >= 0.999) {
        this.displayedPlayerExpLevel++;
        this.displayedPlayerExpPercent = 0;
      }
      return;
    }

    this.displayedPlayerExpLevel = target.level;
    if (this.displayedPlayerExpPercent < target.percent) {
      this.displayedPlayerExpPercent = Math.min(target.percent, this.displayedPlayerExpPercent + step);
    } else if (this.displayedPlayerExpPercent > target.percent) {
      this.displayedPlayerExpPercent = Math.max(target.percent, this.displayedPlayerExpPercent - step);
    }
  }

  private getPlayerExpTarget(): { level: number; percent: number } {
    if (!this.playerMon) return { level: 1, percent: 0 };

    const mon = this.playerMon.pokemon;
    const info = getSpeciesInfo(mon.species);
    const growthRate = info?.growthRate ?? 'MEDIUM_FAST';
    if (mon.level >= 100) {
      return { level: mon.level, percent: 1 };
    }

    const currentLevelExp = getExpForLevel(growthRate, mon.level);
    const nextLevelExp = getExpForLevel(growthRate, mon.level + 1);
    const levelRange = Math.max(1, nextLevelExp - currentLevelExp);
    const progress = Math.max(0, mon.experience - currentLevelExp);
    const percent = Math.max(0, Math.min(1, progress / levelRange));
    return { level: mon.level, percent };
  }

  private stepDisplayedHp(displayed: number, target: number, dt: number): number {
    if (displayed === target) return target;
    const step = Math.max(1, Math.floor((dt / 1000) * HP_ANIMATION_RATE));
    if (displayed < target) return Math.min(target, displayed + step);
    return Math.max(target, displayed - step);
  }

  private toPersistedPartyPokemon(player: BattlePokemon): PartyPokemon {
    return {
      ...player.pokemon,
      stats: {
        ...player.pokemon.stats,
        hp: player.currentHp,
        maxHp: player.maxHp,
      },
    };
  }

  private persistPlayerBattleState(): void {
    const player = this.playerMon;
    if (!player) return;

    const party = saveManager.getParty();
    const active = party[this.playerPartyIndex];
    if (!active) return;

    party[this.playerPartyIndex] = this.toPersistedPartyPokemon(player);
    saveManager.setParty(party);
  }

  private setScriptBattleResult(
    outcome: 'B_OUTCOME_WON' | 'B_OUTCOME_LOST' | 'B_OUTCOME_DREW' | 'B_OUTCOME_RAN' | 'B_OUTCOME_CAUGHT',
  ): void {
    const value = B_OUTCOME[outcome];
    if (typeof value === 'number') {
      gameVariables.setVar(GAME_VARS.VAR_RESULT, value);
    }
  }

  private handleWin(turnMessages: string[]): void {
    const player = this.playerMon;
    const enemy = this.enemyMon;
    if (!player || !enemy) return;

    this.setScriptBattleResult('B_OUTCOME_WON');

    const enemyInfo = getSpeciesInfo(enemy.pokemon.species);
    const baseExpYield = enemyInfo?.expYield ?? 0;
    const gainedExp = Math.floor((baseExpYield * enemy.pokemon.level) / 7);
    const oldLevel = player.pokemon.level;

    player.pokemon.experience += gainedExp;
    const growthRate = getSpeciesInfo(player.pokemon.species)?.growthRate ?? 'MEDIUM_FAST';
    const newLevel = calculateLevelFromExp(growthRate, player.pokemon.experience);

    turnMessages.push(`${player.name} gained ${gainedExp} EXP. Points!`);

    if (newLevel > oldLevel) {
      const previousMaxHp = player.pokemon.stats.maxHp;
      const previousHp = player.currentHp;
      player.pokemon = recalculatePartyStats(player.pokemon);
      const hpGain = player.pokemon.stats.maxHp - previousMaxHp;
      player.currentHp = Math.min(player.pokemon.stats.maxHp, previousHp + Math.max(0, hpGain));
      player.maxHp = player.pokemon.stats.maxHp;
      turnMessages.push(`${player.name} grew to Lv. ${newLevel}!`);
    }

    const party = saveManager.getParty();
    const active = party[this.playerPartyIndex];
    if (active) {
      party[this.playerPartyIndex] = this.toPersistedPartyPokemon(player);
    }
    saveManager.setParty(party);

    if (this.firstBattle) {
      gameFlags.set('FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE');
      gameFlags.set('FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG');
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_BIRCH');
      gameFlags.clear('FLAG_HIDE_MAP_NAME_POPUP');
      gameVariables.setVar(GAME_VARS.VAR_BIRCH_LAB_STATE, 2);
      gameVariables.setVar(GAME_VARS.VAR_ROUTE101_STATE, 3);

      const healedParty = saveManager.getParty();
      const healedActive = healedParty[this.playerPartyIndex];
      if (healedActive) {
        healedActive.stats.hp = healedActive.stats.maxHp;
      }
      saveManager.setParty(healedParty);

      if (this.playerMon) {
        this.playerMon.currentHp = this.playerMon.maxHp;
      }
    }

    this.queueMessages(turnMessages, () => {
      this.phase = 'finished';
    });
  }

  private handleLoss(
    turnMessages: string[],
    outcome: 'B_OUTCOME_LOST' | 'B_OUTCOME_DREW',
  ): void {
    const party = saveManager.getParty();
    const active = party[this.playerPartyIndex];
    if (active) {
      party[this.playerPartyIndex] = {
        ...active,
        stats: {
          ...active.stats,
          hp: 0,
        },
      };
    }
    saveManager.setParty(party);

    this.setScriptBattleResult(outcome);
    turnMessages.push(
      outcome === 'B_OUTCOME_DREW'
        ? 'The battle ended in a draw...'
        : 'You lost the battle...',
    );
    this.queueMessages(turnMessages, () => {
      this.phase = 'finished';
    });
  }
}

export function createBattleState(): StateRenderer {
  return new BattleState();
}

function lerp(start: number, end: number, t: number): number {
  return start + ((end - start) * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
import { PromptService, drawPromptYesNo } from '../core/prompt/PromptService';
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
import { getMovesAtLevel } from '../data/learnsets.gen.ts';
import { EVOLUTION_MODES } from '../data/evolutions.gen.ts';
import { getExpForLevel, recalculatePartyStatsCStyle } from '../pokemon/stats';
import { createTestPokemon } from '../pokemon/testFactory';
import { PARTY_SIZE, STATUS, type IVs, type PartyPokemon } from '../pokemon/types';
import type { SpriteInstance } from '../rendering/types';
import { BattleEngine } from '../battle/engine/BattleEngine';
import type { BattleEnemyPokemonSpec, BattleStartRequest, BattleTrainerSpec } from '../battle/BattleStartRequest';
import { toMoveSet } from '../battle/BattleStartRequest';
import { battleRandomInt } from '../battle/engine/BattleRng';
import {
  type BattleAction,
  type BattleEvent,
  type BattlePokemon,
  type BattleOutcome,
} from '../battle/engine/types';
import { B_OUTCOME } from '../data/battleConstants.gen';
import { menuStateManager } from '../menu';
import type { ObjectEventRuntimeState } from '../types/objectEvents';
import {
  clearBattleStatusMask,
  getBattleHealAmount,
  getBattleStatusCureMask,
  isBattlePokeBallItem,
} from '../battle/items/battleItemRules';
import {
  calculateCatchOdds,
  calculateFaintExpDistribution,
  getBallEscapeMessage,
  resolveBallMultiplierTenths,
  resolveCaptureShakes,
  scaleTrainerIvToBattleIv,
} from '../battle/mechanics/cParityBattle';
import { getEvolutionTargetSpecies } from '../pokemon/evolution';
import {
  getLevelUpMovesBetween,
  runMoveLearningSequence,
} from '../pokemon/moveLearning';
import { formatPokemonDisplayName } from '../pokemon/displayName';
import { createMoveLearningPromptAdapter, createMoveForgetMenuData } from '../pokemon/moveLearningPromptAdapter';
import type { EvolutionQueueEntry } from '../evolution/types';

// WebGL rendering
import { BattleWebGLContext, BATTLE_WIDTH, BATTLE_HEIGHT } from '../battle/render/BattleWebGLContext';
import {
  loadPokemonBattleSprites,
  loadBattleIntroSprites,
  loadBattleMiscSprites,
  loadTrainerFrontSprite,
  createFrontSprite,
  createBackSprite,
  createTrainerFrontSprite,
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
  drawPartyBallIndicators,
  type PartyBallState,
} from '../battle/render/BattleHealthBox';
import { BATTLE_LAYOUT } from '../battle/render/BattleLayout';

type BattlePhase = 'message' | 'action' | 'move' | 'finished';
const HP_ANIMATION_RATE = 96; // HP units per second
const EXP_ANIMATION_RATE = 0.9; // fraction of bar per second
const ENEMY_INTRO_MS = 280;
const INTRO_FRAME_MS = 1000 / 60;
const ENEMY_TRAINER_SLIDE_IN_FRAMES = 120;
const ENEMY_TRAINER_HOLD_FRAMES = 28;
const ENEMY_TRAINER_SLIDE_OUT_FRAMES = 48;
const ENEMY_TRAINER_INTRO_FRAMES = ENEMY_TRAINER_SLIDE_IN_FRAMES + ENEMY_TRAINER_HOLD_FRAMES + ENEMY_TRAINER_SLIDE_OUT_FRAMES;
const ENEMY_TRAINER_INTRO_DELAY_MS = ENEMY_TRAINER_INTRO_FRAMES * INTRO_FRAME_MS;
const TRAINER_THROW_TRANSLATE_FRAMES = 50;
const TRAINER_SEND_OUT_DELAY_FRAMES = 31;
const BALL_SEND_OUT_TASK_SETUP_FRAMES = 1;
const BALL_ARC_FRAMES = 25;
const BALL_OPEN_FRAMES = 10;
const MON_EMERGE_FRAMES = 12;
const MON_SPRITE_ANIM_FRAME_MS = 140;
const MON_SWITCH_SEND_OUT_MS = 260;
const MON_SWITCH_SPRITE_ANIM_MS = 650;
const BATTLE_TEXT_SPEED_DELAY_FRAMES: Record<'slow' | 'mid' | 'fast', number> = {
  slow: 8,
  mid: 4,
  fast: 1,
};
const TRAINER_THROW_START_X = BATTLE_LAYOUT.trainerThrow.startX;
const TRAINER_THROW_END_X = BATTLE_LAYOUT.trainerThrow.endX;
const TRAINER_THROW_Y = BATTLE_LAYOUT.trainerThrow.y;
const BALL_START_X = BATTLE_LAYOUT.trainerThrow.ballStartX;
const BALL_START_Y = BATTLE_LAYOUT.trainerThrow.ballStartY;
const BALL_ARC_AMPLITUDE = -30;
const ENEMY_TRAINER_START_X = BATTLE_LAYOUT.trainerIntro.enemyStartX;
const ENEMY_TRAINER_HOLD_X = BATTLE_LAYOUT.trainerIntro.enemyHoldX;
const ENEMY_TRAINER_END_X = BATTLE_LAYOUT.trainerIntro.enemyEndX;
const ENEMY_TRAINER_Y = BATTLE_LAYOUT.trainerIntro.enemyY;
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
  wildMoves?: readonly number[];
  terrain?: BattleTerrain;
  backgroundProfile?: BattleBackgroundProfile;
  battleType?: 'wild' | 'trainer';
  trainer?: BattleTrainerSpec;
  enemyParty?: readonly BattleEnemyPokemonSpec[];
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

interface EnemyTrainerIntroVisualState {
  show: boolean;
  x: number;
  y: number;
  alpha: number;
}

interface BattlerSendOutVisual {
  scale: number;
  yOffset: number;
  alpha: number;
}

interface BattleMessageEntry {
  text: string;
  onStart?: () => void;
}

interface PendingExpReward {
  partyIndex: number;
  gainedExp: number;
  updatedMon: PartyPokemon;
  previousLevel: number;
}

interface PendingLevelUpMoveLearning {
  partyIndex: number;
  previousLevel: number;
  updatedLevel: number;
}

export class BattleState implements StateRenderer {
  readonly id = GameState.BATTLE;

  private phase: BattlePhase = 'message';
  private messageQueue: string[] = [];
  private messageStartCallbacks: Array<(() => void) | null> = [];
  private onMessagesFinished: (() => void) | null = null;
  private messageVisibleChars = 0;
  private messageElapsedMs = 0;

  private actionIndex = 0;
  private moveIndex = 0;
  private lastSelectedMoveSlot: number | null = null;

  private engine: BattleEngine | null = null;
  private playerMon: BattlePokemon | null = null;
  private enemyMon: BattlePokemon | null = null;
  private displayedPlayerHp = 0;
  private displayedEnemyHp = 0;
  private playerHpTarget = 0;
  private enemyHpTarget = 0;
  private displayedPlayerExpPercent = 0;
  private displayedPlayerExpLevel = 1;
  private playerExpTargetPercent = 0;
  private playerExpTargetLevel = 1;
  private introElapsedMs = 0;
  private playerSendOutElapsedMs = 0;
  private playerSendOutStarted = false;
  private playerSwitchSendOutMs = 0;
  private enemySwitchSendOutMs = 0;
  private playerSwitchSpriteAnimMs = 0;
  private enemySwitchSpriteAnimMs = 0;
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
  private trainer: BattleTrainerSpec | null = null;
  private enemyPartyPreview: readonly BattleEnemyPokemonSpec[] = [];
  private enemyTrainerFrontPicId: string | null = null;
  private enemyPartyIndex = 0;
  private enemyFaintedPartySlots = new Set<number>();
  private playerPartyIndex = 0;
  private playerParticipantsForCurrentEnemy = new Set<number>();
  private playerGender: 0 | 1 = 0;
  private waitingForBattleMenu = false;
  private battleTurnCounter = 0;
  private isUnderwaterBattle = false;

  private pendingTransition: StateTransition | null = null;
  private pendingLevelUpMoveLearning: PendingLevelUpMoveLearning[] = [];
  private leveledPartySlots = new Set<number>();
  private evolutionQueue: EvolutionQueueEntry[] = [];
  private promptService = new PromptService();

  // WebGL rendering
  private webgl: BattleWebGLContext | null = null;
  private playerSpriteCoords: PokemonSpriteCoords | undefined;
  private enemySpriteCoords: PokemonSpriteCoords | undefined;

  async enter(_viewport: ViewportConfig, data?: Record<string, unknown>): Promise<void> {
    const typedData = (data ?? {}) as BattleStateData & Partial<BattleStartRequest>;
    this.returnLocation = typedData.returnLocation ?? null;
    this.returnObjectEventRuntimeState = typedData.returnObjectEventRuntimeState ?? null;
    this.firstBattle = typedData.firstBattle === true;
    this.battleType = typedData.battleType ?? 'wild';
    this.trainer = typedData.trainer ?? null;
    this.enemyPartyPreview = typedData.trainer?.party ?? typedData.enemyParty ?? [];
    this.enemyTrainerFrontPicId = null;
    this.enemyPartyIndex = 0;
    this.enemyFaintedPartySlots.clear();
    this.pendingTransition = null;
    this.pendingLevelUpMoveLearning = [];
    this.leveledPartySlots.clear();
    this.evolutionQueue = [];
    this.promptService.clear();
    this.transitionReady = false;
    this.waitingForBattleMenu = false;
    this.battleTurnCounter = 0;
    this.isUnderwaterBattle = false;
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
    this.resetPlayerParticipantsForCurrentEnemy();
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

    const fallbackSpecies = (
      Number.isFinite(typedData.wildSpecies)
      && (typedData.wildSpecies as number) > 0
    )
      ? Math.trunc(typedData.wildSpecies as number)
      : SPECIES.POOCHYENA;
    const fallbackLevel = (
      Number.isFinite(typedData.wildLevel)
      && (typedData.wildLevel as number) > 0
    )
      ? Math.trunc(typedData.wildLevel as number)
      : 2;
    const leadSpec = this.battleType === 'trainer'
      ? (this.trainer?.party[0] ?? this.enemyPartyPreview[0])
      : undefined;
    this.enemyPartyIndex = 0;
    const wildSpecies = Math.max(1, Math.trunc(leadSpec?.species ?? fallbackSpecies));
    const wildLevel = Math.max(1, Math.trunc(leadSpec?.level ?? fallbackLevel));
    const wildHeldItem = Math.max(0, Math.trunc(leadSpec?.heldItem ?? typedData.wildHeldItem ?? 0));
    const enemyMoves = this.resolveEnemyMoveSet(wildSpecies, wildLevel, leadSpec?.moves ?? typedData.wildMoves);

    if (this.battleType === 'trainer' && !this.trainer) {
      console.warn('[BattleState] Trainer battle started without typed trainer payload; using fallback enemy lead.');
    }

    const backgroundProfile: BattleBackgroundProfile = typedData.backgroundProfile ?? {
      terrain: typedData.terrain ?? 'tall_grass',
      variant: 'default',
    };
    this.isUnderwaterBattle = backgroundProfile.terrain === 'underwater';
    const wildPokemon = leadSpec
      ? this.createEnemyPartyPokemon(leadSpec)
      : createTestPokemon({
        species: wildSpecies,
        level: wildLevel,
        heldItem: wildHeldItem,
        moves: enemyMoves,
      });
    this.syncMovePpWithMoves(wildPokemon);

    this.engine = new BattleEngine({
      config: {
        type: this.battleType,
        firstBattle: this.firstBattle,
        wildSpecies,
        wildLevel,
        trainerId: this.trainer?.trainerId,
      },
      playerPokemon: { ...playerPokemon },
      enemyPokemon: wildPokemon,
    });
    this.playerMon = this.engine.getPlayer();
    this.enemyMon = this.engine.getEnemy();
    this.displayedPlayerHp = this.playerMon.currentHp;
    this.displayedEnemyHp = this.enemyMon.currentHp;
    this.playerHpTarget = this.playerMon.currentHp;
    this.enemyHpTarget = this.enemyMon.currentHp;
    this.displayedPlayerExpLevel = this.playerMon.pokemon.level;
    this.displayedPlayerExpPercent = this.getPlayerExpTarget().percent;
    this.playerExpTargetLevel = this.displayedPlayerExpLevel;
    this.playerExpTargetPercent = this.displayedPlayerExpPercent;
    this.introElapsedMs = 0;
    this.playerSendOutElapsedMs = 0;
    this.playerSendOutStarted = false;
    this.playerSwitchSendOutMs = 0;
    this.enemySwitchSendOutMs = 0;
    this.playerSwitchSpriteAnimMs = 0;
    this.enemySwitchSpriteAnimMs = 0;
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
    this.lastSelectedMoveSlot = null;
    this.phase = 'message';

    // Initialize WebGL battle renderer
    try {
      this.webgl = new BattleWebGLContext();
      const trainerFrontLoad = this.battleType === 'trainer'
        ? loadTrainerFrontSprite(this.webgl, this.trainer?.trainerPic ?? null)
        : Promise.resolve<string | null>(null);

      // Load sprites and background in parallel
      const [
        playerCoords,
        enemyCoords,
        _backgroundLoaded,
        _introLoaded,
        _miscLoaded,
        _interfaceLoaded,
        enemyTrainerFrontPicId,
      ] = await Promise.all([
        loadPokemonBattleSprites(this.webgl, playerPokemon.species),
        loadPokemonBattleSprites(this.webgl, wildSpecies),
        loadBattleBackground(this.webgl, backgroundProfile),
        loadBattleIntroSprites(this.webgl, this.playerGender),
        loadBattleMiscSprites(this.webgl),
        preloadBattleInterfaceAssets(),
        trainerFrontLoad,
      ]);
      this.playerSpriteCoords = playerCoords;
      this.enemySpriteCoords = enemyCoords;
      this.enemyTrainerFrontPicId = enemyTrainerFrontPicId;
    } catch (err) {
      console.warn('Failed to initialize battle WebGL:', err);
      this.webgl = null;
      this.enemyTrainerFrontPicId = null;
    }

    const trainerLabel = this.trainer?.trainerName?.trim() || 'Trainer';
    const introMessages = this.battleType === 'trainer'
      ? [`${trainerLabel} would like to battle!`, `${trainerLabel} sent out ${this.enemyMon.name}!`, `Go! ${this.playerMon.name}!`]
      : [`Wild ${this.enemyMon.name} appeared!`, `Go! ${this.playerMon.name}!`];

    this.queueMessages(introMessages, () => {
      this.phase = 'action';
    });
  }

  async exit(): Promise<void> {
    this.engine = null;
    this.playerMon = null;
    this.enemyMon = null;
    this.trainer = null;
    this.enemyPartyPreview = [];
    this.enemyTrainerFrontPicId = null;
    this.enemyPartyIndex = 0;
    this.enemyFaintedPartySlots.clear();
    this.playerParticipantsForCurrentEnemy.clear();
    this.lastSelectedMoveSlot = null;
    this.pendingLevelUpMoveLearning = [];
    this.leveledPartySlots.clear();
    this.evolutionQueue = [];
    this.promptService.clear();
    this.waitingForBattleMenu = false;
    this.battleTurnCounter = 0;
    this.isUnderwaterBattle = false;
    this.messageStartCallbacks = [];
    this.messageVisibleChars = 0;
    this.messageElapsedMs = 0;
    this.playerHpTarget = 0;
    this.enemyHpTarget = 0;
    this.playerExpTargetLevel = 1;
    this.playerExpTargetPercent = 0;
    this.playerSwitchSendOutMs = 0;
    this.enemySwitchSendOutMs = 0;
    this.playerSwitchSpriteAnimMs = 0;
    this.enemySwitchSpriteAnimMs = 0;
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
    this.tickMessagePrinter(_dt);
    this.promptService.tick(_dt, this.getBattleTextDelayMs());
    this.tickSwitchSendOutAnimation(_dt);
    this.playerSwitchSpriteAnimMs = Math.max(0, this.playerSwitchSpriteAnimMs - _dt);
    this.enemySwitchSpriteAnimMs = Math.max(0, this.enemySwitchSpriteAnimMs - _dt);
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

    if (this.promptService.isActive()) {
      this.promptService.handleInput({
        confirmPressed,
        cancelPressed,
        upPressed: inputMap.isPressed(input, GameButton.UP),
        downPressed: inputMap.isPressed(input, GameButton.DOWN),
      });
      return null;
    }

    if (
      menuStateManager.isMenuOpen()
      || this.waitingForBattleMenu
    ) {
      return null;
    }

    if (this.phase === 'message') {
      if (confirmPressed) {
        const activeMessage = this.messageQueue[0] ?? '';
        if (this.messageVisibleChars < activeMessage.length) {
          this.revealCurrentMessage();
          return null;
        }
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
            this.moveIndex = this.resolveInitialMoveIndex();
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
        if (this.evolutionQueue.length > 0) {
          this.pendingTransition = {
            to: GameState.EVOLUTION,
            data: {
              queue: [...this.evolutionQueue],
              returnLocation: this.returnLocation ?? undefined,
              returnObjectEventRuntimeState: this.returnObjectEventRuntimeState ?? undefined,
            },
          };
        } else {
          saveManager.stagePendingObjectEventRuntimeState(this.returnObjectEventRuntimeState);
          this.pendingTransition = {
            to: GameState.OVERWORLD,
            data: {
              savedLocation: this.returnLocation ?? undefined,
            },
          };
        }
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
    const enemyTrainerIntro = this.getEnemyTrainerIntroVisualState();

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
        const enemySendOutVisual = this.getBattlerSendOutVisual('enemy');
        const enemyIntroDelay = this.battleType === 'trainer' ? ENEMY_TRAINER_INTRO_DELAY_MS : 0;
        const enemyIntroElapsed = Math.max(0, this.introElapsedMs - enemyIntroDelay);
        const enemyProgress = Math.max(0, Math.min(1, enemyIntroElapsed / ENEMY_INTRO_MS));
        const enemyStartX = BATTLE_WIDTH + 12;
        enemySprite.worldX = Math.round(lerp(enemyStartX, enemySprite.worldX, enemyProgress));
        enemySprite.alpha = enemyProgress;
        const enemyScaledW = Math.max(1, Math.round(enemySprite.width * enemySendOutVisual.scale));
        const enemyScaledH = Math.max(1, Math.round(enemySprite.height * enemySendOutVisual.scale));
        enemySprite.worldX = Math.round(enemySprite.worldX + ((enemySprite.width - enemyScaledW) / 2));
        enemySprite.worldY = Math.round(
          enemySprite.worldY + (enemySprite.height - enemyScaledH) + enemySendOutVisual.yOffset,
        );
        enemySprite.width = enemyScaledW;
        enemySprite.height = enemyScaledH;
        enemySprite.alpha *= enemySendOutVisual.alpha;
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

      if (
        this.battleType === 'trainer'
        && this.enemyTrainerFrontPicId
        && enemyTrainerIntro.show
      ) {
        sprites.push(
          createTrainerFrontSprite(
            this.enemyTrainerFrontPicId,
            enemyTrainerIntro.x,
            enemyTrainerIntro.y,
            enemyTrainerIntro.alpha,
          ),
        );
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
        const playerSendOutVisual = this.getBattlerSendOutVisual('player');
        const scale = playerSendOut.pokemonScale * playerSendOutVisual.scale;
        const scaledW = Math.max(1, Math.round(playerSprite.width * scale));
        const scaledH = Math.max(1, Math.round(playerSprite.height * scale));
        playerSprite.worldX = Math.round(playerSprite.worldX + (playerSprite.width - scaledW) / 2);
        playerSprite.worldY = Math.round(
          playerSprite.worldY
          + (playerSprite.height - scaledH)
          + playerSendOut.pokemonYOffset
          + playerSendOutVisual.yOffset,
        );
        playerSprite.width = scaledW;
        playerSprite.height = scaledH;
        playerSprite.alpha = playerSendOutVisual.alpha;
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
    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(offsetX, offsetY, BATTLE_WIDTH, BATTLE_HEIGHT);
    ctx2d.clip();

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

    if (this.battleType === 'trainer') {
      drawPartyBallIndicators(
        ctx2d,
        offsetX,
        offsetY,
        this.getPlayerPartyBallStates(),
        this.getEnemyPartyBallStates(),
      );
    }

    this.renderStatIndicators(ctx2d, offsetX, offsetY);

    const promptRenderState = this.promptService.getRenderState();
    if (promptRenderState) {
      drawTextBox(
        ctx2d,
        offsetX,
        offsetY,
        promptRenderState.text,
        promptRenderState.visibleChars,
      );
      if (promptRenderState.type === 'yesNo' && promptRenderState.isFullyVisible) {
        drawPromptYesNo(ctx2d, offsetX, offsetY, promptRenderState.cursor ?? 0);
      }
      ctx2d.restore();
      return;
    }

    // Text box / menus
    if (this.phase === 'message') {
      const message = this.messageQueue[0] ?? '';
      drawTextBox(ctx2d, offsetX, offsetY, message, this.messageVisibleChars);
      ctx2d.restore();
      return;
    }

    if (this.phase === 'action') {
      drawActionMenu(
        ctx2d, offsetX, offsetY,
        this.actionIndex,
        player?.name ?? 'POKéMON',
        this.firstBattle,
      );
      ctx2d.restore();
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
      ctx2d.restore();
      return;
    }

    drawTextBox(ctx2d, offsetX, offsetY, 'Battle finished.');
    ctx2d.restore();
  }

  // --- Internal battle logic ---

  private queueMessages(messages: string[], onComplete?: () => void): void {
    this.queueMessageEntries(messages.map((text) => ({ text })), onComplete);
  }

  private queueMessageEntries(entries: BattleMessageEntry[], onComplete?: () => void): void {
    this.messageQueue = entries.map((entry) => entry.text);
    this.messageStartCallbacks = entries.map((entry) => entry.onStart ?? null);
    this.phase = 'message';
    this.onMessagesFinished = onComplete ?? null;
    this.processMessageQueueHead();
  }

  private advanceMessage(): void {
    if (this.messageQueue.length > 0) {
      this.messageQueue.shift();
      this.messageStartCallbacks.shift();
    }
    this.processMessageQueueHead();
  }

  private processMessageQueueHead(): void {
    while (this.messageQueue.length > 0) {
      this.runCurrentMessageStartCallback();
      const message = this.messageQueue[0] ?? '';
      if (message.length > 0) {
        this.resetMessagePrinter();
        return;
      }
      this.messageQueue.shift();
      this.messageStartCallbacks.shift();
    }

    const callback = this.onMessagesFinished;
    this.onMessagesFinished = null;
    callback?.();
    this.resetMessagePrinter();
  }

  private runCurrentMessageStartCallback(): void {
    const callback = this.messageStartCallbacks[0] ?? null;
    if (!callback) {
      return;
    }
    this.messageStartCallbacks[0] = null;
    callback();
  }

  private resetMessagePrinter(): void {
    this.messageVisibleChars = 0;
    this.messageElapsedMs = 0;
    if (this.messageQueue.length === 0) {
      return;
    }
    const nextMessage = this.messageQueue[0] ?? '';
    if (nextMessage.length === 0) {
      this.messageVisibleChars = 0;
      return;
    }
  }

  private revealCurrentMessage(): void {
    const message = this.messageQueue[0] ?? '';
    this.messageVisibleChars = message.length;
    this.messageElapsedMs = this.getBattleTextDelayMs() * Math.max(0, message.length);
  }

  private tickMessagePrinter(dt: number): void {
    if (this.phase !== 'message') {
      return;
    }
    const message = this.messageQueue[0] ?? '';
    if (message.length === 0) {
      this.messageVisibleChars = 0;
      return;
    }
    if (this.messageVisibleChars >= message.length) {
      return;
    }

    this.messageElapsedMs += dt;
    const chars = Math.floor(this.messageElapsedMs / this.getBattleTextDelayMs());
    this.messageVisibleChars = Math.max(0, Math.min(message.length, chars));
  }

  private showPromptMessage(text: string): Promise<void> {
    return this.promptService.showMessage(text);
  }

  private showPromptYesNo(text: string, defaultYes: boolean): Promise<boolean> {
    return this.promptService.showYesNo(text, defaultYes);
  }

  private getBattleTextDelayMs(): number {
    const options = saveManager.getOptions();
    const speed = options.textSpeed ?? 'mid';
    const frames = BATTLE_TEXT_SPEED_DELAY_FRAMES[speed] ?? BATTLE_TEXT_SPEED_DELAY_FRAMES.mid;
    return frames * INTRO_FRAME_MS;
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

  private resolveInitialMoveIndex(): number {
    const moves = this.getPlayerMoves();
    if (moves.length === 0) {
      return 0;
    }
    if (this.lastSelectedMoveSlot === null) {
      return 0;
    }
    const rememberedIndex = moves.findIndex((entry) => entry.moveSlot === this.lastSelectedMoveSlot);
    return rememberedIndex >= 0 ? rememberedIndex : 0;
  }

  private getPlayerPartyBallStates(): PartyBallState[] {
    const party = saveManager.getParty();
    const states: PartyBallState[] = party.map((mon, index) => {
      if (!mon) return 'empty';
      if (index === this.playerPartyIndex && this.playerMon) {
        return this.partyBallStateFromHpStatus(this.playerHpTarget, this.playerMon.pokemon.status);
      }
      return this.partyBallStateFromHpStatus(mon.stats.hp, mon.status);
    });
    return this.padPartyBallStates(states);
  }

  private getEnemyPartyBallStates(): PartyBallState[] {
    const states: PartyBallState[] = [];

    for (let i = 0; i < this.enemyPartyPreview.length; i++) {
      if (this.enemyFaintedPartySlots.has(i)) {
        states.push('fainted');
        continue;
      }
      if (i === this.enemyPartyIndex && this.enemyMon) {
        states.push(this.partyBallStateFromHpStatus(this.enemyHpTarget, this.enemyMon.pokemon.status));
        continue;
      }
      states.push('healthy');
    }

    if (states.length === 0 && this.enemyMon) {
      states.push(this.partyBallStateFromHpStatus(this.enemyHpTarget, this.enemyMon.pokemon.status));
    }

    return this.padPartyBallStates(states);
  }

  private getNextEnemyPartyIndex(): number | null {
    for (let i = this.enemyPartyIndex + 1; i < this.enemyPartyPreview.length; i++) {
      if (!this.enemyFaintedPartySlots.has(i)) {
        return i;
      }
    }
    return null;
  }

  private getNextUsablePlayerPartyIndex(): number | null {
    const party = saveManager.getParty();
    for (let i = 0; i < party.length; i++) {
      if (i === this.playerPartyIndex) continue;
      const mon = party[i];
      if (mon && mon.stats.hp > 0) {
        return i;
      }
    }
    return null;
  }

  private markPlayerPartyParticipant(partyIndex: number): void {
    if (partyIndex < 0 || partyIndex >= PARTY_SIZE) {
      return;
    }
    this.playerParticipantsForCurrentEnemy.add(partyIndex);
  }

  private resetPlayerParticipantsForCurrentEnemy(): void {
    this.playerParticipantsForCurrentEnemy.clear();
    this.markPlayerPartyParticipant(this.playerPartyIndex);
  }

  private partyBallStateFromHpStatus(hp: number, status: number): PartyBallState {
    if (hp <= 0) return 'fainted';
    if (status !== STATUS.NONE) return 'status';
    return 'healthy';
  }

  private padPartyBallStates(states: PartyBallState[]): PartyBallState[] {
    const normalized = [...states].slice(0, 6);
    while (normalized.length < 6) {
      normalized.push('empty');
    }
    return normalized;
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
    return menuStateManager.openAsync<'bag', number>('bag', { mode: 'battle' });
  }

  private openBattlePartyMenu(): Promise<number | null> {
    return menuStateManager.openAsync<'party', number>('party', {
      mode: 'battle',
      activePartyIndex: this.playerPartyIndex,
    });
  }

  private async openMoveForgetMenu(mon: PartyPokemon, moveToLearnId: number): Promise<number | null> {
    this.waitingForBattleMenu = true;
    try {
      return await menuStateManager.openAsync<'moveForget', number>('moveForget', {
        ...createMoveForgetMenuData(mon, moveToLearnId),
        mode: 'learn',
      });
    } finally {
      this.waitingForBattleMenu = false;
    }
  }

  private handleBattleItemSelection(itemId: number): void {
    if (!this.playerMon) {
      this.phase = 'action';
      return;
    }

    if (isBattlePokeBallItem(itemId)) {
      if (!bagManager.removeItem(itemId, 1)) {
        this.queueMessages([`You don't have any ${getItemName(itemId)} left!`], () => {
          this.phase = 'action';
        });
        return;
      }

      if (this.battleType === 'trainer') {
        this.executePlayerAction(
          { type: 'item', itemId },
          [
            `${saveManager.getPlayerName()} used ${getItemName(itemId)}!`,
            'The TRAINER blocked the BALL!',
            "Don't be a thief!",
          ],
        );
        return;
      }

      this.handleWildBallThrow(itemId);
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

  private handleWildBallThrow(itemId: number): void {
    const enemy = this.enemyMon;
    if (!enemy) {
      this.phase = 'action';
      return;
    }

    const enemyInfo = getSpeciesInfo(enemy.pokemon.species);
    const captureBallMultiplier = resolveBallMultiplierTenths({
      itemId,
      targetLevel: enemy.pokemon.level,
      targetTypes: enemyInfo?.types ?? ['NORMAL', 'NORMAL'],
      isUnderwater: this.isUnderwaterBattle,
      speciesCaughtBefore: saveManager.hasCaughtSpecies(enemy.pokemon.species),
      battleTurnCounter: this.battleTurnCounter,
    });
    const captureOdds = calculateCatchOdds({
      catchRate: enemyInfo?.catchRate ?? 3,
      ballMultiplierTenths: captureBallMultiplier,
      targetHp: enemy.currentHp,
      targetMaxHp: enemy.maxHp,
      targetStatus: enemy.pokemon.status,
    });
    const shakeResult = resolveCaptureShakes({
      itemId,
      odds: captureOdds,
      randomU16: () => battleRandomInt(0, 65535),
    });

    const useMessage = `${saveManager.getPlayerName()} used ${getItemName(itemId)}!`;
    if (shakeResult.caught) {
      const catchMessages = this.persistCaughtPokemonAndBuildMessages(itemId, enemy);
      this.setScriptBattleResult('B_OUTCOME_CAUGHT');
      this.queueMessages([useMessage, ...catchMessages], () => {
        this.phase = 'finished';
      });
      return;
    }

    this.executePlayerAction(
      { type: 'item', itemId },
      [useMessage, getBallEscapeMessage(shakeResult.shakes)],
    );
  }

  private persistCaughtPokemonAndBuildMessages(itemId: number, enemy: BattlePokemon): string[] {
    const caughtMon: PartyPokemon = {
      ...enemy.pokemon,
      pokeball: itemId,
      metLevel: enemy.pokemon.level,
      stats: {
        ...enemy.pokemon.stats,
        hp: Math.max(1, Math.min(enemy.maxHp, enemy.currentHp)),
      },
    };

    const party = saveManager.getParty();
    const openSlot = party.findIndex((mon) => mon === null);
    if (openSlot >= 0) {
      party[openSlot] = caughtMon;
      saveManager.setParty(party);
    }

    saveManager.registerSpeciesCaught(caughtMon.species);
    this.enemyFaintedPartySlots.add(this.enemyPartyIndex);

    const messages = [
      `Gotcha! ${enemy.name} was caught!`,
      `${enemy.name}'s data was added to the POKeDEX.`,
    ];
    if (openSlot >= 0) {
      messages.push(`${enemy.name} was added to your party.`);
    } else {
      messages.push(`${enemy.name} was sent to SOMEONE'S PC.`);
    }
    return messages;
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
      this.playerHpTarget = revivedHp;
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
        this.playerHpTarget = targetHp;
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
    const targetName = formatPokemonDisplayName(target);
    const prevSpecies = current.pokemon.species;

    party[this.playerPartyIndex] = this.toPersistedPartyPokemon(current);
    saveManager.setParty(party);

    if (target.species !== prevSpecies) {
      await this.ensurePlayerSpriteLoaded(target.species);
    }

    this.engine.replacePlayerPokemon(target, partyIndex);
    const player = this.engine.getPlayer();

    this.playerMon = player;
    this.playerPartyIndex = partyIndex;
    this.markPlayerPartyParticipant(partyIndex);
    this.displayedPlayerHp = player.currentHp;
    this.playerHpTarget = player.currentHp;
    this.displayedPlayerExpLevel = player.pokemon.level;
    this.displayedPlayerExpPercent = this.getPlayerExpTarget().percent;
    this.playerExpTargetLevel = this.displayedPlayerExpLevel;
    this.playerExpTargetPercent = this.displayedPlayerExpPercent;
    this.executePlayerAction(
      { type: 'switch', partyIndex },
      [`${currentName}, that's enough! Come back!`, `Go! ${targetName}!`],
    );
    this.startBattlerSendOutAnimation('player');
    this.startSwitchSpriteAnimation('player');
  }

  private async ensurePlayerSpriteLoaded(species: number): Promise<void> {
    if (!this.webgl) return;
    try {
      this.playerSpriteCoords = await loadPokemonBattleSprites(this.webgl, species);
    } catch (error) {
      console.warn(`[BattleState] Failed to load switched sprite for species ${species}:`, error);
    }
  }

  private async ensureEnemySpriteLoaded(species: number): Promise<void> {
    if (!this.webgl) return;
    try {
      this.enemySpriteCoords = await loadPokemonBattleSprites(this.webgl, species);
    } catch (error) {
      console.warn(`[BattleState] Failed to load enemy switched sprite for species ${species}:`, error);
    }
  }

  private executeRunAction(): void {
    this.executePlayerAction({ type: 'run' });
  }

  private executeTurn(playerMoveId: number, playerMoveSlot: number): void {
    if (!this.engine) return;
    this.lastSelectedMoveSlot = playerMoveSlot;
    this.executePlayerAction({
      type: 'fight',
      moveId: playerMoveId,
      moveSlot: playerMoveSlot,
    });
  }

  private executePlayerAction(action: BattleAction, prefixMessages: string[] = []): void {
    if (!this.engine) return;

    const result = this.engine.executeTurn(action);
    this.syncFromEngine();
    this.persistPlayerBattleState();
    if (this.didActionConsumeTurn(action)) {
      this.battleTurnCounter++;
    }

    const turnEntries = this.collectTurnMessageEntries(result.events, prefixMessages);
    turnEntries.push(...this.collectEnemyFaintExpEntries(result.events));
    this.handleTurnOutcome(result.outcome, turnEntries);
  }

  private didActionConsumeTurn(action: BattleAction): boolean {
    if (action.type !== 'run') {
      return true;
    }
    return !(this.battleType === 'trainer' || this.firstBattle);
  }

  private collectTurnMessageEntries(events: BattleEvent[], prefixMessages: string[]): BattleMessageEntry[] {
    const entries: BattleMessageEntry[] = prefixMessages.map((text) => ({ text }));

    for (const event of events) {
      const message = event.message?.trim() ?? '';
      const onStart = this.createEventStepCallback(event);
      if (message.length > 0) {
        entries.push({
          text: message,
          onStart: onStart ?? undefined,
        });
        continue;
      }
      if (onStart) {
        entries.push({
          text: '',
          onStart,
        });
      }
    }

    if (entries.length === 0) {
      entries.push({ text: '...' });
    }
    return entries;
  }

  private createEventStepCallback(event: BattleEvent): (() => void) | null {
    const effects: Array<() => void> = [];
    const hpDelta = this.resolveEventHpDelta(event);

    if (hpDelta !== 0 && event.battler !== undefined) {
      effects.push(() => {
        this.applyHpDeltaTarget(event.battler ?? 0, hpDelta);
      });
    }

    if (event.type === 'faint' && event.battler !== undefined) {
      effects.push(() => {
        this.setHpTarget(event.battler ?? 0, 0);
      });
    }

    if (event.type === 'damage') {
      effects.push(() => {
        this.applyMoveAnimationFromEvent(event);
      });
    }

    if (event.type === 'stat_change') {
      effects.push(() => {
        this.applyStatIndicatorFromEvent(event);
      });
    }

    if (effects.length === 0) {
      return null;
    }
    return () => {
      for (const effect of effects) {
        effect();
      }
    };
  }

  private resolveEventHpDelta(event: BattleEvent): number {
    const amount = event.value ?? 0;
    if (amount === 0) {
      return 0;
    }

    switch (event.type) {
      case 'damage':
      case 'weather_damage':
      case 'hurt_by_status':
      case 'confusion_self_hit':
      case 'recoil':
        return -amount;
      case 'heal':
      case 'drain':
        return amount;
      default:
        return 0;
    }
  }

  private collectEnemyFaintExpEntries(events: BattleEvent[]): BattleMessageEntry[] {
    const enemyFainted = events.some((event) => event.type === 'faint' && event.battler === 1);
    if (!enemyFainted) {
      return [];
    }
    if (!this.enemyMon) {
      return [];
    }

    const party = saveManager.getParty();
    if (party.length === 0) {
      return [];
    }

    const enemyInfo = getSpeciesInfo(this.enemyMon.pokemon.species);
    const expDistribution = calculateFaintExpDistribution({
      baseExpYield: enemyInfo?.expYield ?? 0,
      faintedLevel: this.enemyMon.pokemon.level,
      trainerBattle: this.battleType === 'trainer',
      party: party.map((mon, index) => ({
        isPresent: mon !== null,
        level: mon?.level ?? 0,
        hp: mon?.stats.hp ?? 0,
        heldItem: mon?.heldItem ?? ITEMS.ITEM_NONE,
        participated: this.playerParticipantsForCurrentEnemy.has(index),
      })),
    });

    const pendingRewards: PendingExpReward[] = [];
    for (let i = 0; i < PARTY_SIZE; i++) {
      const gainedExp = expDistribution[i] ?? 0;
      const mon = party[i];
      if (gainedExp <= 0 || !mon) {
        continue;
      }

      const previousLevel = mon.level;
      let updatedMon: PartyPokemon = {
        ...mon,
        experience: mon.experience + gainedExp,
      };
      updatedMon = recalculatePartyStatsCStyle(updatedMon);
      pendingRewards.push({
        partyIndex: i,
        gainedExp,
        updatedMon,
        previousLevel,
      });

      if (updatedMon.level > previousLevel) {
        this.pendingLevelUpMoveLearning.push({
          partyIndex: i,
          previousLevel,
          updatedLevel: updatedMon.level,
        });
      }
    }

    const entries: BattleMessageEntry[] = [];
    for (const reward of pendingRewards) {
      const monName = formatPokemonDisplayName(reward.updatedMon);
      entries.push({
        text: `${monName} gained ${reward.gainedExp} EXP. Points!`,
        onStart: () => {
          this.applyPendingExpReward(reward);
        },
      });
      if (reward.updatedMon.level > reward.previousLevel) {
        entries.push({
          text: `${monName} grew to Lv. ${reward.updatedMon.level}!`,
        });
      }
    }
    return entries;
  }

  private applyPendingExpReward(reward: PendingExpReward): void {
    const party = saveManager.getParty();
    if (!party[reward.partyIndex]) {
      return;
    }
    party[reward.partyIndex] = {
      ...reward.updatedMon,
      stats: {
        ...reward.updatedMon.stats,
      },
    };
    saveManager.setParty(party);

    if (reward.partyIndex !== this.playerPartyIndex || !this.playerMon) {
      return;
    }

    const monName = formatPokemonDisplayName(reward.updatedMon);
    this.playerMon.pokemon = {
      ...reward.updatedMon,
      stats: {
        ...reward.updatedMon.stats,
      },
    };
    this.playerMon.name = monName;
    this.playerMon.currentHp = reward.updatedMon.stats.hp;
    this.playerMon.maxHp = reward.updatedMon.stats.maxHp;
    this.playerHpTarget = reward.updatedMon.stats.hp;
    const target = this.getPlayerExpTarget();
    this.playerExpTargetLevel = target.level;
    this.playerExpTargetPercent = target.percent;
  }

  private async runPendingLevelUpMoveLearning(): Promise<void> {
    if (this.pendingLevelUpMoveLearning.length === 0) {
      return;
    }

    const pending = [...this.pendingLevelUpMoveLearning];
    this.pendingLevelUpMoveLearning = [];

    for (const entry of pending) {
      const party = saveManager.getParty();
      const mon = party[entry.partyIndex];
      if (!mon) {
        continue;
      }

      if (entry.updatedLevel > entry.previousLevel) {
        this.leveledPartySlots.add(entry.partyIndex);
      }

      const movesToLearn = getLevelUpMovesBetween(
        mon.species,
        entry.previousLevel,
        entry.updatedLevel,
      );
      if (movesToLearn.length === 0) {
        continue;
      }

      const prompts = createMoveLearningPromptAdapter(
        {
          showMessage: (text) => this.showPromptMessage(text),
          showYesNo: (text, defaultYes) => this.showPromptYesNo(text, defaultYes),
        },
        {
          openMoveForgetMenu: (pokemon, moveId) => this.openMoveForgetMenu(pokemon, moveId),
        },
      );
      const result = await runMoveLearningSequence(mon, movesToLearn, prompts);

      const latestParty = saveManager.getParty();
      if (!latestParty[entry.partyIndex]) {
        continue;
      }
      latestParty[entry.partyIndex] = result.pokemon;
      saveManager.setParty(latestParty);

      if (entry.partyIndex === this.playerPartyIndex && this.playerMon) {
        const updatedMon = latestParty[entry.partyIndex];
        if (updatedMon) {
          this.playerMon.pokemon = {
            ...updatedMon,
            stats: {
              ...updatedMon.stats,
            },
          };
          this.playerMon.name = formatPokemonDisplayName(updatedMon);
          this.playerMon.currentHp = updatedMon.stats.hp;
          this.playerMon.maxHp = updatedMon.stats.maxHp;
          this.playerHpTarget = updatedMon.stats.hp;
        }
      }
    }
  }

  private queueTurnMessagesAndContinue(
    turnMessages: BattleMessageEntry[],
    onComplete: () => void | Promise<void>,
  ): void {
    const runContinuation = async (): Promise<void> => {
      await this.runPendingLevelUpMoveLearning();
      await onComplete();
    };

    if (turnMessages.length === 0) {
      void runContinuation();
      return;
    }

    this.queueMessageEntries(turnMessages, () => {
      void runContinuation();
    });
  }

  private buildEvolutionQueue(): EvolutionQueueEntry[] {
    const party = saveManager.getParty();
    const queue: EvolutionQueueEntry[] = [];
    const sortedSlots = [...this.leveledPartySlots].sort((a, b) => a - b);

    for (const partyIndex of sortedSlots) {
      const mon = party[partyIndex];
      if (!mon) {
        continue;
      }
      const targetSpecies = getEvolutionTargetSpecies(
        mon,
        EVOLUTION_MODES.EVO_MODE_NORMAL,
      );
      if (targetSpecies <= 0) {
        continue;
      }
      queue.push({
        partyIndex,
        targetSpecies,
        canStop: true,
      });
    }

    return queue;
  }

  private handleTurnOutcome(outcome: BattleOutcome | null, turnMessages: BattleMessageEntry[]): void {
    if (outcome === 'win' && this.tryContinueTrainerBattleAfterEnemyFaint(turnMessages)) {
      return;
    }

    if (outcome === 'lose' && this.tryContinueBattleAfterPlayerFaint(turnMessages)) {
      return;
    }

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
      this.queueTurnMessagesAndContinue(turnMessages, () => {
        this.phase = 'finished';
      });
      return;
    }

    this.queueTurnMessagesAndContinue(turnMessages, () => {
      this.phase = 'action';
    });
  }

  private tryContinueTrainerBattleAfterEnemyFaint(turnMessages: BattleMessageEntry[]): boolean {
    if (this.battleType !== 'trainer' || !this.engine || !this.enemyMon) {
      return false;
    }

    this.enemyFaintedPartySlots.add(this.enemyPartyIndex);
    const nextEnemyIndex = this.getNextEnemyPartyIndex();
    if (nextEnemyIndex === null) {
      return false;
    }

    const nextEnemySpec = this.enemyPartyPreview[nextEnemyIndex];
    if (!nextEnemySpec) {
      return false;
    }

    const trainerLabel = this.trainer?.trainerName?.trim() || 'Trainer';
    this.queueTurnMessagesAndContinue(turnMessages, () => {
      void this.sendOutTrainerReplacement(nextEnemyIndex, nextEnemySpec, trainerLabel);
    });
    return true;
  }

  private tryContinueBattleAfterPlayerFaint(turnMessages: BattleMessageEntry[]): boolean {
    if (!this.engine || !this.playerMon) {
      return false;
    }

    const nextPartyIndex = this.getNextUsablePlayerPartyIndex();
    if (nextPartyIndex === null) {
      return false;
    }

    const party = saveManager.getParty();
    const current = party[this.playerPartyIndex];
    if (current) {
      party[this.playerPartyIndex] = {
        ...current,
        stats: {
          ...current.stats,
          hp: 0,
        },
      };
    }

    const nextPartyMon = party[nextPartyIndex];
    if (!nextPartyMon || nextPartyMon.stats.hp <= 0) {
      saveManager.setParty(party);
      return false;
    }
    saveManager.setParty(party);

    this.queueTurnMessagesAndContinue(turnMessages, () => {
      void this.sendOutPlayerReplacement(nextPartyIndex, nextPartyMon);
    });
    return true;
  }

  private async sendOutTrainerReplacement(
    nextEnemyIndex: number,
    nextEnemySpec: BattleEnemyPokemonSpec,
    trainerLabel: string,
  ): Promise<void> {
    if (!this.engine) {
      return;
    }

    const previousSpecies = this.enemyMon?.pokemon.species ?? 0;
    const nextEnemyPokemon = this.createEnemyPartyPokemon(nextEnemySpec);
    if (nextEnemyPokemon.species !== previousSpecies) {
      await this.ensureEnemySpriteLoaded(nextEnemyPokemon.species);
    }

    this.enemyPartyIndex = nextEnemyIndex;
    this.engine.replaceEnemyPokemon(nextEnemyPokemon, nextEnemyIndex);
    this.syncFromEngine();
    this.resetPlayerParticipantsForCurrentEnemy();
    this.displayedEnemyHp = this.enemyMon?.currentHp ?? this.displayedEnemyHp;
    this.enemyHpTarget = this.enemyMon?.currentHp ?? this.enemyHpTarget;
    this.enemyFaintProgress = 0;
    this.startBattlerSendOutAnimation('enemy');
    this.startSwitchSpriteAnimation('enemy');

    const nextEnemyName = this.enemyMon?.name ?? getSpeciesName(nextEnemyPokemon.species);
    this.queueMessages([`${trainerLabel} sent out ${nextEnemyName}!`], () => {
      this.phase = 'action';
    });
  }

  private async sendOutPlayerReplacement(
    nextPartyIndex: number,
    nextPartyMon: PartyPokemon,
  ): Promise<void> {
    if (!this.engine) {
      return;
    }

    const previousSpecies = this.playerMon?.pokemon.species ?? 0;
    if (nextPartyMon.species !== previousSpecies) {
      await this.ensurePlayerSpriteLoaded(nextPartyMon.species);
    }

    this.engine.replacePlayerPokemon(nextPartyMon, nextPartyIndex);
    this.syncFromEngine();
    this.playerPartyIndex = nextPartyIndex;
    this.markPlayerPartyParticipant(nextPartyIndex);
    this.playerFaintProgress = 0;
    this.displayedPlayerHp = this.playerMon?.currentHp ?? this.displayedPlayerHp;
    this.playerHpTarget = this.playerMon?.currentHp ?? this.playerHpTarget;
    this.displayedPlayerExpLevel = this.playerMon?.pokemon.level ?? this.displayedPlayerExpLevel;
    this.displayedPlayerExpPercent = this.getPlayerExpTarget().percent;
    this.playerExpTargetLevel = this.displayedPlayerExpLevel;
    this.playerExpTargetPercent = this.displayedPlayerExpPercent;
    this.persistPlayerBattleState();
    this.startBattlerSendOutAnimation('player');
    this.startSwitchSpriteAnimation('player');

    const nextName = this.playerMon?.name ?? getSpeciesName(nextPartyMon.species);
    this.queueMessages([`Go! ${nextName}!`], () => {
      this.phase = 'action';
    });
  }

  private applyMoveAnimationFromEvent(event: BattleEvent): void {
    if (event.type !== 'damage') {
      return;
    }
    const sequence = event.moveId !== undefined
      ? MOVE_ANIMATIONS.get(event.moveId) ?? DEFAULT_MOVE_ANIMATION
      : DEFAULT_MOVE_ANIMATION;

    this.moveFlashMs = sequence.flashDurationMs;
    this.moveFlashColor = sequence.flashColor;

    if (event.battler === 0) {
      this.playerDamageFlashMs = 220;
    } else if (event.battler === 1) {
      this.enemyDamageFlashMs = 220;
    }
  }

  private tickStatIndicators(dt: number): void {
    for (const indicator of this.statIndicators) {
      indicator.ttlMs = Math.max(0, indicator.ttlMs - dt);
    }
    this.statIndicators = this.statIndicators.filter((indicator) => indicator.ttlMs > 0);
  }

  private applyStatIndicatorFromEvent(event: BattleEvent): void {
    if (event.type !== 'stat_change' || !event.value || !event.detail) {
      return;
    }
    if (event.value === 0) {
      return;
    }

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
      ctx.font = 'bold 8px "Pokemon Emerald", monospace';
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
  private getEnemyTrainerIntroVisualState(): EnemyTrainerIntroVisualState {
    if (this.battleType !== 'trainer' || !this.enemyTrainerFrontPicId) {
      return {
        show: false,
        x: ENEMY_TRAINER_END_X,
        y: ENEMY_TRAINER_Y,
        alpha: 0,
      };
    }

    const frame = this.introElapsedMs / INTRO_FRAME_MS;
    if (frame < ENEMY_TRAINER_SLIDE_IN_FRAMES) {
      const t = clamp(frame / ENEMY_TRAINER_SLIDE_IN_FRAMES, 0, 1);
      return {
        show: true,
        x: lerp(ENEMY_TRAINER_START_X, ENEMY_TRAINER_HOLD_X, t),
        y: ENEMY_TRAINER_Y,
        alpha: 1,
      };
    }

    if (frame < ENEMY_TRAINER_SLIDE_IN_FRAMES + ENEMY_TRAINER_HOLD_FRAMES) {
      return {
        show: true,
        x: ENEMY_TRAINER_HOLD_X,
        y: ENEMY_TRAINER_Y,
        alpha: 1,
      };
    }

    if (frame < ENEMY_TRAINER_INTRO_FRAMES) {
      const t = clamp(
        (frame - ENEMY_TRAINER_SLIDE_IN_FRAMES - ENEMY_TRAINER_HOLD_FRAMES) / ENEMY_TRAINER_SLIDE_OUT_FRAMES,
        0,
        1,
      );
      return {
        show: true,
        x: lerp(ENEMY_TRAINER_HOLD_X, ENEMY_TRAINER_END_X, t),
        y: ENEMY_TRAINER_Y,
        alpha: Math.max(0, 1 - (t * 0.25)),
      };
    }

    return {
      show: false,
      x: ENEMY_TRAINER_END_X,
      y: ENEMY_TRAINER_Y,
      alpha: 0,
    };
  }

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
    let ballX: number = BALL_START_X;
    let ballY: number = BALL_START_Y;

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

  private tickSwitchSendOutAnimation(dt: number): void {
    if (this.playerSwitchSendOutMs > 0) {
      this.playerSwitchSendOutMs = Math.min(MON_SWITCH_SEND_OUT_MS, this.playerSwitchSendOutMs + dt);
      if (this.playerSwitchSendOutMs >= MON_SWITCH_SEND_OUT_MS) {
        this.playerSwitchSendOutMs = 0;
      }
    }
    if (this.enemySwitchSendOutMs > 0) {
      this.enemySwitchSendOutMs = Math.min(MON_SWITCH_SEND_OUT_MS, this.enemySwitchSendOutMs + dt);
      if (this.enemySwitchSendOutMs >= MON_SWITCH_SEND_OUT_MS) {
        this.enemySwitchSendOutMs = 0;
      }
    }
  }

  private startBattlerSendOutAnimation(side: 'player' | 'enemy'): void {
    if (side === 'player') {
      this.playerSwitchSendOutMs = 1;
      return;
    }
    this.enemySwitchSendOutMs = 1;
  }

  private startSwitchSpriteAnimation(side: 'player' | 'enemy'): void {
    if (side === 'player') {
      this.playerSwitchSpriteAnimMs = MON_SWITCH_SPRITE_ANIM_MS;
      return;
    }
    this.enemySwitchSpriteAnimMs = MON_SWITCH_SPRITE_ANIM_MS;
  }

  private getBattlerSendOutVisual(side: 'player' | 'enemy'): BattlerSendOutVisual {
    const elapsed = side === 'player' ? this.playerSwitchSendOutMs : this.enemySwitchSendOutMs;
    if (elapsed <= 0) {
      return { scale: 1, yOffset: 0, alpha: 1 };
    }
    const t = clamp(elapsed / MON_SWITCH_SEND_OUT_MS, 0, 1);
    return {
      scale: lerp(0.25, 1, t),
      yOffset: Math.round((1 - t) * 12),
      alpha: t,
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
    if (this.playerHpTarget === 0) {
      this.playerFaintProgress = Math.min(1, this.playerFaintProgress + (dt / 420));
    } else {
      this.playerFaintProgress = 0;
    }

    if (this.enemyHpTarget === 0) {
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

    const switchAnimRemaining = side === 'front' ? this.enemySwitchSpriteAnimMs : this.playerSwitchSpriteAnimMs;
    const switchAnimElapsed = switchAnimRemaining > 0
      ? MON_SWITCH_SPRITE_ANIM_MS - switchAnimRemaining
      : -1;
    if (switchAnimElapsed >= 0) {
      const elapsedFrames = Math.floor(switchAnimElapsed / MON_SPRITE_ANIM_FRAME_MS);
      return elapsedFrames % frameCount;
    }

    if (side === 'front') {
      const introDelay = this.battleType === 'trainer' ? ENEMY_TRAINER_INTRO_DELAY_MS : 0;
      const introElapsed = this.introElapsedMs - introDelay;
      if (introElapsed < 0 || introElapsed > MON_SWITCH_SPRITE_ANIM_MS) {
        return 0;
      }
      const elapsedFrames = Math.floor(introElapsed / MON_SPRITE_ANIM_FRAME_MS);
      return elapsedFrames % frameCount;
    }

    if (!this.playerSendOutStarted) {
      return 0;
    }
    const playerIntroStartMs = this.getPlayerIntroPokemonShowMs();
    const playerIntroElapsed = this.playerSendOutElapsedMs - playerIntroStartMs;
    if (playerIntroElapsed < 0 || playerIntroElapsed > MON_SWITCH_SPRITE_ANIM_MS) {
      return 0;
    }
    const elapsedFrames = Math.floor(playerIntroElapsed / MON_SPRITE_ANIM_FRAME_MS);
    return elapsedFrames % frameCount;
  }

  private getPlayerIntroPokemonShowMs(): number {
    const showFrame = TRAINER_SEND_OUT_DELAY_FRAMES + BALL_SEND_OUT_TASK_SETUP_FRAMES + BALL_ARC_FRAMES;
    return showFrame * INTRO_FRAME_MS;
  }

  private resolveEnemyMoveSet(
    species: number,
    level: number,
    explicitMoves?: readonly number[],
  ): [number, number, number, number] {
    const resolvedExplicit = (explicitMoves ?? [])
      .filter((moveId) => Number.isFinite(moveId) && moveId > 0)
      .map((moveId) => Math.trunc(moveId));
    if (resolvedExplicit.length > 0) {
      return toMoveSet(resolvedExplicit);
    }

    const learnedMoves = getMovesAtLevel(species, level);
    if (learnedMoves.length > 0) {
      return toMoveSet(learnedMoves);
    }

    return toMoveSet([MOVES.TACKLE]);
  }

  private resolveTrainerIvSet(rawTrainerIv?: number): IVs | undefined {
    if (!Number.isFinite(rawTrainerIv)) {
      return undefined;
    }
    const fixedIv = scaleTrainerIvToBattleIv(Math.trunc(rawTrainerIv ?? 0));
    return {
      hp: fixedIv,
      attack: fixedIv,
      defense: fixedIv,
      speed: fixedIv,
      spAttack: fixedIv,
      spDefense: fixedIv,
    };
  }

  private createEnemyPartyPokemon(spec: BattleEnemyPokemonSpec): PartyPokemon {
    const enemyPokemon = createTestPokemon({
      species: Math.max(1, Math.trunc(spec.species)),
      level: Math.max(1, Math.trunc(spec.level)),
      heldItem: Math.max(0, Math.trunc(spec.heldItem ?? 0)),
      ivs: this.resolveTrainerIvSet(spec.iv),
      moves: this.resolveEnemyMoveSet(spec.species, spec.level, spec.moves),
    });
    this.syncMovePpWithMoves(enemyPokemon);
    return enemyPokemon;
  }

  private syncMovePpWithMoves(mon: PartyPokemon): void {
    for (let slot = 0; slot < 4; slot++) {
      const moveId = mon.moves[slot] ?? 0;
      if (moveId <= 0) {
        mon.pp[slot] = 0;
        continue;
      }
      mon.pp[slot] = getMoveInfo(moveId)?.pp ?? mon.pp[slot] ?? 0;
    }
  }

  private syncFromEngine(): void {
    if (!this.engine) return;
    const previousPlayerSpecies = this.playerMon?.pokemon.species ?? null;
    const previousEnemySpecies = this.enemyMon?.pokemon.species ?? null;
    this.playerMon = this.engine.getPlayer();
    this.enemyMon = this.engine.getEnemy();
    const nextPlayerSpecies = this.playerMon?.pokemon.species ?? null;
    const nextEnemySpecies = this.enemyMon?.pokemon.species ?? null;

    if (
      nextPlayerSpecies !== null
      && previousPlayerSpecies !== null
      && nextPlayerSpecies !== previousPlayerSpecies
    ) {
      void this.ensurePlayerSpriteLoaded(nextPlayerSpecies);
      this.startSwitchSpriteAnimation('player');
    }
    if (
      nextEnemySpecies !== null
      && previousEnemySpecies !== null
      && nextEnemySpecies !== previousEnemySpecies
    ) {
      void this.ensureEnemySpriteLoaded(nextEnemySpecies);
      this.startSwitchSpriteAnimation('enemy');
    }
  }

  private tickHpAnimation(dt: number): void {
    this.displayedPlayerHp = this.stepDisplayedHp(this.displayedPlayerHp, this.playerHpTarget, dt);
    this.displayedEnemyHp = this.stepDisplayedHp(this.displayedEnemyHp, this.enemyHpTarget, dt);
  }

  private tickExpAnimation(dt: number): void {
    const target = {
      level: this.playerExpTargetLevel,
      percent: this.playerExpTargetPercent,
    };
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
      return { level: mon.level, percent: 0 };
    }

    const currentLevelExp = getExpForLevel(growthRate, mon.level);
    const nextLevelExp = getExpForLevel(growthRate, mon.level + 1);
    const levelRange = Math.max(1, nextLevelExp - currentLevelExp);
    const progress = Math.max(0, mon.experience - currentLevelExp);
    const percent = Math.max(0, Math.min(1, progress / levelRange));
    return { level: mon.level, percent };
  }

  private applyHpDeltaTarget(battler: number, hpDelta: number): void {
    if (hpDelta === 0) {
      return;
    }
    const current = battler === 1 ? this.enemyHpTarget : this.playerHpTarget;
    this.setHpTarget(battler, current + hpDelta);
  }

  private setHpTarget(battler: number, value: number): void {
    if (battler === 1) {
      const maxHp = this.enemyMon?.maxHp ?? 0;
      this.enemyHpTarget = Math.max(0, Math.min(maxHp, value));
      return;
    }
    const maxHp = this.playerMon?.maxHp ?? 0;
    this.playerHpTarget = Math.max(0, Math.min(maxHp, value));
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

  private handleWin(turnMessages: BattleMessageEntry[]): void {
    const player = this.playerMon;
    if (!player) return;
    this.enemyFaintedPartySlots.add(this.enemyPartyIndex);

    this.setScriptBattleResult('B_OUTCOME_WON');
    this.persistPlayerBattleState();

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
      this.playerHpTarget = this.playerMon?.currentHp ?? this.playerHpTarget;
    }

    this.queueTurnMessagesAndContinue(turnMessages, () => {
      this.evolutionQueue = this.buildEvolutionQueue();
      this.phase = 'finished';
    });
  }

  private handleLoss(
    turnMessages: BattleMessageEntry[],
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
    this.playerHpTarget = 0;

    this.setScriptBattleResult(outcome);
    turnMessages.push({
      text: outcome === 'B_OUTCOME_DREW'
        ? 'The battle ended in a draw...'
        : 'You lost the battle...',
    });
    this.queueTurnMessagesAndContinue(turnMessages, () => {
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

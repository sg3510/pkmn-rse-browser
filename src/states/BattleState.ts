/**
 * MVP single battle state (starter vs wild Poochyena).
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
import type { ViewportConfig } from '../config/viewport';
import type { LocationState } from '../save/types';
import { saveManager } from '../save/SaveManager';
import { gameFlags } from '../game/GameFlags';
import { gameVariables, GAME_VARS } from '../game/GameVariables';
import { SPECIES, getSpeciesName } from '../data/species';
import { getMoveInfo, getMoveName, MOVES } from '../data/moves';
import { getSpeciesInfo } from '../data/speciesInfo';
import { calculateLevelFromExp, recalculatePartyStats } from '../pokemon/stats';
import { createTestPokemon } from '../pokemon/testFactory';
import type { PartyPokemon } from '../pokemon/types';

type BattlePhase = 'message' | 'action' | 'move' | 'finished';
type BattleAction = 'FIGHT' | 'BAG' | 'POKEMON' | 'RUN';

interface BattleStateData {
  playerPokemon?: PartyPokemon;
  wildSpecies?: number;
  wildLevel?: number;
  returnLocation?: LocationState;
  firstBattle?: boolean;
}

interface BattleMon {
  pokemon: PartyPokemon;
  name: string;
  currentHp: number;
  maxHp: number;
  attackStage: number;
  defenseStage: number;
}

const ACTIONS: BattleAction[] = ['FIGHT', 'BAG', 'POKEMON', 'RUN'];
const PHYSICAL_TYPES = new Set([
  'NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BUG', 'GHOST', 'STEEL',
]);

function clampStage(value: number): number {
  if (value < -6) return -6;
  if (value > 6) return 6;
  return value;
}

function applyStage(stat: number, stage: number): number {
  if (stage >= 0) {
    return Math.floor((stat * (2 + stage)) / 2);
  }
  return Math.floor((stat * 2) / (2 - stage));
}

function randomIntInclusive(min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function getTypeEffectiveness(_moveType: string, _targetTypes: [string, string]): number {
  // First-battle types in this MVP all resolve to neutral multipliers.
  return 1;
}

export class BattleState implements StateRenderer {
  readonly id = GameState.BATTLE;

  private phase: BattlePhase = 'message';
  private messageQueue: string[] = [];
  private onMessagesFinished: (() => void) | null = null;

  private actionIndex = 0;
  private moveIndex = 0;

  private playerMon: BattleMon | null = null;
  private enemyMon: BattleMon | null = null;
  private returnLocation: LocationState | null = null;
  private firstBattle = false;

  private pendingTransition: StateTransition | null = null;

  async enter(_viewport: ViewportConfig, data?: Record<string, unknown>): Promise<void> {
    const typedData = (data ?? {}) as BattleStateData;
    this.returnLocation = typedData.returnLocation ?? null;
    this.firstBattle = typedData.firstBattle === true;
    this.pendingTransition = null;

    const playerFromData = typedData.playerPokemon;
    const playerFromSave = saveManager.getParty().find((mon): mon is PartyPokemon => mon !== null) ?? null;
    const playerPokemon = playerFromData ?? playerFromSave;
    if (!playerPokemon) {
      throw new Error('BattleState requires a player Pokemon.');
    }

    const wildSpecies = typedData.wildSpecies ?? SPECIES.POOCHYENA;
    const wildLevel = typedData.wildLevel ?? 2;
    const wildPokemon = createTestPokemon({
      species: wildSpecies,
      level: wildLevel,
      moves: [MOVES.TACKLE, 0, 0, 0],
    });

    this.playerMon = {
      pokemon: { ...playerPokemon },
      name: getSpeciesName(playerPokemon.species),
      currentHp: playerPokemon.stats.hp,
      maxHp: playerPokemon.stats.maxHp,
      attackStage: 0,
      defenseStage: 0,
    };

    this.enemyMon = {
      pokemon: wildPokemon,
      name: getSpeciesName(wildPokemon.species),
      currentHp: wildPokemon.stats.hp,
      maxHp: wildPokemon.stats.maxHp,
      attackStage: 0,
      defenseStage: 0,
    };

    this.actionIndex = 0;
    this.moveIndex = 0;
    this.phase = 'message';

    this.queueMessages([
      `Wild ${this.enemyMon.name} appeared!`,
      `Go! ${this.playerMon.name}!`,
    ], () => {
      this.phase = 'action';
    });
  }

  async exit(): Promise<void> {
    // No-op.
  }

  update(_dt: number, _frameCount: number): void {
    // Turn progression is input-driven.
  }

  handleInput(input: InputState): StateTransition | null {
    if (this.pendingTransition) {
      return this.pendingTransition;
    }

    const confirmPressed = input.pressed.has('Enter') || input.pressed.has('KeyZ') || input.pressed.has('Space');
    const cancelPressed = input.pressed.has('Escape') || input.pressed.has('KeyX');

    if (this.phase === 'message') {
      if (confirmPressed) {
        this.advanceMessage();
      }
      return null;
    }

    if (this.phase === 'action') {
      if (input.pressed.has('ArrowUp')) {
        this.actionIndex = this.actionIndex === 0 ? 2 : this.actionIndex - 2;
      }
      if (input.pressed.has('ArrowDown')) {
        this.actionIndex = this.actionIndex >= 2 ? this.actionIndex - 2 : this.actionIndex + 2;
      }
      if (input.pressed.has('ArrowLeft')) {
        this.actionIndex = this.actionIndex % 2 === 0 ? this.actionIndex + 1 : this.actionIndex - 1;
      }
      if (input.pressed.has('ArrowRight')) {
        this.actionIndex = this.actionIndex % 2 === 0 ? this.actionIndex + 1 : this.actionIndex - 1;
      }

      if (confirmPressed) {
        const action = ACTIONS[this.actionIndex];
        if (action === 'FIGHT') {
          this.phase = 'move';
          this.moveIndex = 0;
        } else if (this.firstBattle) {
          this.queueMessages(["There's no time for that!"], () => {
            this.phase = 'action';
          });
        } else {
          this.queueMessages(['This option is not implemented yet.'], () => {
            this.phase = 'action';
          });
        }
      }

      return null;
    }

    if (this.phase === 'move') {
      const moves = this.getPlayerMoveIds();
      if (moves.length === 0) {
        this.phase = 'action';
        return null;
      }

      if (input.pressed.has('ArrowUp')) {
        this.moveIndex = (this.moveIndex - 1 + moves.length) % moves.length;
      }
      if (input.pressed.has('ArrowDown')) {
        this.moveIndex = (this.moveIndex + 1) % moves.length;
      }

      if (cancelPressed) {
        this.phase = 'action';
        return null;
      }

      if (confirmPressed) {
        const selectedMove = moves[this.moveIndex];
        this.executeTurn(selectedMove);
      }

      return null;
    }

    if (this.phase === 'finished' && confirmPressed) {
      this.pendingTransition = {
        to: GameState.OVERWORLD,
        data: {
          savedLocation: this.returnLocation ?? undefined,
        },
      };
      return this.pendingTransition;
    }

    return null;
  }

  render(context: RenderContext): void {
    const { ctx2d, viewport } = context;
    const width = viewport.width;
    const height = viewport.height;

    const player = this.playerMon;
    const enemy = this.enemyMon;

    ctx2d.fillStyle = '#d7e9bc';
    ctx2d.fillRect(0, 0, width, height);

    // Enemy panel
    if (enemy) {
      this.drawPanel(ctx2d, 12, 14, 112, 30, `${enemy.name} Lv${enemy.pokemon.level}`, enemy.currentHp, enemy.maxHp, false);
      ctx2d.fillStyle = '#6f8052';
      ctx2d.fillRect(width - 72, 28, 44, 28);
    }

    // Player panel
    if (player) {
      this.drawPanel(ctx2d, width - 126, 74, 114, 40, `${player.name} Lv${player.pokemon.level}`, player.currentHp, player.maxHp, true);
      ctx2d.fillStyle = '#5e6f49';
      ctx2d.fillRect(24, 74, 46, 34);
    }

    // Text / menus
    ctx2d.fillStyle = '#203040';
    ctx2d.fillRect(0, height - 52, width, 52);
    ctx2d.strokeStyle = '#8fa6ba';
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(0, height - 52, width, 52);

    ctx2d.fillStyle = '#f3fbff';
    ctx2d.font = '10px monospace';
    ctx2d.textAlign = 'left';
    ctx2d.textBaseline = 'top';

    if (this.phase === 'message') {
      const message = this.messageQueue[0] ?? '';
      ctx2d.fillText(message, 8, height - 44);
      ctx2d.fillStyle = '#aac3d8';
      ctx2d.fillText('Z / Enter', width - 72, height - 20);
      return;
    }

    if (this.phase === 'action') {
      const prompt = player ? `What will ${player.name} do?` : 'What will you do?';
      ctx2d.fillText(prompt, 8, height - 44);
      this.drawActionMenu(ctx2d, width, height);
      return;
    }

    if (this.phase === 'move') {
      this.drawMoveMenu(ctx2d, width, height);
      return;
    }

    ctx2d.fillText('Battle finished. Press Z / Enter.', 8, height - 44);
  }

  private drawPanel(
    ctx2d: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    hp: number,
    maxHp: number,
    showHpText: boolean
  ): void {
    ctx2d.fillStyle = '#f5f9ff';
    ctx2d.fillRect(x, y, w, h);
    ctx2d.strokeStyle = '#71849b';
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(x, y, w, h);

    ctx2d.fillStyle = '#102332';
    ctx2d.font = '10px monospace';
    ctx2d.textAlign = 'left';
    ctx2d.textBaseline = 'top';
    ctx2d.fillText(label, x + 6, y + 4);

    const hpBarX = x + 6;
    const hpBarY = y + h - 12;
    const hpBarW = w - 12;
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

    ctx2d.fillStyle = '#5b6570';
    ctx2d.fillRect(hpBarX, hpBarY, hpBarW, 6);
    ctx2d.fillStyle = hpPercent > 0.5 ? '#4caf50' : hpPercent > 0.2 ? '#d6b83f' : '#d95f5f';
    ctx2d.fillRect(hpBarX, hpBarY, Math.floor(hpBarW * hpPercent), 6);

    if (showHpText) {
      ctx2d.fillStyle = '#102332';
      ctx2d.fillText(`${Math.max(0, hp)}/${Math.max(1, maxHp)}`, x + 6, y + h - 24);
    }
  }

  private drawActionMenu(ctx2d: CanvasRenderingContext2D, width: number, height: number): void {
    const baseX = width - 112;
    const baseY = height - 44;

    for (let i = 0; i < ACTIONS.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = baseX + col * 52;
      const y = baseY + row * 16;
      const isSelected = i === this.actionIndex;
      const label = ACTIONS[i];
      const disabled = this.firstBattle && label !== 'FIGHT';

      ctx2d.fillStyle = isSelected ? '#ffdd78' : (disabled ? '#76828d' : '#e4f1fb');
      ctx2d.fillRect(x, y, 48, 14);

      ctx2d.fillStyle = '#0f2434';
      ctx2d.fillText(label, x + 4, y + 2);
    }
  }

  private drawMoveMenu(ctx2d: CanvasRenderingContext2D, width: number, height: number): void {
    const moves = this.getPlayerMoveIds();
    const panelX = 8;
    const panelY = height - 44;
    const panelW = width - 16;

    for (let i = 0; i < moves.length; i++) {
      const moveId = moves[i];
      const info = getMoveInfo(moveId);
      const isSelected = i === this.moveIndex;
      const y = panelY + i * 11;

      ctx2d.fillStyle = isSelected ? '#ffdd78' : '#e4f1fb';
      ctx2d.fillRect(panelX, y, panelW, 10);

      ctx2d.fillStyle = '#0f2434';
      const moveName = getMoveName(moveId);
      const pp = this.playerMon?.pokemon.pp[i] ?? 0;
      ctx2d.fillText(`${moveName}  PP ${pp}/${info?.pp ?? pp}`, panelX + 4, y + 1);
    }
  }

  private queueMessages(messages: string[], onComplete?: () => void): void {
    this.messageQueue = [...messages];
    this.phase = 'message';
    this.onMessagesFinished = onComplete ?? null;
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

  private getPlayerMoveIds(): number[] {
    if (!this.playerMon) return [];
    return this.playerMon.pokemon.moves.filter((moveId) => moveId !== 0);
  }

  private getEnemyMoveIds(): number[] {
    if (!this.enemyMon) return [];
    return this.enemyMon.pokemon.moves.filter((moveId) => moveId !== 0);
  }

  private executeTurn(playerMoveId: number): void {
    const player = this.playerMon;
    const enemy = this.enemyMon;
    if (!player || !enemy) return;

    const enemyMoves = this.getEnemyMoveIds();
    const enemyMoveId = enemyMoves.length > 0 ? enemyMoves[randomIntInclusive(0, enemyMoves.length - 1)] : MOVES.TACKLE;

    const turnMessages: string[] = [];

    const playerActsFirst = this.shouldPlayerActFirst(player, enemy);
    const order: Array<{ attacker: BattleMon; defender: BattleMon; moveId: number; isPlayer: boolean }> = playerActsFirst
      ? [
          { attacker: player, defender: enemy, moveId: playerMoveId, isPlayer: true },
          { attacker: enemy, defender: player, moveId: enemyMoveId, isPlayer: false },
        ]
      : [
          { attacker: enemy, defender: player, moveId: enemyMoveId, isPlayer: false },
          { attacker: player, defender: enemy, moveId: playerMoveId, isPlayer: true },
        ];

    for (const action of order) {
      if (action.attacker.currentHp <= 0 || action.defender.currentHp <= 0) {
        continue;
      }
      turnMessages.push(...this.applyMove(action.attacker, action.defender, action.moveId, action.isPlayer));
    }

    if (enemy.currentHp <= 0) {
      turnMessages.push(`Wild ${enemy.name} fainted!`);
      this.handleWin(turnMessages);
      return;
    }

    if (player.currentHp <= 0) {
      turnMessages.push(`${player.name} fainted!`);
      this.handleLoss(turnMessages);
      return;
    }

    this.queueMessages(turnMessages, () => {
      this.phase = 'action';
    });
  }

  private shouldPlayerActFirst(player: BattleMon, enemy: BattleMon): boolean {
    const playerSpeed = player.pokemon.stats.speed;
    const enemySpeed = enemy.pokemon.stats.speed;
    if (playerSpeed === enemySpeed) {
      return randomIntInclusive(0, 1) === 0;
    }
    return playerSpeed > enemySpeed;
  }

  private applyMove(attacker: BattleMon, defender: BattleMon, moveId: number, isPlayerAttacker: boolean): string[] {
    const messages: string[] = [];
    const moveInfo = getMoveInfo(moveId);
    const moveName = getMoveName(moveId);
    messages.push(`${attacker.name} used ${moveName}!`);

    this.consumeMovePP(attacker, moveId, isPlayerAttacker);

    if (!moveInfo) {
      messages.push('But it failed!');
      return messages;
    }

    const accuracy = moveInfo.accuracy <= 0 ? 100 : moveInfo.accuracy;
    const accuracyRoll = randomIntInclusive(1, 100);
    if (accuracyRoll > accuracy) {
      messages.push('But it missed!');
      return messages;
    }

    if (moveInfo.power <= 0) {
      if (moveId === MOVES.GROWL) {
        defender.attackStage = clampStage(defender.attackStage - 1);
        messages.push(`${defender.name}'s ATTACK fell!`);
      } else if (moveId === MOVES.LEER) {
        defender.defenseStage = clampStage(defender.defenseStage - 1);
        messages.push(`${defender.name}'s DEFENSE fell!`);
      } else {
        messages.push('But nothing happened.');
      }
      return messages;
    }

    const damageResult = this.calculateDamage(attacker, defender, moveId);
    defender.currentHp = Math.max(0, defender.currentHp - damageResult.damage);

    if (damageResult.critical) {
      messages.push('A critical hit!');
    }

    if (damageResult.effectiveness > 1) {
      messages.push("It's super effective!");
    } else if (damageResult.effectiveness < 1) {
      messages.push("It's not very effective...");
    }

    return messages;
  }

  private consumeMovePP(attacker: BattleMon, moveId: number, isPlayerAttacker: boolean): void {
    const slot = attacker.pokemon.moves.findIndex((currentMoveId) => currentMoveId === moveId);
    if (slot < 0) return;
    const currentPP = attacker.pokemon.pp[slot];
    attacker.pokemon.pp[slot] = Math.max(0, currentPP - 1) as PartyPokemon['pp'][number];

    if (isPlayerAttacker) {
      const party = saveManager.getParty();
      const first = party[0];
      if (first) {
        first.pp[slot] = attacker.pokemon.pp[slot];
        saveManager.setParty(party);
      }
    }
  }

  private calculateDamage(attacker: BattleMon, defender: BattleMon, moveId: number): {
    damage: number;
    critical: boolean;
    effectiveness: number;
  } {
    const moveInfo = getMoveInfo(moveId);
    if (!moveInfo || moveInfo.power <= 0) {
      return { damage: 0, critical: false, effectiveness: 1 };
    }

    const attackerInfo = getSpeciesInfo(attacker.pokemon.species);
    const defenderInfo = getSpeciesInfo(defender.pokemon.species);

    const moveType = moveInfo.type;
    const isPhysical = PHYSICAL_TYPES.has(moveType);
    const attackStatRaw = isPhysical ? attacker.pokemon.stats.attack : attacker.pokemon.stats.spAttack;
    const defenseStatRaw = isPhysical ? defender.pokemon.stats.defense : defender.pokemon.stats.spDefense;

    const attackStat = applyStage(attackStatRaw, attacker.attackStage);
    const defenseStat = Math.max(1, applyStage(defenseStatRaw, defender.defenseStage));

    const level = attacker.pokemon.level;
    const base = Math.floor(Math.floor(Math.floor((((2 * level) / 5) + 2) * moveInfo.power * attackStat / defenseStat) / 50) + 2);

    const critical = randomIntInclusive(1, 16) === 1;
    const randomFactor = randomIntInclusive(85, 100) / 100;

    const attackerTypes = attackerInfo?.types ?? ['NORMAL', 'NORMAL'];
    const defenderTypes = defenderInfo?.types ?? ['NORMAL', 'NORMAL'];
    const stab = attackerTypes[0] === moveType || attackerTypes[1] === moveType ? 1.5 : 1;
    const effectiveness = getTypeEffectiveness(moveType, defenderTypes);
    const criticalMod = critical ? 2 : 1;

    const modifier = stab * effectiveness * criticalMod * randomFactor;
    const rawDamage = Math.floor(base * modifier);
    const damage = Math.max(1, rawDamage);

    return { damage, critical, effectiveness };
  }

  private handleWin(turnMessages: string[]): void {
    const player = this.playerMon;
    const enemy = this.enemyMon;
    if (!player || !enemy) return;

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
    const first = party[0];
    if (first) {
      first.experience = player.pokemon.experience;
      first.level = player.pokemon.level;
      first.stats = {
        ...first.stats,
        hp: player.currentHp,
        maxHp: player.pokemon.stats.maxHp,
        attack: player.pokemon.stats.attack,
        defense: player.pokemon.stats.defense,
        speed: player.pokemon.stats.speed,
        spAttack: player.pokemon.stats.spAttack,
        spDefense: player.pokemon.stats.spDefense,
      };
    }
    saveManager.setParty(party);

    if (this.firstBattle) {
      gameFlags.set('FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE');
      gameFlags.set('FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG');
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_BIRCH');
      gameFlags.clear('FLAG_HIDE_MAP_NAME_POPUP');
      gameVariables.setVar(GAME_VARS.VAR_BIRCH_LAB_STATE, 2);
      gameVariables.setVar(GAME_VARS.VAR_ROUTE101_STATE, 3);

      // First-battle script heals the party right after this fight.
      const healedFirst = party[0];
      if (healedFirst) {
        healedFirst.stats.hp = healedFirst.stats.maxHp;
      }
      saveManager.setParty(party);
    }

    this.queueMessages(turnMessages, () => {
      this.phase = 'finished';
    });
  }

  private handleLoss(turnMessages: string[]): void {
    const party = saveManager.getParty();
    const first = party[0];
    if (first) {
      first.stats.hp = 0;
    }
    saveManager.setParty(party);

    turnMessages.push('You lost the battle...');
    this.queueMessages(turnMessages, () => {
      this.phase = 'finished';
    });
  }
}

export function createBattleState(): StateRenderer {
  return new BattleState();
}


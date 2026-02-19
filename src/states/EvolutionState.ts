/**
 * Evolution state.
 *
 * C refs:
 * - public/pokeemerald/src/evolution_scene.c
 * - public/pokeemerald/src/evolution_graphics.c
 */

import {
  GameState,
  type InputState,
  type RenderContext,
  type StateRenderer,
  type StateTransition,
} from '../core/GameState';
import type { ViewportConfig } from '../config/viewport';
import { inputMap, GameButton } from '../core/InputMap';
import { saveManager } from '../save/SaveManager';
import type { LocationState } from '../save/types';
import type { ObjectEventRuntimeState } from '../types/objectEvents';
import { ITEMS } from '../data/items';
import { STATUS, createEmptyMarkings, createEmptyRibbons, type PartyPokemon } from '../pokemon/types';
import { getSpeciesName, SPECIES } from '../data/species';
import { recalculatePartyStatsCStyle } from '../pokemon/stats';
import { menuStateManager } from '../menu';
import type { MoveForgetMenuOpenData } from '../menu/MenuStateManager';
import {
  drawTextBox,
  preloadBattleInterfaceAssets,
} from '../battle/render/BattleHealthBox';
import {
  getMovesAtExactLevel,
  runMoveLearningSequence,
  type MoveLearningPrompts,
} from '../pokemon/moveLearning';
import {
  getShedinjaEvolutionTarget,
  resolvePostEvolutionNickname,
} from '../pokemon/evolution';
import { EvolutionRenderer } from '../evolution/EvolutionRenderer';
import type {
  EvolutionQueueEntry,
  EvolutionStateData,
} from '../evolution/types';

interface MessagePromptState {
  type: 'message';
  text: string;
  visibleChars: number;
  elapsedMs: number;
  resolve: () => void;
}

interface YesNoPromptState {
  type: 'yesNo';
  text: string;
  visibleChars: number;
  elapsedMs: number;
  cursor: 0 | 1;
  resolve: (answer: boolean) => void;
}

type PromptState = MessagePromptState | YesNoPromptState;

const BATTLE_TEXT_SPEED_DELAY_FRAMES: Record<'slow' | 'mid' | 'fast', number> = {
  slow: 8,
  mid: 4,
  fast: 1,
};

const FRAME_MS = 1000 / 60;

function getDisplayName(mon: PartyPokemon): string {
  const nickname = mon.nickname?.trim();
  return nickname && nickname.length > 0 ? nickname : getSpeciesName(mon.species);
}

export class EvolutionState implements StateRenderer {
  readonly id = GameState.EVOLUTION;

  private renderer = new EvolutionRenderer();
  private queue: EvolutionQueueEntry[] = [];
  private promptState: PromptState | null = null;
  private pendingTransition: StateTransition | null = null;
  private waitingForMenu = false;
  private bHeld = false;

  private returnLocation: LocationState | null = null;
  private returnObjectEventRuntimeState: ObjectEventRuntimeState | null = null;

  private runToken = 0;
  private sceneResolver: ((canceled: boolean) => void) | null = null;

  async enter(_viewport: ViewportConfig, data?: Record<string, unknown>): Promise<void> {
    const typedData = (data ?? {}) as Partial<EvolutionStateData>;
    const queue = Array.isArray(typedData.queue) ? typedData.queue : [];
    this.queue = [...queue]
      .filter((entry): entry is EvolutionQueueEntry => (
        entry !== null
        && typeof entry === 'object'
        && Number.isFinite(entry.partyIndex)
        && Number.isFinite(entry.targetSpecies)
      ))
      .map((entry) => ({
        partyIndex: Math.max(0, Math.trunc(entry.partyIndex)),
        targetSpecies: Math.max(0, Math.trunc(entry.targetSpecies)),
        canStop: entry.canStop !== false,
      }))
      .filter((entry) => entry.targetSpecies > 0)
      .sort((a, b) => a.partyIndex - b.partyIndex);

    this.returnLocation = typedData.returnLocation ?? null;
    this.returnObjectEventRuntimeState = typedData.returnObjectEventRuntimeState ?? null;
    this.promptState = null;
    this.pendingTransition = null;
    this.waitingForMenu = false;
    this.bHeld = false;
    this.sceneResolver = null;
    this.runToken++;

    await preloadBattleInterfaceAssets();

    if (this.queue.length === 0) {
      this.finishToOverworld();
      return;
    }

    const token = this.runToken;
    void this.runEvolutionQueue(token);
  }

  async exit(): Promise<void> {
    this.runToken++;
    this.promptState = null;
    this.sceneResolver = null;
    this.waitingForMenu = false;
    this.queue = [];
    if (menuStateManager.isMenuOpen()) {
      menuStateManager.close();
    }
  }

  update(dt: number, _frameCount: number): void {
    if (this.promptState) {
      const delay = this.getBattleTextDelayMs();
      this.promptState.elapsedMs += dt;
      const chars = Math.floor(this.promptState.elapsedMs / delay);
      this.promptState.visibleChars = Math.max(0, Math.min(this.promptState.text.length, chars));
    }

    const status = this.renderer.update(dt, this.bHeld);
    if (status.complete && this.sceneResolver) {
      const resolve = this.sceneResolver;
      this.sceneResolver = null;
      resolve(status.canceled);
    }
  }

  handleInput(input: InputState): StateTransition | null {
    if (this.pendingTransition) {
      return this.pendingTransition;
    }

    this.bHeld = inputMap.isHeld(input, GameButton.B);
    const confirmPressed = inputMap.isPressed(input, GameButton.A);
    const cancelPressed = inputMap.isPressed(input, GameButton.B);

    if (this.promptState) {
      this.handlePromptInput(input, confirmPressed, cancelPressed);
      return null;
    }

    if (menuStateManager.isMenuOpen() || this.waitingForMenu) {
      return null;
    }

    return null;
  }

  render(context: RenderContext): void {
    const { ctx2d, viewport } = context;
    const offsetX = Math.floor((viewport.width - 240) / 2);
    const offsetY = Math.floor((viewport.height - 160) / 2);

    ctx2d.fillStyle = '#000000';
    ctx2d.fillRect(0, 0, viewport.width, viewport.height);

    this.renderer.render(ctx2d, offsetX, offsetY);

    if (this.promptState) {
      drawTextBox(ctx2d, offsetX, offsetY, this.promptState.text, this.promptState.visibleChars);
      if (
        this.promptState.type === 'yesNo'
        && this.promptState.visibleChars >= this.promptState.text.length
      ) {
        this.drawYesNoMenu(ctx2d, offsetX, offsetY, this.promptState.cursor);
      }
    }
  }

  private async runEvolutionQueue(token: number): Promise<void> {
    for (const entry of this.queue) {
      if (!this.isTokenActive(token)) {
        return;
      }

      const party = saveManager.getParty();
      const mon = party[entry.partyIndex];
      if (!mon) {
        continue;
      }

      const preSpecies = mon.species;
      if (entry.targetSpecies <= 0 || entry.targetSpecies === preSpecies) {
        continue;
      }

      await this.renderer.load(preSpecies, entry.targetSpecies);
      if (!this.isTokenActive(token)) {
        return;
      }

      const preName = getDisplayName(mon);
      await this.showPromptMessage(`${preName} is evolving!`);
      if (!this.isTokenActive(token)) {
        return;
      }

      const canceled = await this.playEvolutionAnimation(entry.canStop !== false);
      if (!this.isTokenActive(token)) {
        return;
      }

      if (canceled) {
        await this.showPromptMessage(`Huh? ${preName} stopped evolving!`);
        if (!this.isTokenActive(token)) {
          return;
        }
        continue;
      }

      const evolvedMon = this.applyEvolution(entry.partyIndex, preSpecies, entry.targetSpecies);
      if (!evolvedMon) {
        continue;
      }

      await this.showPromptMessage(
        `Congratulations! Your ${preName} evolved into ${getSpeciesName(entry.targetSpecies)}!`,
      );
      if (!this.isTokenActive(token)) {
        return;
      }

      this.tryCreateShedinja(entry.partyIndex, preSpecies, evolvedMon);
      if (!this.isTokenActive(token)) {
        return;
      }

      await this.runPostEvolutionMoveLearning(entry.partyIndex);
      if (!this.isTokenActive(token)) {
        return;
      }
    }

    if (!this.isTokenActive(token)) {
      return;
    }
    this.finishToOverworld();
  }

  private isTokenActive(token: number): boolean {
    return token === this.runToken;
  }

  private async playEvolutionAnimation(canStop: boolean): Promise<boolean> {
    this.renderer.start(canStop);
    return new Promise((resolve) => {
      this.sceneResolver = resolve;
    });
  }

  private applyEvolution(
    partyIndex: number,
    preSpecies: number,
    targetSpecies: number,
  ): PartyPokemon | null {
    const party = saveManager.getParty();
    const mon = party[partyIndex];
    if (!mon) {
      return null;
    }

    let evolved: PartyPokemon = {
      ...mon,
      species: targetSpecies,
    };
    evolved = recalculatePartyStatsCStyle(evolved);
    evolved = {
      ...evolved,
      nickname: resolvePostEvolutionNickname(evolved, preSpecies, targetSpecies),
    };

    party[partyIndex] = evolved;
    saveManager.setParty(party);
    saveManager.registerSpeciesCaught(targetSpecies);
    return evolved;
  }

  private tryCreateShedinja(
    evolvedPartyIndex: number,
    preEvolutionSpecies: number,
    evolvedMon: PartyPokemon,
  ): void {
    const shedinjaTarget = getShedinjaEvolutionTarget(preEvolutionSpecies);
    if (shedinjaTarget <= 0 || evolvedMon.species !== SPECIES.NINJASK) {
      return;
    }

    const party = saveManager.getParty();
    const emptySlot = party.findIndex((mon) => mon === null);
    if (emptySlot < 0) {
      return;
    }

    const baseMon = party[evolvedPartyIndex];
    if (!baseMon) {
      return;
    }

    let shedinja: PartyPokemon = {
      ...baseMon,
      species: shedinjaTarget,
      nickname: getSpeciesName(shedinjaTarget),
      heldItem: ITEMS.ITEM_NONE,
      markings: createEmptyMarkings(),
      ribbons: createEmptyRibbons(),
      status: STATUS.NONE,
      mail: null,
    };
    shedinja = recalculatePartyStatsCStyle(shedinja);

    party[emptySlot] = shedinja;
    saveManager.setParty(party);
    saveManager.registerSpeciesCaught(shedinjaTarget);
  }

  private async runPostEvolutionMoveLearning(partyIndex: number): Promise<void> {
    const party = saveManager.getParty();
    const mon = party[partyIndex];
    if (!mon) {
      return;
    }

    const movesToLearn = getMovesAtExactLevel(mon.species, mon.level);
    if (movesToLearn.length === 0) {
      return;
    }

    const prompts: MoveLearningPrompts = {
      showMessage: (text) => this.showPromptMessage(text),
      askYesNo: (text, options) => this.showPromptYesNo(text, options?.defaultYes ?? true),
      chooseMoveToReplace: (context) => this.openMoveForgetMenu(context.pokemon, context.moveId),
    };

    const result = await runMoveLearningSequence(mon, movesToLearn, prompts);
    this.updatePartyMon(partyIndex, result.pokemon);
  }

  private updatePartyMon(partyIndex: number, mon: PartyPokemon): void {
    const party = saveManager.getParty();
    if (!party[partyIndex]) {
      return;
    }
    party[partyIndex] = mon;
    saveManager.setParty(party);
  }

  private openMoveForgetMenu(mon: PartyPokemon, moveToLearnId: number): Promise<number | null> {
    return new Promise((resolve) => {
      this.waitingForMenu = true;
      let settled = false;

      const finish = (value: number | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        unsubscribe();
        this.waitingForMenu = false;
        resolve(value);
      };

      const unsubscribe = menuStateManager.subscribe((state) => {
        if (!state.isOpen) {
          finish(null);
        }
      });

      const data: MoveForgetMenuOpenData = {
        pokemonName: getDisplayName(mon),
        pokemonMoves: mon.moves,
        pokemonPp: mon.pp,
        moveToLearnId,
        onMoveSlotChosen: (moveSlot) => {
          finish(moveSlot);
        },
      };
      menuStateManager.open('moveForget', data as unknown as Record<string, unknown>);
    });
  }

  private showPromptMessage(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.promptState = {
        type: 'message',
        text,
        visibleChars: 0,
        elapsedMs: 0,
        resolve,
      };
    });
  }

  private showPromptYesNo(text: string, defaultYes: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      this.promptState = {
        type: 'yesNo',
        text,
        visibleChars: 0,
        elapsedMs: 0,
        cursor: defaultYes ? 0 : 1,
        resolve,
      };
    });
  }

  private handlePromptInput(input: InputState, confirmPressed: boolean, cancelPressed: boolean): void {
    const prompt = this.promptState;
    if (!prompt) {
      return;
    }

    if (prompt.visibleChars < prompt.text.length) {
      if (confirmPressed || cancelPressed) {
        prompt.visibleChars = prompt.text.length;
      }
      return;
    }

    if (prompt.type === 'message') {
      if (confirmPressed || cancelPressed) {
        const resolve = prompt.resolve;
        this.promptState = null;
        resolve();
      }
      return;
    }

    if (inputMap.isPressed(input, GameButton.UP) || inputMap.isPressed(input, GameButton.DOWN)) {
      prompt.cursor = prompt.cursor === 0 ? 1 : 0;
      return;
    }

    if (confirmPressed) {
      const resolve = prompt.resolve;
      const answer = prompt.cursor === 0;
      this.promptState = null;
      resolve(answer);
      return;
    }

    if (cancelPressed) {
      const resolve = prompt.resolve;
      this.promptState = null;
      resolve(false);
    }
  }

  private getBattleTextDelayMs(): number {
    const options = saveManager.getOptions();
    const speed = options.textSpeed ?? 'mid';
    const frames = BATTLE_TEXT_SPEED_DELAY_FRAMES[speed] ?? BATTLE_TEXT_SPEED_DELAY_FRAMES.mid;
    return frames * FRAME_MS;
  }

  private drawYesNoMenu(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    cursor: 0 | 1,
  ): void {
    const boxX = offsetX + 182;
    const boxY = offsetY + 104;
    const boxWidth = 48;
    const boxHeight = 34;

    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = '#303030';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = '#383838';
    ctx.font = '10px "Pokemon Emerald", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(cursor === 0 ? '▶ YES' : '  YES', boxX + 6, boxY + 7);
    ctx.fillText(cursor === 1 ? '▶ NO' : '  NO', boxX + 6, boxY + 18);
  }

  private finishToOverworld(): void {
    saveManager.stagePendingObjectEventRuntimeState(this.returnObjectEventRuntimeState);
    this.pendingTransition = {
      to: GameState.OVERWORLD,
      data: {
        savedLocation: this.returnLocation ?? undefined,
      },
    };
  }
}

export function createEvolutionState(): StateRenderer {
  return new EvolutionState();
}

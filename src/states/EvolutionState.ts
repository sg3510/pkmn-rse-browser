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
import { PromptService, drawPromptYesNo } from '../core/prompt/PromptService';
import { getBattlePromptDelayMs } from '../core/prompt/textSpeed';
import { saveManager } from '../save/SaveManager';
import type { LocationState } from '../save/types';
import type { ObjectEventRuntimeState } from '../types/objectEvents';
import { ITEMS } from '../data/items';
import { STATUS, createEmptyMarkings, createEmptyRibbons, type PartyPokemon } from '../pokemon/types';
import { getSpeciesName, SPECIES } from '../data/species';
import { recalculatePartyStatsCStyle } from '../pokemon/stats';
import { menuStateManager } from '../menu';
import {
  drawTextBox,
  preloadBattleInterfaceAssets,
} from '../battle/render/BattleHealthBox';
import {
  getMovesAtExactLevel,
  runMoveLearningSequence,
} from '../pokemon/moveLearning';
import { formatPokemonDisplayName } from '../pokemon/displayName';
import { createMoveLearningPromptAdapter } from '../pokemon/moveLearningPromptAdapter';
import { openMoveForgetMenu as openMoveForgetMenuGateway } from '../menu/moves/openMoveForgetMenu';
import {
  getShedinjaEvolutionTarget,
  resolvePostEvolutionNickname,
} from '../pokemon/evolution';
import { EvolutionRenderer } from '../evolution/EvolutionRenderer';
import type {
  EvolutionQueueEntry,
  EvolutionStateData,
} from '../evolution/types';


const FRAME_MS = 1000 / 60;

export class EvolutionState implements StateRenderer {
  readonly id = GameState.EVOLUTION;

  private renderer = new EvolutionRenderer();
  private queue: EvolutionQueueEntry[] = [];
  private promptService = new PromptService();
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
    this.promptService.clear();
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
    this.promptService.clear();
    this.sceneResolver = null;
    this.waitingForMenu = false;
    this.queue = [];
    if (menuStateManager.isMenuOpen()) {
      menuStateManager.close();
    }
  }

  update(dt: number, _frameCount: number): void {
    this.promptService.tick(dt, this.getBattleTextDelayMs());

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

    if (this.promptService.isActive()) {
      this.promptService.handleInput({
        confirmPressed,
        cancelPressed,
        upPressed: inputMap.isPressed(input, GameButton.UP),
        downPressed: inputMap.isPressed(input, GameButton.DOWN),
      });
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

    const promptRenderState = this.promptService.getRenderState();
    if (promptRenderState) {
      drawTextBox(ctx2d, offsetX, offsetY, promptRenderState.text, promptRenderState.visibleChars);
      if (promptRenderState.type === 'yesNo' && promptRenderState.isFullyVisible) {
        drawPromptYesNo(ctx2d, offsetX, offsetY, promptRenderState.cursor ?? 0);
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

      const preName = formatPokemonDisplayName(mon);
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

  private async openMoveForgetMenu(mon: PartyPokemon, moveToLearnId: number): Promise<number | null> {
    this.waitingForMenu = true;
    try {
      return await openMoveForgetMenuGateway({
        pokemon: mon,
        mode: 'learn',
        moveToLearnId,
      });
    } finally {
      this.waitingForMenu = false;
    }
  }

  private showPromptMessage(text: string): Promise<void> {
    return this.promptService.showMessage(text);
  }

  private showPromptYesNo(text: string, defaultYes: boolean): Promise<boolean> {
    return this.promptService.showYesNo(text, defaultYes);
  }

  private getBattleTextDelayMs(): number {
    const options = saveManager.getOptions();
    return getBattlePromptDelayMs(options.textSpeed, FRAME_MS);
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

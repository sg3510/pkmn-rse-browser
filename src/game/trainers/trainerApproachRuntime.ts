/**
 * Trainer approach runtime state (C parity model).
 *
 * C references:
 * - public/pokeemerald/src/trainer_see.c (gApproachingTrainers, gApproachingTrainerId)
 * - public/pokeemerald/src/battle_setup.c (trainer battle script continuation globals)
 */

import type { ScriptCommand } from '../../data/scripts/types.ts';
import type {
  TrainerBattleMetadata,
  TrainerSightApproachingTrainer,
  TrainerSightEncounterSelection,
} from './trainerSightEncounter.ts';

const FALLBACK_BEATEN_SCRIPT_LABEL = 'EventScript_TryGetTrainerScript';

export interface TrainerApproachRuntimeSnapshot {
  approachingTrainers: TrainerSightApproachingTrainer[];
  currentApproachingTrainerIndex: number;
  selectedApproachingTrainerIndex: number;
  noOfPossibleTrainerRetScripts: number;
  shouldCheckTrainerBScript: boolean;
  whichTrainerToFaceAfterBattle: 0 | 1;
  trainerApproachedPlayer: boolean;
}

export class TrainerApproachRuntime {
  private approachingTrainers: TrainerSightApproachingTrainer[] = [];
  private currentApproachingTrainerIndex = 0;
  private selectedApproachingTrainerIndex = 0;
  private noOfPossibleTrainerRetScripts = 0;
  private shouldCheckTrainerBScript = false;
  private whichTrainerToFaceAfterBattle: 0 | 1 = 0;
  private trainerApproachedPlayer = false;

  clear(): void {
    this.approachingTrainers = [];
    this.currentApproachingTrainerIndex = 0;
    this.selectedApproachingTrainerIndex = 0;
    this.noOfPossibleTrainerRetScripts = 0;
    this.shouldCheckTrainerBScript = false;
    this.whichTrainerToFaceAfterBattle = 0;
    this.trainerApproachedPlayer = false;
  }

  prepareForSightEncounter(selection: TrainerSightEncounterSelection): void {
    this.approachingTrainers = selection.approachingTrainers.slice(0, 2);
    this.currentApproachingTrainerIndex = 0;
    this.selectedApproachingTrainerIndex = 0;
    this.noOfPossibleTrainerRetScripts = 0;
    this.shouldCheckTrainerBScript = false;
    this.whichTrainerToFaceAfterBattle = 0;
    this.trainerApproachedPlayer = this.approachingTrainers.length > 0;
  }

  hasApproachingTrainers(): boolean {
    return this.approachingTrainers.length > 0;
  }

  getApproachingTrainerCount(): number {
    return this.approachingTrainers.length;
  }

  getCurrentApproachingTrainerIndex(): number {
    return this.currentApproachingTrainerIndex;
  }

  getCurrentApproachingTrainer(): TrainerSightApproachingTrainer | null {
    return this.approachingTrainers[this.currentApproachingTrainerIndex] ?? null;
  }

  selectCurrentApproachingTrainer(): TrainerSightApproachingTrainer | null {
    this.selectedApproachingTrainerIndex = this.currentApproachingTrainerIndex;
    return this.getSelectedApproachingTrainer();
  }

  getSelectedApproachingTrainer(): TrainerSightApproachingTrainer | null {
    return this.approachingTrainers[this.selectedApproachingTrainerIndex] ?? null;
  }

  getApproachingTrainerAt(index: number): TrainerSightApproachingTrainer | null {
    if (!Number.isFinite(index)) return null;
    const normalized = Math.trunc(index);
    if (normalized < 0 || normalized >= this.approachingTrainers.length) {
      return null;
    }
    return this.approachingTrainers[normalized] ?? null;
  }

  tryPrepareSecondApproachingTrainer(): boolean {
    if (this.approachingTrainers.length !== 2) {
      return false;
    }

    if (this.currentApproachingTrainerIndex === 0) {
      this.currentApproachingTrainerIndex = 1;
      return true;
    }

    this.currentApproachingTrainerIndex = 0;
    return false;
  }

  getPrimaryTrainerBattle(): TrainerBattleMetadata | null {
    return this.approachingTrainers[0]?.battle ?? null;
  }

  getSecondaryTrainerBattle(): TrainerBattleMetadata | null {
    return this.approachingTrainers[1]?.battle ?? null;
  }

  getCurrentTrainerBattle(): TrainerBattleMetadata | null {
    return this.getCurrentApproachingTrainer()?.battle ?? null;
  }

  getSelectedTrainerBattle(): TrainerBattleMetadata | null {
    return this.getSelectedApproachingTrainer()?.battle ?? null;
  }

  onTrainerBattleStarted(): void {
    this.noOfPossibleTrainerRetScripts = this.approachingTrainers.length;
    this.shouldCheckTrainerBScript = false;
    this.whichTrainerToFaceAfterBattle = 0;
  }

  shouldTryGetTrainerScript(): boolean {
    if (this.noOfPossibleTrainerRetScripts > 1) {
      this.noOfPossibleTrainerRetScripts = 0;
      this.shouldCheckTrainerBScript = true;
      return true;
    }

    this.shouldCheckTrainerBScript = false;
    return false;
  }

  getTrainerPostBattleScriptLabel(): string {
    if (this.shouldCheckTrainerBScript) {
      this.shouldCheckTrainerBScript = false;
      const trainerBScript = this.getSecondaryTrainerBattle()?.beatenScriptLabel ?? null;
      if (trainerBScript) {
        this.whichTrainerToFaceAfterBattle = 1;
        return trainerBScript;
      }
    }

    const trainerAScript = this.getPrimaryTrainerBattle()?.beatenScriptLabel ?? null;
    if (trainerAScript) {
      this.whichTrainerToFaceAfterBattle = 0;
      return trainerAScript;
    }

    return FALLBACK_BEATEN_SCRIPT_LABEL;
  }

  getPostBattleCommands(): ScriptCommand[] | null {
    const selected = this.getSelectedTrainerBattle()?.postBattleCommands;
    if (selected && selected.length > 0) {
      return selected;
    }

    const primary = this.getPrimaryTrainerBattle()?.postBattleCommands;
    if (primary && primary.length > 0) {
      return primary;
    }

    return null;
  }

  setWhichTrainerToFaceAfterBattle(value: 0 | 1): void {
    this.whichTrainerToFaceAfterBattle = value;
  }

  getWhichTrainerToFaceAfterBattle(): 0 | 1 {
    return this.whichTrainerToFaceAfterBattle;
  }

  setTrainerApproachedPlayer(value: boolean): void {
    this.trainerApproachedPlayer = value;
  }

  hasTrainerApproachedPlayer(): boolean {
    return this.trainerApproachedPlayer;
  }

  getTrainerToFaceAfterBattle(): TrainerSightApproachingTrainer | null {
    if (!this.trainerApproachedPlayer) {
      return null;
    }
    return this.approachingTrainers[this.whichTrainerToFaceAfterBattle] ?? this.approachingTrainers[0] ?? null;
  }

  snapshot(): TrainerApproachRuntimeSnapshot {
    return {
      approachingTrainers: this.approachingTrainers.slice(),
      currentApproachingTrainerIndex: this.currentApproachingTrainerIndex,
      selectedApproachingTrainerIndex: this.selectedApproachingTrainerIndex,
      noOfPossibleTrainerRetScripts: this.noOfPossibleTrainerRetScripts,
      shouldCheckTrainerBScript: this.shouldCheckTrainerBScript,
      whichTrainerToFaceAfterBattle: this.whichTrainerToFaceAfterBattle,
      trainerApproachedPlayer: this.trainerApproachedPlayer,
    };
  }
}

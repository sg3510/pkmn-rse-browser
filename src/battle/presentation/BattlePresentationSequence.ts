/** Presentation barriers corresponding to public/pokeemerald/data/battle_scripts_1.s. */
export type BattlePresentationStep =
  | { kind: 'message'; text: string; start?: () => void }
  | { kind: 'animation' | 'hp' | 'faint' | 'event'; start: () => void; complete: () => boolean };
export type BattleMessageEntry = { text: string; onStart?: () => void } | { step: BattlePresentationStep };
/** Pure sequencing: input only advances messages; effects advance through their own completion checks. */
export class BattlePresentationSequence {
  currentMessage = '';
  private steps: readonly BattlePresentationStep[] = [];
  private index = 0;
  private started = false;
  private generation = 0;
  private onComplete?: () => void;
  private showMessage: (text: string) => void;
  constructor(showMessage: (text: string) => void) { this.showMessage = showMessage; }
  get active(): boolean { return this.index < this.steps.length; }
  get waitingForMessage(): boolean { return this.active && this.steps[this.index].kind === 'message'; }
  get currentKind(): BattlePresentationStep['kind'] | null { return this.steps[this.index]?.kind ?? null; }
  start(entries: readonly BattleMessageEntry[], onComplete?: () => void): void {
    this.cancel(); this.onComplete = onComplete;
    this.steps = entries.map((entry): BattlePresentationStep => {
      if ('step' in entry) return entry.step;
      if (entry.text) return { kind: 'message', text: entry.text, start: entry.onStart };
      return { kind: 'event', start: entry.onStart ?? (() => {}), complete: () => true };
    });
    this.tick();
  }
  advanceMessage(): void {
    if (!this.waitingForMessage) return;
    this.index++; this.started = false; this.tick();
  }
  tick(): void {
    const generation = this.generation;
    while (this.active) {
      const step = this.steps[this.index];
      if (!this.started) {
        this.started = true; step.start?.();
        if (generation !== this.generation) return;
        if (step.kind === 'message') { this.currentMessage = step.text; this.showMessage(step.text); }
      }
      if (step.kind === 'message' || !step.complete()) return;
      if (generation !== this.generation) return;
      this.index++; this.started = false;
    }
    const complete = this.onComplete;
    this.onComplete = undefined; this.steps = []; this.index = 0;
    complete?.();
  }
  cancel(): void {
    this.generation++; this.steps = []; this.index = 0; this.started = false;
    this.onComplete = undefined; this.currentMessage = '';
  }
}

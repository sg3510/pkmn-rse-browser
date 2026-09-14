/** Typed presentation order; C reference: public/pokeemerald/data/battle_scripts_1.s. */
import type { BattleEvent } from '../engine/types.ts';
import type { BattleMessageEntry } from './BattlePresentationSequence.ts';
export interface TurnPresentationHost {
  animation(event: BattleEvent): { entry: BattleMessageEntry; played: () => boolean };
  eventStart(event: BattleEvent, animationPlayed: () => boolean): (() => void) | null;
  changesHp(event: BattleEvent): boolean;
  hpComplete(): boolean;
  startFaint(slot: number): void;
  faintComplete(slot: number): boolean;
}
export function buildTurnPresentation(events: readonly BattleEvent[], prefix: readonly string[], host: TurnPresentationHost): BattleMessageEntry[] {
  const entries: BattleMessageEntry[] = prefix.map((text) => ({ text }));
  let played: () => boolean = () => false;
  for (const event of events) {
    if (event.type === 'animation') {
      const animation = host.animation(event); entries.push(animation.entry); played = animation.played; continue;
    }
    const start = host.eventStart(event, played);
    const message = event.message?.trim() ?? '';
    if (event.type === 'faint' && event.battler !== undefined) {
      const slot = event.battler;
      entries.push({ step: { kind: 'faint', start: () => { start?.(); host.startFaint(slot); }, complete: () => host.faintComplete(slot) } });
      if (message) entries.push({ text: message });
    } else if (host.changesHp(event)) {
      entries.push({ step: { kind: 'hp', start: start ?? (() => {}), complete: () => host.hpComplete() } });
      if (message) entries.push({ text: message });
    } else if (message) entries.push({ text: message, onStart: start ?? undefined });
    else if (start) entries.push({ step: { kind: 'event', start, complete: () => true } });
  }
  if (!entries.length) entries.push({ text: '...' });
  return entries;
}

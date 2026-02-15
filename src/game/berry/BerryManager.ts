/**
 * BerryManager - authoritative berry tree runtime state.
 *
 * C references:
 * - public/pokeemerald/src/berry.c
 * - public/pokeemerald/src/clock.c
 * - public/pokeemerald/include/global.berry.h
 * - public/pokeemerald/include/global.h (SaveBlock2.lastBerryTreeUpdate)
 */

import { getItemName } from '../../data/items.ts';
import type { BerryRtcTime, BerryState, BerryTimestampDomain, BerryTreeState } from '../../save/types.ts';
import { isDebugMode } from '../../utils/debug.ts';
import {
  BERRY_GROWTH_BY_TYPE,
  BERRY_STAGE,
  BERRY_TREES_COUNT,
  FIRST_BERRY_ITEM_ID,
  LAST_BERRY_ITEM_ID,
  NUM_WATER_STAGES,
  berryTypeToItemId,
  getDefaultBerryGrowth,
  itemIdToBerryType,
  resolveBerryTreeId,
} from './berryConstants.ts';

interface BerryInteractionContext {
  mapId: string;
  localId: number | null;
  treeId: number;
}

export interface BerryTreeInteractionData {
  treeId: number;
  stage: number;
  wateredStageCount: number;
  berryCount: number;
  berryName: string;
  berryCountString: string;
}

const MIN_VALID_EPOCH_MS = Date.UTC(2000, 0, 1);
const MAX_VALID_EPOCH_MS = Date.UTC(2100, 0, 1);

function normalizeTimestampDomain(
  timestamp: number | null,
  rtc: BerryRtcTime | null,
  input?: string
): BerryTimestampDomain | null {
  if (input === 'epoch-ms' || input === 'legacy-monotonic' || input === 'rtc') {
    return input;
  }

  if (timestamp !== null) {
    return isValidBerryEpochTimestamp(timestamp) ? 'epoch-ms' : 'legacy-monotonic';
  }

  if (rtc !== null) {
    return 'rtc';
  }

  return null;
}

export function isValidBerryEpochTimestamp(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_VALID_EPOCH_MS && value <= MAX_VALID_EPOCH_MS;
}

function createBlankBerryTree(): BerryTreeState {
  return {
    berry: 0,
    stage: BERRY_STAGE.NO_BERRY,
    stopGrowth: false,
    minutesUntilNextStage: 0,
    berryYield: 0,
    regrowthCount: 0,
    watered1: false,
    watered2: false,
    watered3: false,
    watered4: false,
  };
}

function normalizeBerryTree(tree: Partial<BerryTreeState> | null | undefined): BerryTreeState {
  const blank = createBlankBerryTree();
  if (!tree) return blank;

  return {
    berry: Number.isFinite(tree.berry) ? Math.max(0, Math.trunc(tree.berry!)) : blank.berry,
    stage: Number.isFinite(tree.stage) ? Math.max(0, Math.trunc(tree.stage!)) : blank.stage,
    stopGrowth: Boolean(tree.stopGrowth),
    minutesUntilNextStage: Number.isFinite(tree.minutesUntilNextStage)
      ? Math.max(0, Math.trunc(tree.minutesUntilNextStage!))
      : blank.minutesUntilNextStage,
    berryYield: Number.isFinite(tree.berryYield) ? Math.max(0, Math.trunc(tree.berryYield!)) : blank.berryYield,
    regrowthCount: Number.isFinite(tree.regrowthCount) ? Math.max(0, Math.trunc(tree.regrowthCount!)) : blank.regrowthCount,
    watered1: Boolean(tree.watered1),
    watered2: Boolean(tree.watered2),
    watered3: Boolean(tree.watered3),
    watered4: Boolean(tree.watered4),
  };
}

function normalizeRtcTime(input: Partial<BerryRtcTime> | null | undefined): BerryRtcTime | null {
  if (!input) return null;
  const days = Number.isFinite(input.days) ? Math.trunc(input.days!) : 0;
  const hours = Number.isFinite(input.hours) ? Math.trunc(input.hours!) : 0;
  const minutes = Number.isFinite(input.minutes) ? Math.trunc(input.minutes!) : 0;
  const seconds = Number.isFinite(input.seconds) ? Math.trunc(input.seconds!) : 0;
  return { days, hours, minutes, seconds };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function convertDateToDayCount(year: number, month: number, day: number): number {
  let dayCount = 0;
  for (let i = year - 1; i >= 0; i--) {
    dayCount += 365;
    if (isLeapYear(i)) dayCount++;
  }

  const numDaysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let i = 0; i < month - 1; i++) {
    dayCount += numDaysInMonths[i];
  }

  if (month > 2 && isLeapYear(year)) {
    dayCount++;
  }

  dayCount += day;
  return dayCount;
}

function dateToRtcLocalTime(date: Date): BerryRtcTime {
  const year = ((date.getFullYear() % 100) + 100) % 100;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return {
    days: convertDateToDayCount(year, month, day),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  };
}

function calcTimeDifference(from: BerryRtcTime, to: BerryRtcTime): BerryRtcTime {
  const result: BerryRtcTime = {
    seconds: to.seconds - from.seconds,
    minutes: to.minutes - from.minutes,
    hours: to.hours - from.hours,
    days: to.days - from.days,
  };

  if (result.seconds < 0) {
    result.seconds += 60;
    result.minutes--;
  }
  if (result.minutes < 0) {
    result.minutes += 60;
    result.hours--;
  }
  if (result.hours < 0) {
    result.hours += 24;
    result.days--;
  }

  return result;
}

class BerryManager {
  private trees: BerryTreeState[] = Array.from({ length: BERRY_TREES_COUNT }, () => createBlankBerryTree());
  private activeInteraction: BerryInteractionContext | null = null;
  private sparklingKeys = new Set<string>();
  private lastUpdateTimestamp: number | null = null;
  private lastUpdateTimestampDomain: BerryTimestampDomain | null = null;
  private lastUpdateRtc: BerryRtcTime | null = null;

  reset(nowTimestamp: number = Date.now()): void {
    this.trees = Array.from({ length: BERRY_TREES_COUNT }, () => createBlankBerryTree());
    this.activeInteraction = null;
    this.sparklingKeys.clear();
    this.lastUpdateTimestamp = Math.trunc(nowTimestamp);
    this.lastUpdateTimestampDomain = 'epoch-ms';
    this.lastUpdateRtc = null;
  }

  getStateForSave(): BerryState {
    return {
      trees: this.trees.map((tree) => ({ ...tree })),
      lastUpdateTimestamp: this.lastUpdateTimestamp ?? undefined,
      lastUpdateTimestampDomain: this.lastUpdateTimestampDomain ?? undefined,
      lastUpdateRtc: this.lastUpdateRtc ? { ...this.lastUpdateRtc } : undefined,
    };
  }

  loadState(state?: BerryState | null): void {
    if (!state || !Array.isArray(state.trees)) {
      this.reset();
      return;
    }

    this.trees = Array.from({ length: BERRY_TREES_COUNT }, (_, index) =>
      normalizeBerryTree(state.trees[index])
    );
    this.activeInteraction = null;
    this.sparklingKeys.clear();

    this.lastUpdateTimestamp = Number.isFinite(state.lastUpdateTimestamp)
      ? Math.trunc(state.lastUpdateTimestamp!)
      : null;
    this.lastUpdateRtc = normalizeRtcTime(state.lastUpdateRtc);
    this.lastUpdateTimestampDomain = normalizeTimestampDomain(
      this.lastUpdateTimestamp,
      this.lastUpdateRtc,
      state.lastUpdateTimestampDomain
    );
  }

  applyElapsedSinceLastUpdate(nowTimestamp: number = Date.now()): number {
    const normalizedNow = Math.trunc(nowTimestamp);
    let elapsedMinutes = 0;

    if (this.lastUpdateTimestamp !== null && Number.isFinite(this.lastUpdateTimestamp)) {
      if (this.lastUpdateTimestampDomain !== 'epoch-ms' || !isValidBerryEpochTimestamp(this.lastUpdateTimestamp)) {
        this.logClockRebase('invalid-domain-or-value', {
          fromTimestamp: this.lastUpdateTimestamp,
          fromDomain: this.lastUpdateTimestampDomain,
          nowTimestamp: normalizedNow,
        });
      } else {
        const deltaMs = normalizedNow - this.lastUpdateTimestamp;
        if (deltaMs >= 0) {
          elapsedMinutes = Math.floor(deltaMs / 60000);
        } else {
          this.logClockRebase('clock-moved-backward', {
            fromTimestamp: this.lastUpdateTimestamp,
            nowTimestamp: normalizedNow,
          });
        }
      }
    } else if (this.lastUpdateRtc) {
      const nowRtc = dateToRtcLocalTime(new Date(normalizedNow));
      const diff = calcTimeDifference(this.lastUpdateRtc, nowRtc);
      if (diff.days >= 0) {
        elapsedMinutes = diff.days * 24 * 60 + diff.hours * 60 + diff.minutes;
      }
    }

    if (elapsedMinutes > 0) {
      this.applyElapsedMinutes(elapsedMinutes);
    }

    this.lastUpdateTimestamp = normalizedNow;
    this.lastUpdateTimestampDomain = 'epoch-ms';
    this.lastUpdateRtc = null;
    return elapsedMinutes;
  }

  runTimeBasedEvents(nowTimestamp: number = Date.now()): number {
    return this.applyElapsedSinceLastUpdate(nowTimestamp);
  }

  applyElapsedMinutes(minutes: number): void {
    const wholeMinutes = Math.max(0, Math.trunc(minutes));
    if (wholeMinutes === 0) return;

    for (let i = 0; i < BERRY_TREES_COUNT; i++) {
      const tree = this.trees[i];
      if (!tree.berry || !tree.stage || tree.stopGrowth) continue;

      const stageDuration = this.getStageDurationMinutes(tree.berry);
      if (wholeMinutes >= stageDuration * 71) {
        this.trees[i] = createBlankBerryTree();
        continue;
      }

      let remaining = wholeMinutes;
      while (remaining !== 0) {
        if (tree.minutesUntilNextStage <= 0) {
          tree.minutesUntilNextStage = this.getStageDurationMinutes(tree.berry);
        }

        if (tree.minutesUntilNextStage > remaining) {
          tree.minutesUntilNextStage -= remaining;
          break;
        }

        remaining -= tree.minutesUntilNextStage;
        tree.minutesUntilNextStage = this.getStageDurationMinutes(tree.berry);
        if (!this.growBerryTree(tree)) {
          break;
        }
        if (tree.stage === BERRY_STAGE.BERRIES) {
          tree.minutesUntilNextStage *= 4;
        }
      }
    }
  }

  setActiveInteraction(context: { mapId: string; localId: number | null; treeId: string | number }): void {
    const treeId = this.normalizeTreeId(context.treeId);
    this.activeInteraction = {
      mapId: context.mapId,
      localId: context.localId,
      treeId,
    };
    this.logBerryDebug('setActiveInteraction', {
      mapId: context.mapId,
      localId: context.localId,
      requestedTreeId: context.treeId,
      normalizedTreeId: treeId,
    });
  }

  clearActiveInteraction(): void {
    if (this.activeInteraction) {
      this.logBerryDebug('clearActiveInteraction', { ...this.activeInteraction });
    }
    this.activeInteraction = null;
  }

  getTreeStage(treeIdInput: string | number): number {
    const treeId = this.normalizeTreeId(treeIdInput);
    return this.trees[treeId]?.stage ?? BERRY_STAGE.NO_BERRY;
  }

  getTreeSnapshot(treeIdInput: string | number): BerryTreeState {
    const treeId = this.normalizeTreeId(treeIdInput);
    return { ...this.trees[treeId] };
  }

  setBerryTree(treeIdInput: string | number, berryTypeInput: number, stageInput: number, allowGrowth: boolean): void {
    const treeId = this.normalizeTreeId(treeIdInput);
    const berryType = this.normalizeBerryType(berryTypeInput);
    const stage = Math.max(0, Math.trunc(stageInput));

    const tree = createBlankBerryTree();
    tree.berry = berryType;
    tree.stage = stage;
    tree.minutesUntilNextStage = this.getStageDurationMinutes(berryType);

    if (stage === BERRY_STAGE.BERRIES) {
      tree.berryYield = this.calcBerryYield(tree);
      tree.minutesUntilNextStage *= 4;
    }

    if (!allowGrowth) {
      tree.stopGrowth = true;
    }

    this.trees[treeId] = tree;
  }

  removeBerryTree(treeIdInput: string | number): void {
    const treeId = this.normalizeTreeId(treeIdInput);
    this.trees[treeId] = createBlankBerryTree();
  }

  objectInteractionGetBerryTreeData(): BerryTreeInteractionData {
    const context = this.getInteractionContext();
    if (!context) {
      return {
        treeId: 0,
        stage: BERRY_STAGE.NO_BERRY,
        wateredStageCount: 0,
        berryCount: 0,
        berryName: 'CHERI',
        berryCountString: 'CHERI BERRY',
      };
    }

    const tree = this.trees[context.treeId];
    tree.stopGrowth = false; // AllowBerryTreeGrowth

    let stage = tree.stage;
    if (this.consumeSparkling(context)) {
      stage = BERRY_STAGE.SPARKLING;
    }

    const berryName = this.getBerryName(tree.berry);
    this.logBerryDebug('ObjectEventInteractionGetBerryTreeData', {
      treeId: context.treeId,
      stage,
      berryType: tree.berry,
      berryYield: tree.berryYield,
      wateredStages: this.getNumWateredStages(tree),
    });
    return {
      treeId: context.treeId,
      stage,
      wateredStageCount: this.getNumWateredStages(tree),
      berryCount: tree.berryYield,
      berryName,
      berryCountString: this.getBerryCountString(tree.berry, tree.berryYield),
    };
  }

  objectInteractionGetBerryName(): string {
    const tree = this.getInteractionTree();
    if (!tree) return 'CHERI';
    return this.getBerryName(tree.berry);
  }

  objectInteractionGetBerryCountString(): string {
    const tree = this.getInteractionTree();
    if (!tree) return 'CHERI BERRY';
    return this.getBerryCountString(tree.berry, tree.berryYield);
  }

  objectInteractionPlantBerryTree(itemId: number): void {
    const context = this.getInteractionContext();
    if (!context) return;
    const berryType = itemIdToBerryType(itemId);
    const before = this.getTreeSnapshot(context.treeId);
    this.setBerryTree(context.treeId, berryType, BERRY_STAGE.PLANTED, true);
    const after = this.getTreeSnapshot(context.treeId);
    this.logBerryDebug('objectInteractionPlantBerryTree', {
      treeId: context.treeId,
      itemId,
      berryType,
      before,
      after,
    });
  }

  objectInteractionPickBerryTree(): { itemId: number; quantity: number } {
    const tree = this.getInteractionTree();
    if (!tree) {
      return { itemId: 0, quantity: 0 };
    }
    const itemId = berryTypeToItemId(tree.berry);
    const quantity = tree.berryYield;
    return { itemId, quantity };
  }

  objectInteractionRemoveBerryTree(): void {
    const context = this.getInteractionContext();
    if (!context) return;
    const before = this.getTreeSnapshot(context.treeId);
    this.removeBerryTree(context.treeId);
    if (context.localId !== null) {
      this.sparklingKeys.add(this.makeSparklingKey(context.mapId, context.localId));
    }
    this.logBerryDebug('objectInteractionRemoveBerryTree', {
      treeId: context.treeId,
      mapId: context.mapId,
      localId: context.localId,
      before,
      after: this.getTreeSnapshot(context.treeId),
    });
  }

  objectInteractionWaterBerryTree(): boolean {
    const tree = this.getInteractionTree();
    if (!tree) return false;
    switch (tree.stage) {
      case BERRY_STAGE.PLANTED:
        tree.watered1 = true;
        return true;
      case BERRY_STAGE.SPROUTED:
        tree.watered2 = true;
        return true;
      case BERRY_STAGE.TALLER:
        tree.watered3 = true;
        return true;
      case BERRY_STAGE.FLOWERING:
        tree.watered4 = true;
        return true;
      default:
        return false;
    }
  }

  private getInteractionContext(): BerryInteractionContext | null {
    return this.activeInteraction;
  }

  private getInteractionTree(): BerryTreeState | null {
    const context = this.getInteractionContext();
    if (!context) return null;
    return this.trees[context.treeId] ?? null;
  }

  private normalizeTreeId(treeIdInput: string | number): number {
    const resolved = resolveBerryTreeId(treeIdInput);
    if (resolved < 0 || resolved >= BERRY_TREES_COUNT) {
      return 0;
    }
    return resolved;
  }

  private normalizeBerryType(berryTypeInput: number): number {
    const berryType = Math.trunc(berryTypeInput);
    if (berryType <= 0) {
      return itemIdToBerryType(FIRST_BERRY_ITEM_ID);
    }
    const maxBerryType = LAST_BERRY_ITEM_ID - FIRST_BERRY_ITEM_ID + 1;
    if (berryType > maxBerryType) {
      return itemIdToBerryType(FIRST_BERRY_ITEM_ID);
    }
    return berryType;
  }

  private getStageDurationMinutes(berryType: number): number {
    const growth = BERRY_GROWTH_BY_TYPE[berryType] ?? getDefaultBerryGrowth(berryType);
    return growth.stageDurationHours * 60;
  }

  private growBerryTree(tree: BerryTreeState): boolean {
    if (tree.stopGrowth) return false;

    switch (tree.stage) {
      case BERRY_STAGE.NO_BERRY:
        return false;
      case BERRY_STAGE.FLOWERING:
        tree.berryYield = this.calcBerryYield(tree);
        tree.stage++;
        break;
      case BERRY_STAGE.PLANTED:
      case BERRY_STAGE.SPROUTED:
      case BERRY_STAGE.TALLER:
        tree.stage++;
        break;
      case BERRY_STAGE.BERRIES:
        tree.watered1 = false;
        tree.watered2 = false;
        tree.watered3 = false;
        tree.watered4 = false;
        tree.berryYield = 0;
        tree.stage = BERRY_STAGE.SPROUTED;
        tree.regrowthCount++;
        if (tree.regrowthCount === 10) {
          Object.assign(tree, createBlankBerryTree());
        }
        break;
      default:
        break;
    }

    return true;
  }

  private getNumWateredStages(tree: BerryTreeState): number {
    let count = 0;
    if (tree.watered1) count++;
    if (tree.watered2) count++;
    if (tree.watered3) count++;
    if (tree.watered4) count++;
    return count;
  }

  private calcBerryYield(tree: BerryTreeState): number {
    const growth = BERRY_GROWTH_BY_TYPE[tree.berry] ?? getDefaultBerryGrowth(tree.berry);
    return this.calcBerryYieldInternal(growth.maxYield, growth.minYield, this.getNumWateredStages(tree));
  }

  private calcBerryYieldInternal(max: number, min: number, wateredStages: number): number {
    if (wateredStages === 0) {
      return min;
    }

    const randMin = (max - min) * (wateredStages - 1);
    const randMax = (max - min) * wateredStages;
    const rand = randMin + Math.floor(Math.random() * (randMax - randMin + 1));
    let extraYield = Math.floor(rand / NUM_WATER_STAGES);

    if ((rand % NUM_WATER_STAGES) >= NUM_WATER_STAGES / 2) {
      extraYield++;
    }

    return extraYield + min;
  }

  private getBerryName(berryType: number): string {
    const itemId = berryTypeToItemId(berryType);
    const itemName = getItemName(itemId);
    return itemName.replace(/\s+BERR(?:Y|IES)$/i, '').trim() || 'CHERI';
  }

  private getBerryCountString(berryType: number, count: number): string {
    const berryName = this.getBerryName(berryType);
    if (count < 2) {
      return `${berryName} BERRY`;
    }
    return `${berryName} BERRIES`;
  }

  private isBerryDebugEnabled(): boolean {
    return isDebugMode('berry') || isDebugMode('field');
  }

  private logBerryDebug(event: string, payload: Record<string, unknown>): void {
    if (!this.isBerryDebugEnabled()) return;
    console.debug(`[BerryManager] ${event}`, payload);
  }

  private logClockRebase(reason: string, details: Record<string, unknown>): void {
    if (this.isBerryDebugEnabled()) {
      console.warn(`[BerryManager] Rebased berry clock (${reason})`, details);
    }
  }

  private makeSparklingKey(mapId: string, localId: number): string {
    return `${mapId}:${localId}`;
  }

  private consumeSparkling(context: BerryInteractionContext): boolean {
    if (context.localId === null) return false;
    const key = this.makeSparklingKey(context.mapId, context.localId);
    if (!this.sparklingKeys.has(key)) return false;
    this.sparklingKeys.delete(key);
    return true;
  }
}

export const berryManager = new BerryManager();

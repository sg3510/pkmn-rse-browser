import type { WarpTrigger } from '../components/map/utils.ts';
import type { WarpHandler } from '../field/WarpHandler.ts';
import type { PlayerController } from './PlayerController.ts';
import type { LavaridgeWarpSequencer } from './LavaridgeWarpSequencer.ts';
import {
  MB_LAVARIDGE_GYM_B1F_WARP,
  MB_LAVARIDGE_GYM_1F_WARP,
  isLavaridgeB1FTo1FWarpPair,
  isLavaridgeGymWarpBehavior,
} from '../utils/metatileBehaviors.ts';

export interface SpecialWalkOverWarpContext {
  trigger: WarpTrigger;
  now: number;
  currentMapId: string;
  player: PlayerController;
  warpHandler: WarpHandler;
  setPendingWarp: (trigger: WarpTrigger) => void;
  lavaridgeWarpSequencer: LavaridgeWarpSequencer;
}

export interface SpecialWarpArrivalContext {
  trigger: WarpTrigger;
  destinationBehavior: number;
  now: number;
  player: PlayerController;
  playerHiddenRef: { current: boolean };
  lavaridgeWarpSequencer: LavaridgeWarpSequencer;
}

export interface SpecialWarpArrivalResult {
  handled: boolean;
  managesInputUnlock: boolean;
  managesVisibility: boolean;
}

interface SpecialWarpBehavior {
  supportsSourceBehavior: (behavior: number) => boolean;
  startWalkOverWarp?: (ctx: SpecialWalkOverWarpContext) => boolean;
  handleArrival?: (ctx: SpecialWarpArrivalContext) => SpecialWarpArrivalResult;
}

const LAVARIDGE_WARP_BEHAVIOR: SpecialWarpBehavior = {
  supportsSourceBehavior: isLavaridgeGymWarpBehavior,

  startWalkOverWarp(ctx) {
    ctx.warpHandler.startWarp(ctx.player.tileX, ctx.player.tileY, ctx.currentMapId);
    ctx.setPendingWarp(ctx.trigger);
    ctx.player.lockInput();

    if (ctx.trigger.behavior === MB_LAVARIDGE_GYM_B1F_WARP) {
      ctx.lavaridgeWarpSequencer.startB1FWarpOut(
        ctx.player.tileX,
        ctx.player.tileY,
        ctx.trigger.behavior,
        ctx.now,
      );
      return true;
    }

    if (ctx.trigger.behavior === MB_LAVARIDGE_GYM_1F_WARP) {
      ctx.lavaridgeWarpSequencer.start1FWarpOut(
        ctx.player.tileX,
        ctx.player.tileY,
        ctx.trigger.behavior,
        ctx.now,
      );
      return true;
    }

    return false;
  },

  handleArrival(ctx) {
    if (isLavaridgeB1FTo1FWarpPair(ctx.trigger.behavior, ctx.destinationBehavior)) {
      // C parity: player stays hidden until pop-out completes enough to jump east.
      ctx.playerHiddenRef.current = true;
      ctx.lavaridgeWarpSequencer.startB1FWarpArrival(
        ctx.player.tileX,
        ctx.player.tileY,
        ctx.destinationBehavior,
        ctx.now,
      );
      ctx.player.lockInput();
      return {
        handled: true,
        managesInputUnlock: true,
        managesVisibility: true,
      };
    }

    return {
      handled: false,
      managesInputUnlock: false,
      managesVisibility: false,
    };
  },
};

const SPECIAL_WARP_BEHAVIORS: SpecialWarpBehavior[] = [
  LAVARIDGE_WARP_BEHAVIOR,
];

export function startSpecialWalkOverWarp(ctx: SpecialWalkOverWarpContext): boolean {
  const behavior = SPECIAL_WARP_BEHAVIORS.find((entry) =>
    entry.supportsSourceBehavior(ctx.trigger.behavior),
  );

  if (!behavior?.startWalkOverWarp) {
    return false;
  }

  return behavior.startWalkOverWarp(ctx);
}

export function handleSpecialWarpArrival(ctx: SpecialWarpArrivalContext): SpecialWarpArrivalResult {
  const behavior = SPECIAL_WARP_BEHAVIORS.find((entry) =>
    entry.supportsSourceBehavior(ctx.trigger.behavior),
  );

  if (!behavior?.handleArrival) {
    return {
      handled: false,
      managesInputUnlock: false,
      managesVisibility: false,
    };
  }

  return behavior.handleArrival(ctx);
}

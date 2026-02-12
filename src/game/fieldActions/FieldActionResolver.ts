/**
 * Field action eligibility resolver.
 *
 * C references:
 * - public/pokeemerald/src/field_control_avatar.c (TrySetupDiveDownScript / TrySetupDiveEmergeScript)
 * - public/pokeemerald/src/metatile_behavior.c (MetatileBehavior_IsDiveable / IsUnableToEmerge)
 */

import type { PlayerController } from '../PlayerController';
import type { WorldManager } from '../WorldManager';
import {
  MetatileBehavior_IsDiveable,
  MetatileBehavior_IsUnableToEmerge,
} from '../../utils/metatileBehaviors';

export interface FieldActionResolverPolicy {
  ignoreDiveMoveRequirement: boolean;
  ignoreDiveBadgeRequirement: boolean;
}

export const DEFAULT_FIELD_ACTION_POLICY: FieldActionResolverPolicy = {
  // Milestone behavior: Dive works without HM/badge gating.
  ignoreDiveMoveRequirement: true,
  ignoreDiveBadgeRequirement: true,
};

export interface SurfActionResolution {
  kind: 'surf';
  targetX: number;
  targetY: number;
}

export interface DiveActionResolution {
  kind: 'dive';
  mode: 'dive' | 'emerge';
  mapId: string;
  localX: number;
  localY: number;
}

export interface FieldActionResolution {
  surf: SurfActionResolution | null;
  diveDown: DiveActionResolution | null;
  diveEmerge: DiveActionResolution | null;
}

export interface ResolveFieldActionsParams {
  player: PlayerController;
  worldManager: WorldManager | null;
  policy?: FieldActionResolverPolicy;
}

export function resolveFieldActions(params: ResolveFieldActionsParams): FieldActionResolution {
  const { player, worldManager } = params;
  const policy = params.policy ?? DEFAULT_FIELD_ACTION_POLICY;
  void policy;

  const currentMap = worldManager?.findMapAtPosition(player.tileX, player.tileY) ?? null;
  const currentBehavior = player.getCurrentTileBehavior();

  let surf: SurfActionResolution | null = null;
  if (!player.isSurfing() && !player.isUnderwater()) {
    const surfCheck = player.canInitiateSurf();
    if (surfCheck.canSurf && surfCheck.targetX !== undefined && surfCheck.targetY !== undefined) {
      surf = {
        kind: 'surf',
        targetX: surfCheck.targetX,
        targetY: surfCheck.targetY,
      };
    }
  }

  let diveDown: DiveActionResolution | null = null;
  if (
    currentMap
    && player.isSurfing()
    && !player.isUnderwater()
    && currentBehavior !== undefined
    && MetatileBehavior_IsDiveable(currentBehavior)
  ) {
    diveDown = {
      kind: 'dive',
      mode: 'dive',
      mapId: currentMap.entry.id,
      localX: player.tileX - currentMap.offsetX,
      localY: player.tileY - currentMap.offsetY,
    };
  }

  let diveEmerge: DiveActionResolution | null = null;
  if (
    currentMap
    && player.isUnderwater()
    && currentBehavior !== undefined
    && !MetatileBehavior_IsUnableToEmerge(currentBehavior)
  ) {
    diveEmerge = {
      kind: 'dive',
      mode: 'emerge',
      mapId: currentMap.entry.id,
      localX: player.tileX - currentMap.offsetX,
      localY: player.tileY - currentMap.offsetY,
    };
  }

  return {
    surf,
    diveDown,
    diveEmerge,
  };
}


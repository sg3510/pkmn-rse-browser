import type { PlayerController } from '../../game/PlayerController';
import {
  DEFAULT_SPRITE_SUBPRIORITY,
  getPlayerCenterY,
  getPlayerFeetY,
  getPlayerSortKey,
} from '../../game/playerCoords';
import type { SpriteInstance } from '../../rendering/types';
import type { PriorityDebugInfo, SpriteSortDebugInfo } from '../../components/debug';

export interface BuildPriorityDebugInfoParams {
  player: PlayerController;
  allSprites: SpriteInstance[];
  lowPrioritySprites: SpriteInstance[];
  priority0Sprites: SpriteInstance[];
}

function buildSpriteDebug(
  sprite: SpriteInstance,
  playerSortKey: number
): SpriteSortDebugInfo {
  let name = sprite.atlasName || 'unknown';
  let type: SpriteSortDebugInfo['type'] = 'npc';
  let renderLayer = 'withPlayer';

  if (name.includes('player_') || name.includes('player-')) {
    type = 'player';
    name = 'Player';
  } else if (
    name.includes('grass')
    || name.includes('sand')
    || name.includes('ripple')
    || name.includes('splash')
  ) {
    type = 'fieldEffect';
    renderLayer = sprite.sortKey < playerSortKey ? 'bottom' : 'top';
  } else if (sprite.isReflection) {
    type = 'reflection';
    name = `Refl: ${name.replace(/npc[-_]/, '').replace('OBJ_EVENT_GFX_', '')}`;
  } else if (name.startsWith('npc-') || name.startsWith('npc_')) {
    type = 'npc';
    name = name.replace(/npc[-_]/, '').replace('OBJ_EVENT_GFX_', '');
  }

  const spriteFeetY = sprite.worldY + sprite.height;

  return {
    name: name.length > 20 ? `${name.slice(0, 17)}...` : name,
    type,
    tileX: Math.floor((sprite.worldX + sprite.width / 2) / 16),
    tileY: Math.floor(spriteFeetY / 16),
    worldY: sprite.worldY,
    feetY: spriteFeetY,
    sortKeyY: sprite.sortKey >> 8,
    subpriority: sprite.sortKey & 0xFF,
    sortKey: sprite.sortKey,
    renderLayer,
  };
}

export function buildPriorityDebugInfo(params: BuildPriorityDebugInfoParams): PriorityDebugInfo {
  const {
    player,
    allSprites,
    lowPrioritySprites,
    priority0Sprites,
  } = params;

  const playerFeetY = getPlayerFeetY(player);
  const playerSortKeyY = playerFeetY;
  const playerSubpriority = DEFAULT_SPRITE_SUBPRIORITY;
  const playerSortKey = getPlayerSortKey(player);

  const sortedSpritesDebug: SpriteSortDebugInfo[] = [];
  const fieldEffectsDebug: SpriteSortDebugInfo[] = [];
  const npcsDebug: SpriteSortDebugInfo[] = [];
  let npcWithPlayer = 0;
  let npcBehindBridge = 0;
  let npcAboveAll = 0;
  let effectsBottom = 0;
  let effectsTop = 0;

  for (const sprite of allSprites) {
    const debugInfo = buildSpriteDebug(sprite, playerSortKey);

    if (debugInfo.type === 'fieldEffect') {
      if (debugInfo.renderLayer === 'bottom') {
        effectsBottom++;
      } else {
        effectsTop++;
      }
      fieldEffectsDebug.push(debugInfo);
    }

    if (debugInfo.type === 'npc') {
      npcWithPlayer++;
      npcsDebug.push(debugInfo);
    }

    sortedSpritesDebug.push(debugInfo);
  }

  for (const sprite of lowPrioritySprites) {
    if (!sprite.isReflection) {
      npcBehindBridge++;
    }
  }

  for (const sprite of priority0Sprites) {
    if (!sprite.isReflection) {
      npcAboveAll++;
    }
  }

  const nearbySprites = sortedSpritesDebug
    .filter((sprite) => sprite.type !== 'reflection')
    .map((sprite) => ({
      name: sprite.name,
      sortKey: sprite.sortKey,
      diff: sprite.sortKey - playerSortKey,
      rendersAfterPlayer: sprite.sortKey > playerSortKey,
    }))
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
    .slice(0, 15);

  return {
    player: {
      tileX: player.tileX,
      tileY: player.tileY,
      pixelY: player.y,
      feetY: playerFeetY,
      spriteCenter: getPlayerCenterY(player),
      sortKeyY: playerSortKeyY,
      subpriority: playerSubpriority,
      sortKey: playerSortKey,
      elevation: player.getElevation(),
    },
    sortedSprites: sortedSpritesDebug,
    fieldEffects: {
      total: fieldEffectsDebug.length,
      bottom: effectsBottom,
      top: effectsTop,
      effects: fieldEffectsDebug,
    },
    npcs: {
      total: npcsDebug.length + npcBehindBridge + npcAboveAll,
      withPlayer: npcWithPlayer,
      behindBridge: npcBehindBridge,
      aboveAll: npcAboveAll,
      list: npcsDebug,
    },
    comparison: {
      playerSortKey,
      nearbySprites,
    },
  };
}

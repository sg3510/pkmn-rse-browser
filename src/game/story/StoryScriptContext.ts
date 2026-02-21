/**
 * Shared story-script runtime context types.
 */

import type { PartyPokemon } from '../../pokemon/types.ts';
import type { PlayerSpriteKey } from '../playerSprites.ts';
import type {
  ScriptBattleResult,
  ScriptTrainerBattleRequest,
  ScriptWildBattleRequest,
} from '../../scripting/battleTypes.ts';

type ScriptDirection = 'up' | 'down' | 'left' | 'right';
type ScriptMoveMode =
  | 'walk'
  | 'walk_slow'
  | 'walk_fast'
  | 'walk_faster'
  | 'walk_fastest'
  | 'ride_water_current'
  | 'run'
  | 'walk_in_place'
  | 'walk_in_place_slow'
  | 'walk_in_place_fast'
  | 'walk_in_place_faster'
  | 'jump'
  | 'jump_in_place'
  | 'face';

export interface StoryScriptContext {
  showMessage: (text: string) => Promise<void>;
  showChoice: <T>(
    text: string,
    choices: Array<{ label: string; value: T; disabled?: boolean }>,
    options?: { cancelable?: boolean; defaultIndex?: number }
  ) => Promise<T | null>;
  getPlayerGender: () => 0 | 1;
  getPlayerName: () => string;
  hasPartyPokemon: () => boolean;
  setParty: (party: (PartyPokemon | null)[]) => void;
  startFirstBattle: (starter: PartyPokemon) => Promise<void>;
  startTrainerBattle?: (request: ScriptTrainerBattleRequest) => Promise<ScriptBattleResult>;
  startWildBattle?: (request: ScriptWildBattleRequest) => Promise<ScriptBattleResult>;
  queueWarp: (
    mapId: string,
    x: number,
    y: number,
    direction: ScriptDirection,
    options?: { style?: 'default' | 'fall' }
  ) => Promise<void>;
  forcePlayerStep: (direction: ScriptDirection) => void;
  delayFrames: (frames: number) => Promise<void>;
  movePlayer: (direction: ScriptDirection, mode?: ScriptMoveMode) => Promise<void>;
  moveNpc: (
    mapId: string,
    localId: string,
    direction: ScriptDirection,
    mode?: ScriptMoveMode
  ) => Promise<void>;
  faceNpcToPlayer: (mapId: string, localId: string) => void;
  setNpcPosition: (mapId: string, localId: string, tileX: number, tileY: number) => void;
  /**
   * Set an NPC's template/spawn map-local position (setobjectxyperm parity).
   * This should not move a currently visible NPC immediately.
   */
  setNpcTemplatePosition?: (mapId: string, localId: string, tileX: number, tileY: number) => void;
  setNpcVisible: (mapId: string, localId: string, visible: boolean, persistent?: boolean) => void;
  playDoorAnimation: (
    mapId: string,
    tileX: number,
    tileY: number,
    direction: 'open' | 'close'
  ) => Promise<void>;
  setPlayerVisible: (visible: boolean) => void;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number, collision?: number) => void;
  setNpcMovementType?: (mapId: string, localId: string, movementTypeRaw: string) => void;
  setSpriteHidden?: (mapId: string, localId: string, hidden: boolean) => void;
  /**
   * Start tree/mountain disguise reveal animation while keeping trainer sprite hidden.
   */
  startNpcDisguiseReveal?: (mapId: string, localId: string) => boolean;
  /**
   * End tree/mountain disguise reveal animation and unhide trainer sprite.
   */
  finishNpcDisguiseReveal?: (mapId: string, localId: string) => boolean;
  showYesNo?: (text: string) => Promise<boolean>;
  getParty?: () => (PartyPokemon | null)[];
  hasNpc?: (mapId: string, localId: string) => boolean;
  /** Resolve which map currently owns a local object ID. */
  findNpcMapId?: (localId: string) => string | null;
  /** Get NPC's current world position (for copyobjectxytoperm) */
  getNpcPosition?: (mapId: string, localId: string) => { tileX: number; tileY: number } | null;
  /** Get NPC graphics ID (for object-event affine script commands) */
  getNpcGraphicsId?: (mapId: string, localId: string) => string | null;
  /** Get map offset for converting world→local coords */
  getMapOffset?: (mapId: string) => { offsetX: number; offsetY: number } | null;
  /** Set the player's facing direction (used by turnobject LOCALID_PLAYER) */
  setPlayerDirection?: (dir: 'up' | 'down' | 'left' | 'right') => void;
  /** Temporarily override player sprite for scripted avatar states (e.g. watering). */
  setPlayerSpriteOverride?: (spriteKey: PlayerSpriteKey | null) => void;
  /** Get the player's map-local tile position (used by getplayerxy) */
  getPlayerLocalPosition?: () => { x: number; y: number } | null;
  /** Get the player's destination map-local tile position (PlayerGetDestCoords parity). */
  getPlayerDestLocalPosition?: () => { x: number; y: number } | null;
  /** Wait for the player to finish any in-flight movement before continuing script execution. */
  waitForPlayerIdle?: () => Promise<void>;
  /**
   * Wait for a specific NPC to finish in-flight movement (lock command parity).
   * mapId/localId use script-visible identifiers (map constant + local object ID).
   */
  waitForNpcIdle?: (mapId: string, localId: string) => Promise<void>;
  /** Current GBA frame for debug tracing. */
  getCurrentGbaFrame?: () => number;
  /** Previous map type from last used warp (C: GetLastUsedWarpMapType). */
  getLastUsedWarpMapType?: () => string | null;
  /**
   * Show an overhead emote icon (exclamation/question/heart) on an object.
   * Used by hand-coded story flows that haven't migrated to generated movements.
   */
  showEmote?: (
    mapId: string,
    localId: string,
    emote: 'exclamation' | 'question' | 'heart',
    waitFrames?: number
  ) => Promise<void>;
  /** Previous map ID from last used warp (used by cycling-road state logic). */
  getLastUsedWarpMapId?: () => string | null;
  /** Current player bike mode: 0=none, 1=acro, 2=mach. */
  getPlayerAvatarBike?: () => 0 | 1 | 2;
  /** Toggle cycling-road challenge collision tracking on player runtime. */
  setCyclingRoadChallengeActive?: (active: boolean) => void;
  /** Current cycling-road collision count from player runtime. */
  getCyclingRoadChallengeCollisions?: () => number;
  /** Set flash/darkness level (0=bright, 8=fully black) for caves/Dewford Gym. */
  setFlashLevel?: (level: number) => void;
  /** Animate the darkness radius toward the target level without persisting it. */
  animateFlashLevel?: (level: number) => Promise<void>;
  /** Get metatile ID at a map-local tile position (used by gym puzzle specials) */
  getMapMetatile?: (mapId: string, tileX: number, tileY: number) => number;
  /** Get all NPC local IDs on a given map (used by rotating tile puzzle) */
  getAllNpcLocalIds?: (mapId: string) => string[];
  /** Swap the current map's layout by layout constant (setmaplayoutindex parity). */
  setCurrentMapLayoutById?: (layoutId: string) => Promise<boolean>;
}

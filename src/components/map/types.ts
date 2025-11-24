import { type WorldMapInstance, type WorldState, type TilesetResources } from '../../services/MapManager';
import { type Metatile, type MetatileAttributes, type MapTileData } from '../../utils/mapLoader';
import { type LoadedAnimation } from '../../hooks/map/useMapAssets';
import { type TilesetKind } from '../../data/tilesetAnimations';
import { type WarpEvent } from '../../types/maps';
import { type CameraView } from '../../utils/camera';
import { type PlayerController } from '../../game/PlayerController';
import { type CardinalDirection } from '../../utils/metatileBehaviors';
export { type LoadedAnimation, type TilesetKind };

export type ReflectionType = 'water' | 'ice';
export type WarpKind = 'door' | 'teleport' | 'arrow';

export interface ReflectionMeta {
  isReflective: boolean;
  reflectionType: ReflectionType | null;
  pixelMask: Uint8Array; // 16x16 mask where 1 = BG1 transparent (reflection allowed), 0 = opaque
}

export interface TilesetBuffers {
  primary: Uint8Array;
  secondary: Uint8Array;
}

export interface TilesetRuntime {
  resources: TilesetResources;
  primaryTileMasks: Uint8Array[];
  secondaryTileMasks: Uint8Array[];
  primaryReflectionMeta: ReflectionMeta[];
  secondaryReflectionMeta: ReflectionMeta[];
  animations: LoadedAnimation[];
  animatedTileIds: { primary: Set<number>; secondary: Set<number> };
  patchedTiles: TilesetBuffers | null;
  lastPatchedKey: string;
}

export interface RenderContext {
  world: WorldState;
  tilesetRuntimes: Map<string, TilesetRuntime>;
  anchor: WorldMapInstance;
}

export interface ResolvedTile {
  map: WorldMapInstance;
  tileset: TilesetResources;
  metatile: Metatile | null;
  attributes: MetatileAttributes | undefined;
  mapTile: MapTileData;
  isSecondary: boolean;
  isBorder: boolean;
}

export interface DebugTileInfo {
  inBounds: boolean;
  tileX: number;
  tileY: number;
  mapTile?: MapTileData;
  metatileId?: number;
  isSecondary?: boolean;
  behavior?: number;
  layerType?: number;
  layerTypeLabel?: string;
  isReflective?: boolean;
  reflectionType?: ReflectionType | null;
  reflectionMaskAllow?: number;
  reflectionMaskTotal?: number;
  bottomTiles?: Metatile['tiles'];
  topTiles?: Metatile['tiles'];
  // Additional debug info
  mapId?: string;
  mapName?: string;
  localX?: number;
  localY?: number;
  paletteIndex?: number;
  warpEvent?: any; // WarpEvent is not exported from types/maps yet, using any for now or import it
  warpKind?: WarpKind | null;
  primaryTilesetId?: string;
  secondaryTilesetId?: string;
  // Elevation and collision info
  elevation?: number;
  collision?: number;
  collisionPassable?: boolean;
  // Rendering debug info
  playerElevation?: number;
  isLedge?: boolean;
  ledgeDirection?: string;
  bottomLayerTransparency?: number;
  topLayerTransparency?: number;
  renderedInBackgroundPass?: boolean;
  renderedInTopBelowPass?: boolean;
  renderedInTopAbovePass?: boolean;
  topBelowPassReason?: string;
  topAbovePassReason?: string;
  // Detailed tile info
  bottomTileDetails?: string[];
  topTileDetails?: string[];
  adjacentTileInfo?: {
    north?: { metatileId: number; layerType: number; layerTypeLabel: string };
    south?: { metatileId: number; layerType: number; layerTypeLabel: string };
    east?: { metatileId: number; layerType: number; layerTypeLabel: string };
    west?: { metatileId: number; layerType: number; layerTypeLabel: string };
  };
  // Facing tile info
  facingTileX?: number;
  facingTileY?: number;
  facingMetatileId?: number;
  facingBehavior?: number;
  facingIsSurfable?: boolean;
  facingIsWaterfall?: boolean;
  canSurfResult?: string;
}

import { type BridgeType } from '../../utils/metatileBehaviors';

export interface ReflectionState {
  hasReflection: boolean;
  reflectionType: ReflectionType | null;
  bridgeType: BridgeType;
}

export type AnimationState = Record<string, number>;

export type DoorSize = 1 | 2;

export interface WorldCameraView extends CameraView {
  worldStartTileX: number;
  worldStartTileY: number;
  cameraWorldX: number;
  cameraWorldY: number;
}

export interface WarpTrigger {
  kind: WarpKind;
  sourceMap: WorldMapInstance;
  warpEvent: WarpEvent;
  behavior: number;
  facing: PlayerController['dir'];
}

export interface WarpRuntimeState {
  inProgress: boolean;
  cooldownMs: number;
  lastCheckedTile?: { mapId: string; x: number; y: number };
}

export interface DoorAnimDrawable {
  id: number;
  image: HTMLImageElement;
  direction: 'open' | 'close';
  frameCount: number;
  frameHeight: number;
  frameDuration: number;
  worldX: number;
  worldY: number;
  size: DoorSize;
  startedAt: number;
  holdOnComplete?: boolean;
  metatileId: number;
}

export interface DoorEntrySequence {
  stage: 'idle' | 'opening' | 'stepping' | 'closing' | 'waitingBeforeFade' | 'fadingOut' | 'warping';
  trigger: WarpTrigger | null;
  targetX: number;
  targetY: number;
  metatileId: number;
  isAnimatedDoor?: boolean; // If false, skip door animation but still do entry sequence
  entryDirection?: CardinalDirection;
  openAnimId?: number;
  closeAnimId?: number;
  playerHidden?: boolean;
  waitStartedAt?: number;
}

export interface DoorExitSequence {
  stage: 'idle' | 'opening' | 'stepping' | 'closing' | 'done';
  doorWorldX: number;
  doorWorldY: number;
  metatileId: number;
  isAnimatedDoor?: boolean; // If false, skip door animation but still do scripted movement
  exitDirection?: 'up' | 'down' | 'left' | 'right'; // Direction to walk when exiting
  openAnimId?: number;
  closeAnimId?: number;
}

export interface ArrowOverlayState {
  visible: boolean;
  worldX: number;
  worldY: number;
  direction: CardinalDirection;
  startedAt: number;
}

export interface FadeState {
  mode: 'in' | 'out' | null;
  startedAt: number;
  duration: number;
}

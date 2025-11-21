export interface MapConnection {
  map: string;
  offset: number;
  direction: string;
}

export interface WarpEvent {
  x: number;
  y: number;
  elevation: number;
  destMap: string;
  destWarpId: number;
}

export interface MapIndexEntry {
  id: string;
  name: string;
  folder: string;
  layoutId: string;
  width: number;
  height: number;
  layoutPath: string;
  primaryTilesetId: string;
  secondaryTilesetId: string;
  primaryTilesetPath: string;
  secondaryTilesetPath: string;
  connections: MapConnection[];
  mapType: string | null;
  regionMapSection: string | null;
}

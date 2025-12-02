/**
 * SpawnPositionFinder - Finds optimal player spawn positions on maps
 *
 * Uses BFS from map center to find tiles with maximum walkability,
 * avoiding positions where the player would be surrounded by collision.
 * Also considers map edge reachability and warp point accessibility.
 */

export interface SpawnFinderConfig {
  /** Search radius from center in tiles (default: 8) */
  searchRadius?: number;
  /** Maximum walk distance to measure per direction (default: 5) */
  walkDistanceCap?: number;
  /** Minimum required open directions to be a valid candidate (default: 1) */
  requireMinDirections?: number;
  /** Maximum tiles to explore for reachability checks (default: 500) */
  reachabilityLimit?: number;
  /** Score bonus per reachable map edge (default: 50) */
  edgeReachabilityBonus?: number;
  /** Score bonus for having at least one reachable warp (default: 100) */
  warpReachabilityBonus?: number;
}

/** A point of interest (warp location) */
export interface WarpPoint {
  x: number;
  y: number;
}

export interface WalkDistance {
  up: number;
  down: number;
  left: number;
  right: number;
}

export interface EdgeReachability {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
  count: number;
}

export interface WarpReachability {
  reachableCount: number;
  totalCount: number;
  hasAnyReachable: boolean;
}

export interface SpawnResult {
  x: number;
  y: number;
  score: number;
  immediateDirections: number;
  walkDistance: WalkDistance;
  edgeReachability: EdgeReachability;
  warpReachability: WarpReachability;
  isCenter: boolean;
}

interface Candidate {
  x: number;
  y: number;
  score: number;
  immediateDirections: number;
  walkDistance: WalkDistance;
  distanceFromCenter: number;
  edgeReachability: EdgeReachability;
  warpReachability: WarpReachability;
}

const DIRECTIONS: Array<{ name: keyof WalkDistance; dx: number; dy: number }> = [
  { name: "up", dx: 0, dy: -1 },
  { name: "down", dx: 0, dy: 1 },
  { name: "left", dx: -1, dy: 0 },
  { name: "right", dx: 1, dy: 0 },
];

export class SpawnPositionFinder {
  private readonly searchRadius: number;
  private readonly walkDistanceCap: number;
  private readonly requireMinDirections: number;
  private readonly reachabilityLimit: number;
  private readonly edgeReachabilityBonus: number;
  private readonly warpReachabilityBonus: number;

  constructor(config?: SpawnFinderConfig) {
    this.searchRadius = config?.searchRadius ?? 8;
    this.walkDistanceCap = config?.walkDistanceCap ?? 5;
    this.requireMinDirections = config?.requireMinDirections ?? 1;
    this.reachabilityLimit = config?.reachabilityLimit ?? 500;
    this.edgeReachabilityBonus = config?.edgeReachabilityBonus ?? 50;
    this.warpReachabilityBonus = config?.warpReachabilityBonus ?? 100;
  }

  /**
   * Find optimal spawn position for a map.
   * @param mapWidth - Map width in tiles
   * @param mapHeight - Map height in tiles
   * @param isPassable - Function that returns true if tile is walkable
   * @param warpPoints - Optional array of warp point locations for exit reachability
   * @returns Optimal spawn position with scoring metadata
   */
  findSpawnPosition(
    mapWidth: number,
    mapHeight: number,
    isPassable: (x: number, y: number) => boolean,
    warpPoints?: WarpPoint[]
  ): SpawnResult {
    const centerX = Math.floor(mapWidth / 2);
    const centerY = Math.floor(mapHeight / 2);

    // Adjust search radius for small maps
    const effectiveRadius = Math.min(
      this.searchRadius,
      Math.floor(Math.min(mapWidth, mapHeight) / 2)
    );

    const candidates: Candidate[] = [];
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; dist: number }> = [
      { x: centerX, y: centerY, dist: 0 },
    ];

    // BFS from center to find candidates
    while (queue.length > 0) {
      const current = queue.shift()!;
      const { x, y, dist } = current;
      const key = `${x},${y}`;

      if (visited.has(key) || dist > effectiveRadius) {
        continue;
      }
      visited.add(key);

      // Check if this tile is a valid candidate
      if (this.isInBounds(x, y, mapWidth, mapHeight) && isPassable(x, y)) {
        const score = this.calculateScore(
          x,
          y,
          centerX,
          centerY,
          mapWidth,
          mapHeight,
          isPassable,
          warpPoints
        );

        if (score.immediateDirections >= this.requireMinDirections) {
          candidates.push({
            x,
            y,
            ...score,
          });
        }
      }

      // Add neighbors to queue
      for (const dir of DIRECTIONS) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        const nkey = `${nx},${ny}`;

        if (
          !visited.has(nkey) &&
          this.isInBounds(nx, ny, mapWidth, mapHeight)
        ) {
          queue.push({ x: nx, y: ny, dist: dist + 1 });
        }
      }
    }

    // Select best candidate
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      return {
        x: best.x,
        y: best.y,
        score: best.score,
        immediateDirections: best.immediateDirections,
        walkDistance: best.walkDistance,
        edgeReachability: best.edgeReachability,
        warpReachability: best.warpReachability,
        isCenter: best.x === centerX && best.y === centerY,
      };
    }

    // Fallback to center
    return {
      x: centerX,
      y: centerY,
      score: 0,
      immediateDirections: 0,
      walkDistance: { up: 0, down: 0, left: 0, right: 0 },
      edgeReachability: { north: false, south: false, east: false, west: false, count: 0 },
      warpReachability: { reachableCount: 0, totalCount: warpPoints?.length ?? 0, hasAnyReachable: false },
      isCenter: true,
    };
  }

  private isInBounds(
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    return x >= 0 && x < width && y >= 0 && y < height;
  }

  /**
   * Check which map edges and warp points are reachable from a starting tile via flood fill.
   * This helps avoid spawning on small isolated islands or areas without exits.
   */
  private checkReachability(
    startX: number,
    startY: number,
    mapWidth: number,
    mapHeight: number,
    isPassable: (x: number, y: number) => boolean,
    warpPoints?: WarpPoint[]
  ): { edges: EdgeReachability; warps: WarpReachability } {
    const edges: EdgeReachability = {
      north: false,
      south: false,
      east: false,
      west: false,
      count: 0,
    };

    // Build a set of warp point keys for quick lookup
    const warpSet = new Set<string>();
    if (warpPoints) {
      for (const wp of warpPoints) {
        warpSet.add(`${wp.x},${wp.y}`);
      }
    }
    const reachableWarps = new Set<string>();

    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    let explored = 0;

    // Track if all goals are found for early exit
    let allEdgesFound = false;
    let allWarpsFound = warpSet.size === 0;

    while (queue.length > 0 && explored < this.reachabilityLimit) {
      // Early exit if everything is found
      if (allEdgesFound && allWarpsFound) break;

      const { x, y } = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);
      explored++;

      // Check if we've reached any map edge
      if (y === 0) edges.north = true;
      if (y === mapHeight - 1) edges.south = true;
      if (x === 0) edges.west = true;
      if (x === mapWidth - 1) edges.east = true;

      // Check if we've reached a warp point
      if (warpSet.has(key)) {
        reachableWarps.add(key);
      }

      // Update early exit conditions
      allEdgesFound = edges.north && edges.south && edges.east && edges.west;
      allWarpsFound = reachableWarps.size === warpSet.size;

      // Add passable neighbors to queue
      for (const dir of DIRECTIONS) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        const nkey = `${nx},${ny}`;

        if (
          !visited.has(nkey) &&
          this.isInBounds(nx, ny, mapWidth, mapHeight) &&
          isPassable(nx, ny)
        ) {
          queue.push({ x: nx, y: ny });
        }
      }
    }

    // Count reachable edges
    edges.count =
      (edges.north ? 1 : 0) +
      (edges.south ? 1 : 0) +
      (edges.east ? 1 : 0) +
      (edges.west ? 1 : 0);

    const warps: WarpReachability = {
      reachableCount: reachableWarps.size,
      totalCount: warpSet.size,
      hasAnyReachable: reachableWarps.size > 0,
    };

    return { edges, warps };
  }

  private calculateScore(
    x: number,
    y: number,
    centerX: number,
    centerY: number,
    mapWidth: number,
    mapHeight: number,
    isPassable: (x: number, y: number) => boolean,
    warpPoints?: WarpPoint[]
  ): Omit<Candidate, "x" | "y"> {
    let immediateDirections = 0;
    const walkDistance: WalkDistance = { up: 0, down: 0, left: 0, right: 0 };

    for (const dir of DIRECTIONS) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;

      // Check immediate neighbor
      if (
        this.isInBounds(nx, ny, mapWidth, mapHeight) &&
        isPassable(nx, ny)
      ) {
        immediateDirections++;

        // Count walkable distance in this direction
        let dist = 1;
        while (dist <= this.walkDistanceCap) {
          const checkX = x + dir.dx * dist;
          const checkY = y + dir.dy * dist;

          if (
            !this.isInBounds(checkX, checkY, mapWidth, mapHeight) ||
            !isPassable(checkX, checkY)
          ) {
            break;
          }
          dist++;
        }
        walkDistance[dir.name] = dist - 1;
      }
    }

    // Check edge and warp reachability (combined flood fill)
    const { edges: edgeReachability, warps: warpReachability } = this.checkReachability(
      x,
      y,
      mapWidth,
      mapHeight,
      isPassable,
      warpPoints
    );

    // Manhattan distance from center
    const distanceFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);

    // Calculate total score
    const totalWalkDistance =
      walkDistance.up +
      walkDistance.down +
      walkDistance.left +
      walkDistance.right;

    // Scoring strategy depends on whether this is a connected map (has map stitching) or not:
    // - If warps are provided: this is likely an unconnected/indoor map, so warp reachability
    //   is critical and edge reachability is meaningless
    // - If no warps provided: this is likely a connected/outdoor map, so edge reachability matters
    const hasWarps = warpReachability.totalCount > 0;

    let warpScore = 0;
    let edgeScore = 0;

    if (hasWarps) {
      // Unconnected map: only warp reachability matters
      if (warpReachability.hasAnyReachable) {
        warpScore = this.warpReachabilityBonus;
      } else {
        // Heavy penalty for being in an area with no exit
        warpScore = -300;
      }
      // Ignore edge reachability for unconnected maps
      edgeScore = 0;
    } else {
      // Connected map: edge reachability matters (for map stitching)
      edgeScore = edgeReachability.count * this.edgeReachabilityBonus;
    }

    const score =
      immediateDirections * 25 +    // 0-100 for open neighbors
      totalWalkDistance * 5 +       // 0-100 for walkability depth
      edgeScore +                   // 0-200 for edge connectivity (connected maps only)
      warpScore -                   // warp accessibility (unconnected maps only)
      distanceFromCenter * 2;       // Penalty for distance from center

    return {
      score,
      immediateDirections,
      walkDistance,
      distanceFromCenter,
      edgeReachability,
      warpReachability,
    };
  }
}

// Export a default instance for convenience
export const spawnPositionFinder = new SpawnPositionFinder();

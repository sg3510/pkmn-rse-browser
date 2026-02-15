# Prioritized Memory Actions (Phase 1)

## Method
- Score factors: growth magnitude, repeatability, retaining-path plausibility, and prod-likelihood.
- Classification: `Dev-only inflation`, `Likely real leak/bloat`, `Unknown - needs targeted profiling`.

## Ranked Actions
1. (anonymous) (src/components/debug/DebugPanel.tsx) [high-risk] (score=0.71, source=heapprofile)
   Action: Profile with debug panel closed/open to isolate debug UI memory inflation and separate production-critical impact.
2. PerformanceMeasure [high-risk] (score=0.71, source=heapsnapshot_series)
   Action: Treat as dev-only inflation candidate; re-check persistence in production-build captures.
3. system / ExternalStringData [possible-prod-risk] (score=0.66, source=latest_heapsnapshot)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
4. Object [possible-prod-risk] (score=0.65, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
5. system / JSArrayBufferData [possible-prod-risk] (score=0.642, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
6. Tileset upload churn outside explicit warp windows [possible-prod-risk] (score=0.64, source=console)
   Action: Investigate repeated tileset uploads per transition and validate expected vs redundant upload paths (analysis-only in Phase 1).
7. (object elements) [possible-prod-risk] (score=0.596, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
8. Uint8Array [possible-prod-risk] (score=0.563, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
9. ArrayBuffer [possible-prod-risk] (score=0.555, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
10. FiberNode [possible-prod-risk] (score=0.527, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
11. Array [possible-prod-risk] (score=0.515, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
12. (object properties) [possible-prod-risk] (score=0.51, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
13. CanvasRenderingContext2D [possible-prod-risk] (score=0.505, source=heapsnapshot_series)
   Action: Follow up from heapsnapshot_series: validate persistence in production-build and deployed captures before runtime changes.
14. Warp start/complete lifecycle balance [possible-prod-risk] (score=0.5, source=console)
   Action: Follow up from console: validate persistence in production-build and deployed captures before runtime changes.
15. loadMetatileDefinitions (src/utils/mapLoader.ts) [possible-prod-risk] (score=0.478, source=heapprofile)
   Action: Follow up from heapprofile: validate persistence in production-build and deployed captures before runtime changes.
16. system / ExternalStringData [possible-prod-risk] (score=0.476, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
17. system / TrustedByteArray [possible-prod-risk] (score=0.473, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
18. system / Map [possible-prod-risk] (score=0.457, source=heapsnapshot_series)
   Action: Follow up from heapsnapshot_series: validate persistence in production-build and deployed captures before runtime changes.
19. system / ObjectBoilerplateDescription [possible-prod-risk] (score=0.456, source=heapsnapshot_series)
   Action: Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.
20. system / Context [possible-prod-risk] (score=0.455, source=heapsnapshot_series)
   Action: Follow up from heapsnapshot_series: validate persistence in production-build and deployed captures before runtime changes.

## Dev-only inflation
- PerformanceMeasure (score=0.71, source=heapsnapshot_series)
- Object (score=0.449, source=latest_heapsnapshot)
- Dev trace noise dominates console artifact (score=0.429, source=console)
- (object elements) (score=0.418, source=latest_heapsnapshot)
- system / JSArrayBufferData (score=0.415, source=latest_heapsnapshot)
- PerformanceMeasure (score=0.408, source=latest_heapsnapshot)
- PerformanceEventTiming (score=0.406, source=heapsnapshot_series)
- system / BytecodeArray (score=0.404, source=heapsnapshot_series)
- system / PropertyArray (score=0.404, source=heapsnapshot_series)
- Uint8Array (score=0.401, source=latest_heapsnapshot)
- (object properties) (score=0.4, source=latest_heapsnapshot)
- ArrayBuffer (score=0.399, source=latest_heapsnapshot)
- buildTileTransparencyLUT (src/utils/tilesetUtils.ts) (score=0.392, source=heapprofile)
- FiberNode (score=0.392, source=latest_heapsnapshot)
- heap number (score=0.385, source=heapsnapshot_series)

## Likely real leak/bloat
- (anonymous) (src/components/debug/DebugPanel.tsx) (score=0.71, source=heapprofile)

## Unknown - needs targeted profiling
- system / ExternalStringData (score=0.66, source=latest_heapsnapshot)
- Object (score=0.65, source=heapsnapshot_series)
- system / JSArrayBufferData (score=0.642, source=heapsnapshot_series)
- Tileset upload churn outside explicit warp windows (score=0.64, source=console)
- (object elements) (score=0.596, source=heapsnapshot_series)
- Uint8Array (score=0.563, source=heapsnapshot_series)
- ArrayBuffer (score=0.555, source=heapsnapshot_series)
- FiberNode (score=0.527, source=heapsnapshot_series)
- Array (score=0.515, source=heapsnapshot_series)
- (object properties) (score=0.51, source=heapsnapshot_series)
- CanvasRenderingContext2D (score=0.505, source=heapsnapshot_series)
- Warp start/complete lifecycle balance (score=0.5, source=console)
- loadMetatileDefinitions (src/utils/mapLoader.ts) (score=0.478, source=heapprofile)
- system / ExternalStringData (score=0.476, source=heapsnapshot_series)
- system / TrustedByteArray (score=0.473, source=heapsnapshot_series)

## Production Follow-up (Required)
- Capture set A: local production build (`build + preview`) snapshots at minute 2, 11, and 20 + allocation sampling.
- Capture set B: deployed prod/staging snapshots at minute 2, 11, and 20 + allocation sampling.
- Gate: pass only if memory plateaus under **500 MB** and post-minute-10 slope is <= 2 MB/min.


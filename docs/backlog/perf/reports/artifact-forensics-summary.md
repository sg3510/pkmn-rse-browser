# Artifact Forensics Summary

## Scope
- Perf directory: `docs/backlog/perf`
- 500 MB gate target: **enabled**
- Console log: `docs/backlog/perf/console.txt.log`
- Heap profile: `docs/backlog/perf/Heap-20260215T152543.heapprofile`
- Heap snapshots: 5

## Growth Signals
- Snapshot node delta: 505356 (40.045%)
- Snapshot edge delta: 2118464 (34.784%)
- Snapshot total self-size delta: 31.7 MB
- Uploads per warp (console): 2.875
- Console dev-marker ratio: 0.0893

## Top Risk Items
- [high-risk] (anonymous) (src/components/debug/DebugPanel.tsx) (score=0.71, source=heapprofile)
- [high-risk] PerformanceMeasure (score=0.71, source=heapsnapshot_series)
- [possible-prod-risk] system / ExternalStringData (score=0.66, source=latest_heapsnapshot)
- [possible-prod-risk] Object (score=0.65, source=heapsnapshot_series)
- [possible-prod-risk] system / JSArrayBufferData (score=0.642, source=heapsnapshot_series)
- [possible-prod-risk] Tileset upload churn outside explicit warp windows (score=0.64, source=console)
- [possible-prod-risk] (object elements) (score=0.596, source=heapsnapshot_series)
- [possible-prod-risk] Uint8Array (score=0.563, source=heapsnapshot_series)
- [possible-prod-risk] ArrayBuffer (score=0.555, source=heapsnapshot_series)
- [possible-prod-risk] FiberNode (score=0.527, source=heapsnapshot_series)
- [possible-prod-risk] Array (score=0.515, source=heapsnapshot_series)
- [possible-prod-risk] (object properties) (score=0.51, source=heapsnapshot_series)

## Production Confidence
- Level: **low**
- Score: 0.21
- Rationale: Current artifacts are development-session captures with mixed signal; production confidence is low until production-build captures are compared to the 500 MB gate.

## Next Profiles Required
- Capture set A: local production build (`build + preview`) snapshots at minute 2, 11, and 20 + allocation sampling.
- Capture set B: deployed prod/staging snapshots at minute 2, 11, and 20 + allocation sampling.
- Compare both sets with this same artifact-forensics script set and enforce the 500 MB gate.
- Require post-minute-10 slope <= 2 MB/min for production sign-off.


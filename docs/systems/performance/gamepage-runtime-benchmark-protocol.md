# GamePage Runtime Benchmark Protocol

This protocol is for measuring runtime loop performance changes in production mode and comparing branches with consistent scenarios.

## Prerequisites

1. Use the same machine, browser, display refresh rate, and power profile for baseline and candidate runs.
2. Close heavy background apps.
3. Use production build only. Do not profile in dev mode (React StrictMode changes runtime behavior).

## Build And Run

1. `npm run build`
2. `npm run preview`
3. Open the preview URL in the browser.

## Capture API

Use the dev console runtime perf API:

- `window.__PKMN_PERF.startCapture(name)`
- `window.__PKMN_PERF.stopCapture()`
- `window.__PKMN_PERF.getSummary()`
- `window.__PKMN_PERF.exportJson()`

Recommended capture workflow:

1. `window.__PKMN_PERF.startCapture("idle-baseline")`
2. Run the scenario for 60 seconds.
3. `window.__PKMN_PERF.stopCapture()`
4. `copy(window.__PKMN_PERF.exportJson())` and save to a JSON file.

## Scenarios (60s each)

Run all three for baseline and candidate branch:

1. Idle overworld: stand still in a representative outdoor map.
2. Seam traversal: repeatedly cross Littleroot <-> Route 101 seam.
3. Warp loop: repeat a door enter/exit loop with scripted map transitions.

## Metrics To Compare

From each summary JSON:

1. `sectionStats.frameTotal.avg`
2. `sectionStats.frameTotal.p95`
3. `sectionStats.frameTotal.p99`
4. `counterTotals.readPixelsCalls`
5. `counterTotals.setStateFromRafCalls`
6. `counterTotals.waterMaskBuilds`
7. `counterTotals.waterMaskUploads`
8. `counterTotals.visibleListRebuilds`

## Pass Criteria

1. `frameTotal.p95` improves by at least 20% in at least 2 of 3 scenarios.
2. No scenario regresses `frameTotal.avg` by more than 5%.
3. Normal runtime has `readPixelsCalls === 0`.
4. Debug-disabled runtime shows near-zero `setStateFromRafCalls` (excluding non-RAF UI events).

## Reporting Template

For each scenario, report:

1. Baseline `avg/p95/p99`
2. Candidate `avg/p95/p99`
3. Percent deltas (`avg`, `p95`, `p99`)
4. Counter deltas for `readPixelsCalls`, `setStateFromRafCalls`, `waterMaskBuilds`, `waterMaskUploads`, `visibleListRebuilds`

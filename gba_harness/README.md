# GBA Harness (mGBA + TypeScript)

This folder contains a local testing harness that lets a TypeScript script control a running GBA ROM in mGBA.

## Why this backend

- mGBA is the most reliable emulator core for correctness.
- mGBA has a first-party scripting API with socket support.
- This harness keeps control logic in TypeScript while mGBA runs the ROM natively.

Current references (via web search):
- mGBA downloads: https://mgba.io/downloads.html
- mGBA scripting API (includes `emu`, `socket`, key constants): https://mgba.io/docs/scripting.html
- gbajs3 (mGBA WASM stack): https://github.com/thenick775/gbajs3

## Files

- `lua/mgba_harness.lua`: socket bridge loaded by mGBA.
- `src/mgbaClient.ts`: TypeScript client for bridge commands.
- `src/runHarness.ts`: CLI runner for JSON scripts.
- `examples/title-screen.json`: example action script.
- `examples/pgo-workload.json`: workload used by the build script when PGO is enabled.
- `scripts/build-mgba-qt-opt.sh`: reproducible custom mGBA build script.

## mGBA build requirement

Two ways to run this harness:

1. Custom source build (recommended, what we tested):
   - Qt frontend with scripting enabled and `--script` support.
   - Build it with:

```bash
cd /Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness
npm run mgba:build-opt -- --clean
```

   - Output binary:
     - `/tmp/mgba-build-qt-opt/qt/mGBA.app/Contents/MacOS/mGBA`
   - Note: on AppleClang, the script auto-disables PGO and keeps Release+LTO (upstream stage-2 PGO flags are GCC-specific).
2. Official download build from mgba.io:
   - You can still use the harness, but you may need to open the script manually from the GUI (`Tools` -> `Scripting...`) instead of using `--script`.

## Tested environment

Last verified: `2026-02-14`

- Host OS: `macOS 26.2 (25C56)`
- Custom mGBA binary: `/tmp/mgba-build-qt-opt/qt/mGBA.app/Contents/MacOS/mGBA`
- Custom mGBA version: `0.11-1-c30aaa8 (c30aaa8f42b5b786924d955630b29cd990176968)`
- Node.js tested: `v25.6.1` (project minimum is `>=20.19.0`)
- npm tested: `11.9.0`
- ROM used for validation:
  - Path: `/Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/Pokemon - Emerald Version (USA, Europe).gba`
  - SHA-256: `a9dec84dfe7f62ab2220bafaef7479da0929d066ece16a6885f6226db19085af`

## Quick start

1. Build custom mGBA (recommended), or install mGBA from https://mgba.io/downloads.html.
2. Start mGBA with ROM + script (custom build path shown):

```bash
/tmp/mgba-build-qt-opt/qt/mGBA.app/Contents/MacOS/mGBA \
  -C pauseOnFocusLost=0 \
  -C pauseOnMinimize=0 \
  --script /Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/lua/mgba_harness.lua \
  "/Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/Pokemon - Emerald Version (USA, Europe).gba"
```

If your build does not support `--script`, launch normally and load the script from:
- `Tools` -> `Scripting...` -> load `/Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/lua/mgba_harness.lua`

3. Run the example script:

```bash
cd /Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness
npm run run:example
```

The example writes outputs under:
- `/Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/examples/outputs/`

## Performance tuning (tested)

Recommended baseline flags:

```bash
/tmp/mgba-build-qt-opt/qt/mGBA.app/Contents/MacOS/mGBA \
  -C hwaccelVideo=1 \
  -C pauseOnFocusLost=0 \
  -C pauseOnMinimize=0 \
  --script /Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/lua/mgba_harness.lua \
  "/Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/Pokemon - Emerald Version (USA, Europe).gba"
```

High-throughput automation mode (audio off, can target 2x):

```bash
/tmp/mgba-build-qt-opt/qt/mGBA.app/Contents/MacOS/mGBA \
  -C hwaccelVideo=1 \
  -C videoSync=1 \
  -C audioSync=0 \
  -C fpsTarget=120 \
  -C mute=1 \
  --script /Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/lua/mgba_harness.lua \
  "/Users/seb/Documents/GitHub/pkmn-rse-browser/gba_harness/Pokemon - Emerald Version (USA, Europe).gba"
```

Known caveats:
- In this environment, disabling both `videoSync` and `audioSync` can make `emu:screenshot()` produce empty files.
- If mGBA is backgrounded or not focused, audio/video can feel choppy even on strong hardware. Keep the mGBA window active for smooth realtime playback.
- Realtime audio quality in scripting mode may differ from normal interactive mGBA playback. For automation runs, prefer `-C mute=1`.

## Script format

Example:

```json
{
  "host": "127.0.0.1",
  "port": 61337,
  "timeoutMs": 15000,
  "steps": [
    { "action": "ping" },
    { "action": "advance", "frames": 180 },
    { "action": "tap", "button": "START", "frames": 1, "afterFrames": 120 },
    { "action": "screenshot", "path": "./outputs/title-screen.png" }
  ]
}
```

Supported actions:
- `ping`
- `frame`
- `waitMs`
- `hold`, `release`, `clearKeys`
- `advance`, `tap`
- `read8`, `read16`, `read32`
- `write8`, `write16`, `write32`
- `screenshot`, `saveState`, `loadState`
- `reset`

Buttons:
- `A`, `B`, `SELECT`, `START`, `RIGHT`, `LEFT`, `UP`, `DOWN`, `R`, `L`

You can provide either:
- `button`: single button string
- `buttons`: array of buttons
- `mask`: raw key bitmask

## Notes

- Paths in action steps are resolved relative to the JSON script file.
- The harness expects one active client at a time.
- `advance` is frame-count based and waits until completion before continuing.

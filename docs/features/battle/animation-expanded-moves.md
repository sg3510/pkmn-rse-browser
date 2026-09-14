---
title: Battle animation expansion — starter moves and Gardevoir
status: implemented
written_on: 2026-09-14
last_verified: 2026-09-14
---

# Battle animation expansion — starter moves and Gardevoir

Implements M3 and part of M5 from [docs/features/battle/animation-implementation-plan.md](./animation-implementation-plan.md). Twelve moves are enabled in live single battles and `#/battle-animations`. The new Gardevoir coverage matches its configured test-party moves in `src/pokemon/testFactory.ts`. All audio hooks remain silent.

## Enabled coverage

Every row is executable from either attacker side, has been visually inspected in the browser, and has passed cleanup and animation-disabled turn fixtures. Visual inspection uses the original C/scripts and artwork as references; an emulator recording has not been compared frame by frame.

| Move | Implemented choreography |
|---|---|
| Tackle | Existing lunge, impact star, target shake |
| Growl | Existing sound-wave groups, target shake, silent cry tasks |
| Pound | Immediate impact star and target shake; no lunge |
| Scratch | Original animated scratch frames and target shake |
| Tail Whip | Two side-aware elliptical body movements |
| Ember | Three fire projectiles followed by the target flare sequence |
| Water Gun | Arcing water projectile, water impact, falling droplets and target shake |
| Absorb | Background tint, target impact, returning orbs, healing stars, palette restoration |
| Psychic | Cycling psychic background, attacker color pulse, target shake/scale, background restoration |
| Calm Mind | Fade other scene elements, hide the other battler, three shrinking rings, visibility restoration |
| Thunderbolt | Narrow/wide falling bolt segments, target palette flashes, blinking orb and surrounding sparks |
| Shadow Ball | Ghost background, projectile moving halfway then pausing and accelerating to the target, shake and background restoration |

The reported missing opponent Tackle impact was identified by the user as **Pound**, which had not been enabled in the first slice. Pound now uses the original shared hit-star asset. Tackle's opponent impact was also checked above the player backsprite.

## Shared implementation

The generated browser program grows from 30 to **275 instructions**, with 18 sprite templates and two background definitions. The complete inventory remains separate from browser playback. The rollout is declared in `scripts/lib/battle-animation-rollout.json`; new moves add imported data and registered shared callbacks rather than move-specific cases in `BattleState.ts`.

`scripts/generate-battle-animations.cjs` now imports shared frame/affine tables across source files, frame flips, alternate affine endings, the original sine table, and background tiles/maps/palettes. It resolves concatenated sprite graphics through `graphics_file_rules.mk`; Thunderbolt's spark sheet comprises two indexed PNGs. Explicit extra frame shapes cover callbacks that change OAM dimensions or tile offsets dynamically.

`src/battle/animation/effects/` groups fixed-point projectiles, movement, palette/visibility effects, electric particles, and scheduled sound hooks. The runtime distinguishes visual waits, sound tasks, and detached but owned children. Thunderbolt declares its child segment template in preflight. Psychic's persistent background cycling task does not hold visual waits open. Completion, cancellation, replacement, failure, and the disabled option release owned scene state.

`AnimationAssets` caches tiled sprite frames and background palette variants before playback. Psychic has eleven precomputed palette variants; its frame loop switches atlas regions without redecoding or uploading textures. Backgrounds use the shared GBA tilemap renderer. Atlas preparation follows GBA 1D OBJ tile order, including concatenated source sheets. Battle disposal prevents late asynchronous uploads into a released renderer.

`BattleAnimationScene` applies battler scale, visibility and palette changes, replaces the temporary background, and uses the existing GBA alpha coefficients for blendable objects. The WebGL sprite shader supports palette-color blending per batch. Healthboxes and the message/menu layer remain separately composed. Reused particle output explicitly clears optional dimensions, preventing narrow Thunderbolt pieces from corrupting the next move's frames.

The preview exposes all enabled moves, a Gardevoir preset with Mudkip as a target that can be hit by all four moves, and a 600-frame slider plus an explicit numeric Go control. Clip mode can inspect effects independently of move immunity; turn mode obeys the engine. Turn preview includes healing/drain HP transitions. Fixtures never access the user's save.

## Verification

Validated on 2026-09-14:

- **84 tests passed**: 51 existing engine tests and 33 compiler/runtime/presentation tests. The turn fixture covers all twelve moves, both attacker sides, and enabled/disabled animations while confirming playback leaves the engine's resolved state unchanged.
- 100 mixed replays check every rendered tile/dimension combination against prepared frame metadata and return all effects, palette overrides, visibility, transforms, background state and blend groups to baseline. Additional cancellation checks cover five longer moves at seven phases.
- Targeted fixtures check Pound's immediate hit on both sides, Thunderbolt's 15 dynamically created pieces and both shapes, Psychic's detached task and scale, Shadow Ball's halfway pause and exact endpoint, background loading/cancellation, frame flips, dummy frame tables, and Mudkip/Gardevoir/Rayquaza anchor cases.
- Browser review includes opponent Pound and Scratch, Ember travel, Water Gun travel/droplets, Absorb orbs/healing stars, Tail Whip movement, Calm Mind rings, Psychic background/scale, Thunderbolt narrow bolts/orb/sparks, and Shadow Ball in both directions. Thunderbolt followed by Shadow Ball was verified after the particle-reuse fix. Fresh-page playback reported about 0.40 ms p95 model update time at a 1280×720 browser viewport and 720×480 enlarged battle canvas; this is not a total-frame or GPU benchmark.
- Production TypeScript/Vite build and targeted ESLint passed. Existing build advisories about JSON import attributes/large chunks and the lint tool's stale browser-baseline data remain.
- Regenerating all three animation data outputs preserves their hashes. `git diff --check` passed.

Run the tests with:

```sh
node --test --experimental-strip-types \
  scripts/__tests__/battle-animation-compiler.test.cjs \
  src/battle/animation/__tests__/AnimationPlayer.test.ts \
  src/battle/presentation/__tests__/BattlePresentationSequence.test.ts \
  src/battle/engine/__tests__/*.test.ts
```

## Remaining boundaries

This batch targets single battles. Partner background priority commands resolve to the active battler in singles; doubles, contest-specific composition, general masks/distortion and full move coverage remain pending. M4 and the remainder of M5–M6 are still open.

Palette and background fades reproduce the source's transitions using the browser compositor, but exact hardware palette-task cadence and 5-bit framebuffer rounding remain unverified. Background replacement currently uses a 34-frame fade sequence. These are visual/timing limitations, not claims of emulator-exact parity. Sound-completion-dependent timing also remains provisional; no audio assets are loaded or real playback introduced.

This small rollout preloads its supported visual assets per battle. Move-based bundles, broader device profiling, GPU memory/draw-call measurements, and emulator capture comparisons should accompany larger batches.

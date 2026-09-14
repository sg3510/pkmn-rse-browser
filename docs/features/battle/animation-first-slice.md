---
title: Battle animation first slice — Tackle and Growl
status: implemented
written_on: 2026-09-14
last_verified: 2026-09-14
---

# Battle animation first slice — Tackle and Growl

Historical snapshot of M0–M2 of [docs/features/battle/animation-implementation-plan.md](./animation-implementation-plan.md). Successful Tackle and Growl actions play imported Emerald choreography through the shared WebGL battle renderer. Audio cues use an injected silent adapter. The subsequent [docs/features/battle/animation-expanded-moves.md](./animation-expanded-moves.md) supersedes the coverage counts and pending move statuses below: twelve moves are now enabled. Real audio remains deferred.

## Entry points and extension workflow

- Live battles: `src/states/BattleState.ts` adapts engine events into `src/battle/presentation/` steps and submits effects through `BattleAnimationScene`.
- Preview: `#/battle-animations`, linked from `#/battle-render`. Select move, attacker side, species, seed, and animation option; replay, pause, step, or scrub a clip. Battle-turn mode uses the production engine and sequence builder with isolated Pokémon, never the save manager.
- Regenerate: `npm run generate:battle-animations`. This generator is also included in the battle-data manifest and `generate:all`.
- Expand: inspect `src/data/battleAnimationInventory.gen.json`, port missing callbacks under `src/battle/animation/effects/`, declare their callback-created children, and enable the move/templates in `scripts/lib/battle-animation-rollout.json`. Regenerate and verify before enabling another move. Move-specific presentation rules should live in presentation modules, not new branches in `BattleState`.

The compiler preserves aliases, fallthrough, helper calls, branches, constants, and source locations. All **395 table entries** are indexed: 356 move entries (including sentinel/extra roots), nine status, 23 general, and seven special. The source has 9,215 instructions and 658 labels. Only **30 instructions**, three templates, and two visual texture tags are shipped for the current rollout. The full inventory and raw source index are not imported by browser playback.

Each registered callback declares child effects. Static script dependencies are known for all roots; children created inside unported C callbacks remain unresolved. Import coverage does not mean executable coverage.

## Current behavior and boundaries

`AnimationPlayer` has no browser dependency. It drives commands, frame/affine tables, sprite callbacks, and task callbacks on `GBA_FRAME_MS`. It preserves source load yields, callback handoff frames, signed argument registers, and sprite/OAM/task ordering. Both moves work with either battler as attacker. The renderer uses species-specific picture coordinates, indexed transparency, original artwork, and the source alpha coefficients.

The first `monbg` implementation supports the single-battler grouping needed by Tackle. It places the target behind the impact object, including the player backsprite when the opponent attacks. General background masks, priority splitting, palette effects, and exact 5-bit framebuffer quantization are not implemented by this slice.

The engine emits one immutable animation event per successful action, before damage or stat-change presentation. Attacker/target identities prevent a queued animation from attaching to a replacement Pokémon. Misses, protection, immunity, and failed Growl stat drops do not start these move effects. Unsupported moves skip preflight and retain the existing presentation fallback. Charge/release and the other script domains are inventoried but not enabled for playback.

Presentation retains historical HP/status and waits at explicit animation, HP, and faint steps. A/B uses `InputMap` and advances only text. Tackle's script replaces the old full-screen move flash; the damage blink and HP transition follow completion. Growl plays before its stat-change message. Existing status changes, item cures, switching, and faint flags update their display state explicitly. Replacing presentation or exiting battle cancels owned animations.

The saved `battleScene` option skips move animation while preserving messages, HP changes, and mechanics. Playback never runs damage calculations, consumes PP, accesses battle RNG, or writes saves. Save format and persistence calls are unchanged; deterministic fixtures verify that playback does not mutate the already-resolved engine result. A separate native-save round-trip comparison was not performed for this slice.

Audio preserves effect/cry IDs, logical frames, pan and cry mode through `AnimationAudio`. `SilentAnimationAudio` loads no files and starts no browser audio runtime. Growl's `SoundTask_*` callbacks still participate in visual task waits. Sound-completion-dependent timing remains provisional until M7. Adapter stop errors cannot prevent cancellation or visual cleanup.

## Starter coverage

| Move | Script dependencies (in addition to shared waits/control flow) | State |
|---|---|---|
| Tackle | Horizontal lunge, basic hit splat, `AnimTask_ShakeMon`, tag 10135 | Executable; both sides visually reviewed |
| Growl | `RoarEffect`, roar noise lines, `AnimTask_ShakeMon2`, double-cry/wait tasks, tag 10053 | Executable with silent cries; visually reviewed |
| Pound | Basic hit splat, `AnimTask_ShakeMon`, tag 10135 | Imported; not enabled |
| Scratch | Scratch sprite, `AnimTask_ShakeMon`, tag 10137 | Imported; callback/frame port pending |
| Tail Whip | `AnimTask_TranslateMonEllipticalRespectSide`, `loopsewithpan` | Imported; behavior port pending |
| Ember | Ember flare/projectile, `EmberFireHit`, tag 10029, sound loop | Imported; behavior port pending |
| Water Gun | Droplet/projectile/water hit splat, shake, tags 10148/10155, `splitbgprio` | Imported; behavior/composition port pending |
| Absorb | Absorption orb, hit splat, healing blue star, palette blend, `AbsorbEffect`/`HealingEffect`, tags 10031/10135/10147, `splitbgprio_foes` | Imported; behavior/composition port pending |

All audio coverage is deferred. Visual review means browser inspection of the implemented effects and source-derived frame traces; no original emulator animation capture was supplied. The preview's supplied GBA image is explicitly a **layout still**, not a frame-by-frame animation reference.

## Efficiency and validation

Artwork is decoded and uploaded before playback through the existing indexed-PNG loader. Atlases and prepared frames are cached per battle renderer; disposal prevents pending loads from uploading into a released context. The runtime reuses a bounded 64-effect pool and render-particle storage. Stack, instruction, lifetime, and loading limits prevent indefinite waits. Cancellation, failures, and normal completion clear particles, poses, blend state, background groups, tasks, and audio handles.

The local baseline is the macOS Codex in-app browser at a 1192×1260 viewport, rendering a 240×160 battle canvas enlarged to 720×480. Short preview runs reported approximately **0.10–0.40 ms p95** for model updates, including a fresh page load. This is a development observation, not a total-frame/GPU benchmark or a broad device performance claim. Draw-call, GPU-memory, and compositor profiling remain necessary before larger effect batches.

Validation on 2026-09-14:

- **75 tests passed**: 51 existing engine tests plus 24 compiler/runtime/presentation tests. Includes helper closure, expressions and deterministic import; frame timing; both directions; opponent impact layering; 30/60/144 Hz playback; suspension/catch-up; cancellation, failures and missing assets; 100 repeated playbacks; rapid confirmation; immutable events; status display updates; replacement identity; animation-disabled and real-engine turn fixtures.
- C-derived Tackle trace: lunge at logical frame 3, impact at frame 11, completion at frame 22. Growl creates wave groups at frames 3 and 20 and completes at frame 51 with silent cry handles.
- Browser review: Tackle impacts on both battlers, Growl waves and transparent edges (including opponent Rayquaza), turn message/animation/HP barriers, animation-disabled flow, completed effects returning to zero, and no console errors.
- Production TypeScript/Vite build passed. Existing warnings remain for inconsistent JSON import attributes and large application chunks. Targeted ESLint and `git diff --check` passed; the lint tool reports an advisory about stale `baseline-browser-mapping` data.
- Regenerating all three animation outputs produced identical hashes.

Run the focused suite with:

```sh
node --test --experimental-strip-types \
  scripts/__tests__/battle-animation-compiler.test.cjs \
  src/battle/animation/__tests__/AnimationPlayer.test.ts \
  src/battle/presentation/__tests__/BattlePresentationSequence.test.ts \
  src/battle/engine/__tests__/*.test.ts
```

M3 was subsequently implemented together with four Gardevoir moves. See [docs/features/battle/animation-expanded-moves.md](./animation-expanded-moves.md) for that batch's behavior and validation.

---
title: Animated 3D Title Rayquaza
status: implemented
last_verified: 2026-09-14
---

# Animated 3D Title Rayquaza

The title uses the included ORAS skinned model. The resting pose follows the user's GBA reference: a face near the center, an inverted U of neck above and to the left, a broad lower U, and an upper-right tail tip pointing inward. Body joints and the comparison guide use the same traced curve definitions in `src/title/rayquazaPoseReference.ts`, with rest-relative rotations and a controlled axial turn to show the markings. The tail roll has the opposite sign from the neck roll because their forward axes point in opposite directions; this prevents the skin from twisting shut at the shared hips/spine junction. Position blending allows the upper arch to be longer than the stock rig's neck without scaling its cross-section down. The reference plane is framed directly against the fixed title camera, rather than fitting model bounds (which previously shrank the coil inward when fins enlarged the bounds). The result is a 3D interpretation of the illustration.

## Timing and appearance

The 35-second cycle consists of:

- 0–3.5 seconds: straight upward pass, back facing the camera.
- 3.5–4.5 seconds: offscreen turnaround.
- 4.5–8 seconds: straight downward pass, back facing the camera.
- 8–9 seconds: offscreen return.
- 9–12 seconds: re-entry and blending into the face-visible spiral.
- 12–32 seconds: hold the reference pose.
- 32–35 seconds: uncoil and depart upward before the next cycle.

Swimming uses a tangent-angle wave traveling from head to tail with a 1.6-second period. Its amplitude grows along the body and fades as the spiral forms. This creates eel-like undulation instead of moving a rigid model through the air. Turns between the vertical passes happen fully offscreen.

Yellow markings pulse over 4.3 seconds. A body-texture color mask isolates the gold markings in the shader, replaces their base yellow with dark green, and adds animated yellow emission. The eye material retains its own color and a small emissive contribution for visibility. There is no bloom postprocessing.

Clouds and logos retain their existing foreground layers. Lighting is fixed instead of following the pointer. A/Start remains mapped through `InputMap` and can advance to the menu during the entrance. The flight clock resets on title entry and the model's geometry, materials, textures, and skeleton resources are disposed on exit. No persistent save state is involved.

## Code and preview

- `src/title/RayquazaFlight.ts`: model loading, curve-fitted skeletal posing, reference-plane framing, markings shader, disposal.
- `src/title/rayquazaMotion.ts`: pure timing and transform sampling.
- `src/states/TitleScreenState.ts`: title phase integration and existing high-resolution Three.js compositing.
- `src/pages/RayquazaFlightDebugPage.tsx`: `#/rayquaza-flight` preview with playback, a timeline scrubber, vertical-pass/glow/dim/departure/offscreen checkpoints, side-by-side comparison, and a reference-opacity overlay.

- `src/title/rayquazaPoseReference.ts`: shared curve coordinates and anatomical roll convention.
- `src/title/RayquazaPoseGuide.tsx`: the same pink spiral centerline on both comparison panels, with face and tail landmarks. The guide is traced from the reference, not from the model.
- `public/debug/rayquaza-title-reference.png`: an unchanged copy of the user-supplied reference for the comparison view.

The original `public/pokeemerald/src/title_screen.c` is the reference for the title and palette pulse. Flight and skeletal posing are authored enhancements. Original assets were not edited.

## Validation

- TypeScript build and production Vite build pass (Vite reports its existing large-bundle warning).
- Targeted ESLint passes.
- `node --experimental-strip-types --test src/title/__tests__/rayquazaMotion.test.ts` passes: vertical direction, back-facing orientation, offscreen gaps, twenty-second hold, transition continuity, head-to-tail wave propagation, cross-section radius through the neck/tail roll blend, and reference-curve continuity.
- Browser checks cover the shared reference guide, the repaired continuous waist/hip thickness and closer reference alignment, full-size skin and eye visibility, both back-facing vertical passes, and return to the spiral. Earlier integration checks also cover square/GBA title composition and mapped confirm opening the main menu.

Related assessment: `docs/architecture/intro/rayquaza-flight-assessment.md`.

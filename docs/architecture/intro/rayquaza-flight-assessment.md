---
title: Title Screen Rayquaza Flight Assessment
status: research
last_verified: 2026-09-14
---

# Title Screen Rayquaza Flight Assessment

## Requested direction

Have 3D Rayquaza fly into view, settle into a coil resembling the supplied 2D reference, pulse its yellow markings, and occasionally fly away and return. The reference has a left-facing head in the upper-left area and a broad body loop extending down and around to the right. Preserve that silhouette behind the title graphics.

## Verified current implementation

- `src/states/TitleScreenState.ts` loads the Wii OBJ/MTL. It fades in over 45 GBA frames, then oscillates its whole-object yaw by ±0.5 radians. There is no body deformation or flight sequence.
- The renderer already uses a transparent Three.js canvas composited behind foreground clouds and title graphics. Its render target follows the state canvas backing resolution.
- Lighting follows the pointer. For a consistent reference-like silhouette, art direction should instead prioritize stable, subdued body lighting and readable markings.
- `public/3dmodels/rayquaza-wii/Rayquaza.mtl` maps several body materials to `RayBody.png`. The inspected texture contains painted yellow markings, with no separate emissive mask configured by the title renderer.
- The original `public/pokeemerald/src/title_screen.c`, especially `Task_TitleScreenPhase3` and `UpdateLegendaryMarkingColor`, keeps the silhouette static and cycles a marking palette color every fourth frame. Flight is an intentional enhancement, not original-game parity.

## Asset feasibility

Direct XML inspection of the included DAE files found:

| Asset | Joint nodes | Skin controllers | Animation elements | Assessment |
|---|---:|---:|---:|---|
| Wii `Rayquaza.dae` | 6 | 4 | 0 | No articulated body/tail chain in its joint list |
| ORAS `pm0384_00_fi.dae` | 33 | 2 | 0 | Includes Tail1–Tail15, spine, neck, head, jaw, and arms |
| XY `Rayquaza_OpenCollada.DAE` | 41 | 1 | 0 | Includes the same major body chain plus fingers |

The existing OBJ can move along a flight path, but cannot articulate into a new coil using skeletal animation. Prefer evaluating the ORAS rig first, with XY as another candidate. Joint and skin presence is verified; deformation quality, texture loading, and the attainable silhouette still require a rendered pose study. No claim of an exact pose match is established yet.

## Proposed implementation

1. Extend `src/pages/Rayquaza3DDebugPage.tsx` to inspect the rigged candidate and tune a fixed camera and resting pose against the reference. Save a reusable pose/configuration before integrating the flight.
2. Extract title-specific model loading, pose, and motion into a dedicated controller. Reuse the existing Three.js compositing and resize path.
3. Author an entrance path with body/tail follow-through, blending into the resting pose. Use elapsed-time-based motion and blend bone quaternions from recorded rest transforms to prevent accumulated drift.
4. Create a deliberate markings mask in the chosen model's UV layout. Pulse emissive intensity for self-lit yellow markings; also attenuate the painted yellow contribution at the low point if the marks should disappear. Emission alone leaves the base yellow visible. Add restrained bloom only if an actual halo is desired.
5. Loop entrance → settle → hold → depart → offscreen → return. Suggested starting timings: 2–3 seconds entrance, about 1 second settling, 15–25 seconds holding, 2 seconds departure, and 1–2 seconds offscreen. These are art-direction proposals, not existing behavior.
6. Preserve mapped A/Start behavior throughout the sequence. Returning to the title must reset the motion; leaving it must dispose model, texture, and renderer resources. This is temporary state and needs no save-file support.

## Visual validation needed

- Compare the resting silhouette with the reference, both without overlays and with the actual logo, banner, and clouds.
- Check the tight neck and tail bends for collapsed geometry and self-intersection.
- Observe several full cycles for snapping, path clipping, and distracting repetition.
- Check supported viewport shapes, zoom/Retina rendering, input during flight, and title re-entry.
- Confirm markings alone pulse and that the body remains legible at minimum glow.

Assessment is based on source, asset structure, and body-texture inspection. No runtime animation or pose prototype was implemented in this assessment.

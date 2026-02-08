---
title: Pokemon Emerald Title Screen - Implementation Documentation
status: reference
last_verified: 2026-02-06
---

# Pokemon Emerald Title Screen - Implementation Documentation

This documentation covers the complete implementation details of the Pokemon Emerald title screen, researched from the pokeemerald decompilation source code.

## Documentation Index

| Document | Description |
|----------|-------------|
| [title-screen-flow.md](./title-screen-flow.md) | State machine, phases, timing, and control flow |
| [graphics-assets.md](./graphics-assets.md) | All graphic assets with dimensions and locations |
| [animations.md](./animations.md) | Animation system details (shine, banners, Rayquaza) |
| [palette-colors.md](./palette-colors.md) | Palette data, color cycling, blend modes |
| [gba-hardware.md](./gba-hardware.md) | GBA-specific hardware details and constraints |
| [responsive-design.md](./responsive-design.md) | Notes for responsive/scalable implementation |
| [modern-implementation.md](./modern-implementation.md) | HD remake options with WebGL, generated effects, OTF fonts |
| [birch-intro-rendering.md](./birch-intro-rendering.md) | Birch intro tile layering, sprite composition, and scaling rules |

## Quick Reference

### Source Files
- **Main Logic:** `public/pokeemerald/src/title_screen.c` (869 lines)
- **Header:** `public/pokeemerald/include/title_screen.h`
- **Graphics:** `public/pokeemerald/graphics/title_screen/`

### Key Timings
| Phase | Duration | Description |
|-------|----------|-------------|
| Init | 6 states | Load graphics, setup hardware |
| Phase 1 | 256 frames (~4.3 sec) | Logo shine animations |
| Phase 2 | 144 frames (~2.4 sec) | Version banner fade + logo slide |
| Phase 3 | Infinite | Interactive - awaiting user input |

### Asset Summary
| Asset | Dimensions | Purpose |
|-------|------------|---------|
| Pokemon Logo | 256×64 | Main logo (BG2, affine) |
| Rayquaza | 128×128 | Silhouette background (BG0) |
| Clouds | 128×56 | Scrolling clouds (BG1) |
| Emerald Version | 128×32 | Version banner sprites |
| Press Start | 128×24 | Press Start/Copyright text |
| Logo Shine | 64×64 | Shine effect sprite |

### Music
- **Track:** `MUS_TITLE` (ID: 413)
- **File:** `sound/songs/midi/mus_title.mid`

## Original GBA Specs
- **Resolution:** 240×160 pixels
- **Frame Rate:** ~59.73 FPS
- **Display Mode:** Mode 1 (mixed affine/text)
- **BG Layers:** 3 (Rayquaza, Clouds, Logo)
- **Max Sprites:** 128 OAM entries

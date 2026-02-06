---
title: Pokemon Sprite Animation Reference
status: reference
last_verified: 2026-01-13
---

# Pokemon Sprite Animation Reference

Documentation for Pokemon sprite assets in `public/pokeemerald/graphics/pokemon/`.

## Contents

- [Sprite Types](./sprite-types.md) - All sprite files and their purposes
- [Animation Guide](./animation-guide.md) - How animations work and implementation details
- [Special Cases](./special-cases.md) - Variant forms, eggs, and edge cases

## Quick Reference

| Sprite | File | Size | Frames | Animated |
|--------|------|------|--------|----------|
| Icon | `icon.png` | 32×64 | 2 | Yes (bounce) |
| Front Static | `front.png` | 64×64 | 1 | No |
| Front Animated | `anim_front.png` | 64×128 | 2 | Yes |
| Back | `back.png` | 64×64 | 1 | No |
| Footprint | `footprint.png` | 16×16 | 1 | No |

## Directory Structure

```
public/pokeemerald/graphics/pokemon/
├── treecko/
│   ├── anim_front.png    # 64×128, 2-frame animation
│   ├── front.png         # 64×64, static
│   ├── back.png          # 64×64, static
│   ├── icon.png          # 32×64, 2-frame bounce
│   ├── footprint.png     # 16×16, static
│   ├── normal.pal        # Color palette
│   └── shiny.pal         # Shiny color palette
├── grovyle/
│   └── ...
└── [385 Pokemon total]
```

## Current Implementation Status

| Feature | Status | Location |
|---------|--------|----------|
| Icon bounce animation | ✅ Implemented | `src/pokemon/icons.ts` |
| Party menu icons | ✅ Implemented | `src/menu/styles/party-menu-content.css` |
| Front sprite display | ✅ Static only | `src/menu/components/PokemonSummaryContent.tsx` |
| Front sprite animation | ❌ Not implemented | - |
| Shiny palette support | ❌ Not implemented | - |

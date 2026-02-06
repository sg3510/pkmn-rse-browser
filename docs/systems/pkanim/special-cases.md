---
title: Pokemon Sprite Special Cases
status: reference
last_verified: 2026-01-13
---

# Pokemon Sprite Special Cases

Documentation of Pokemon with non-standard sprite structures.

## Form Variants

### Castform (Weather Forms)

Castform has 4 forms with separate sprite sets:

```
public/pokeemerald/graphics/pokemon/castform/
├── normal/
│   ├── anim_front.png   # 64×64 (only 1 frame!)
│   ├── front.png        # 64×64
│   └── back.png         # 64×64
├── rainy/
│   ├── anim_front.png   # 64×64
│   ├── front.png        # 64×64
│   └── back.png         # 64×64
├── snowy/
│   └── ...
├── sunny/
│   └── ...
├── icon.png             # Shared icon (normal form)
├── footprint.png        # Shared footprint
├── normal.pal
└── shiny.pal
```

**Important:** Castform's `anim_front.png` is 64×64, NOT 64×128. This is an exception - only 1 frame exists.

### Deoxys (Form Variants)

Deoxys has multiple icon variants:

```
public/pokeemerald/graphics/pokemon/deoxys/
├── anim_front.png       # 64×128 (2 frames)
├── front.png            # 64×64
├── back.png             # 64×128 (2 frames - unusual!)
├── icon.png             # 32×64 (normal form)
├── icon_speed.png       # 32×64 (speed form)
├── icon_speed_wide.png  # 128×64 (4 frames horizontal?)
├── footprint.png
├── normal.pal
└── shiny.pal
```

**Notes:**
- `back.png` is 64×128 (animated, unlike most Pokemon)
- `icon_speed_wide.png` uses horizontal frame layout (128×64)
- Speed form icon may need special handling

### Unown (Letter Variants)

Each Unown letter has its own folder:

```
public/pokeemerald/graphics/pokemon/unown/
├── a/
│   ├── anim_front.png   # 64×128
│   ├── front.png        # 64×64
│   ├── back.png         # 64×64
│   └── icon.png         # 32×64
├── b/
│   └── ...
├── ...
├── z/
│   └── ...
├── exclamation_mark/
│   └── ...
├── question_mark/
│   └── ...
├── footprint.png        # Shared
├── normal.pal
└── shiny.pal
```

**Total:** 28 variants (A-Z + ! + ?)

---

## Egg Sprites

```
public/pokeemerald/graphics/pokemon/egg/
├── anim_front.png   # 64×64 (1 frame)
├── front.png        # 64×64
├── back.png         # 64×64
├── hatch.png        # 32×128 (4 frames - hatching animation)
├── shard.png        # 32×8 (egg shell shard)
├── crack.png        # 32×64 (cracking animation?)
├── icon.png         # 32×64
├── footprint.png    # 16×16
├── normal.pal
└── shiny.pal
```

### Hatch Animation

`hatch.png` contains 4 frames stacked vertically (32×128):

```
┌──────────┐
│  Frame 1 │  Egg intact
├──────────┤
│  Frame 2 │  Small crack
├──────────┤
│  Frame 3 │  Large crack
├──────────┤
│  Frame 4 │  Breaking open
└──────────┘
```

### Hatch Animation CSS (Example)

```css
.egg-hatching {
  width: 32px;
  height: 32px;
  background-image: url('/pokeemerald/graphics/pokemon/egg/hatch.png');
  background-size: 32px 128px;
  animation: egg-hatch 2s steps(4) forwards;
}

@keyframes egg-hatch {
  0% { background-position-y: 0; }
  100% { background-position-y: -96px; }
}
```

---

## Placeholder Sprites

### Question Mark (Unknown Pokemon)

```
public/pokeemerald/graphics/pokemon/question_mark/
├── icon.png         # 32×64
└── footprint.png    # 16×16
```

Used for:
- Unseen Pokemon in Pokedex
- Error fallback
- Mystery/unknown displays

---

## Dimension Exceptions

Most Pokemon follow standard dimensions, but exceptions exist:

| Pokemon | File | Expected | Actual | Notes |
|---------|------|----------|--------|-------|
| Castform (all forms) | anim_front.png | 64×128 | 64×64 | Only 1 frame |
| Deoxys | back.png | 64×64 | 64×128 | Has 2 frames |
| Deoxys | icon_speed_wide.png | 32×64 | 128×64 | Horizontal layout |
| Egg | hatch.png | - | 32×128 | 4 frames |

---

## Handling Form Variants in Code

```typescript
interface PokemonForm {
  species: string;
  form?: string;
}

function getSpritePath(pokemon: PokemonForm, type: string): string {
  const base = `/pokeemerald/graphics/pokemon/${pokemon.species}`;

  // Handle form variants
  if (pokemon.form) {
    // Castform, Deoxys forms
    return `${base}/${pokemon.form}/${type}.png`;
  }

  // Unown letters
  if (pokemon.species === 'unown' && pokemon.form) {
    return `${base}/${pokemon.form}/${type}.png`;
  }

  return `${base}/${type}.png`;
}

// Usage
getSpritePath({ species: 'castform', form: 'rainy' }, 'front');
// => /pokeemerald/graphics/pokemon/castform/rainy/front.png

getSpritePath({ species: 'unown', form: 'a' }, 'icon');
// => /pokeemerald/graphics/pokemon/unown/a/icon.png
```

---

## Complete Form List

### Pokemon with Multiple Forms

| Pokemon | Forms | Notes |
|---------|-------|-------|
| Castform | normal, rainy, snowy, sunny | Weather-based |
| Deoxys | (base), speed | Attack/Defense forms may exist elsewhere |
| Unown | a-z, !, ? | 28 letter variants |

### Form Detection

```typescript
const POKEMON_WITH_FORMS: Record<string, string[]> = {
  castform: ['normal', 'rainy', 'snowy', 'sunny'],
  deoxys: ['normal', 'speed'], // May need expansion
  unown: [
    'a','b','c','d','e','f','g','h','i','j','k','l','m',
    'n','o','p','q','r','s','t','u','v','w','x','y','z',
    'exclamation_mark', 'question_mark'
  ],
};

function hasMultipleForms(species: string): boolean {
  return species in POKEMON_WITH_FORMS;
}

function getFormList(species: string): string[] {
  return POKEMON_WITH_FORMS[species] ?? [];
}
```

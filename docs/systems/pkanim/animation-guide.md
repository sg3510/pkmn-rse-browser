---
title: Pokemon Sprite Animation Guide
status: reference
last_verified: 2026-01-13
---

# Pokemon Sprite Animation Guide

How to implement and use Pokemon sprite animations.

## Animation Approach

All animations use **CSS sprite sheet animation** with `background-position` shifting:

1. Set element size to single frame dimensions
2. Set `background-size` to full sprite sheet size
3. Animate `background-position-y` to show different frames

---

## Icon Animation (Implemented)

The party menu bounce animation is already implemented.

### CSS

```css
.party-slot-icon {
  width: 32px;
  height: 32px;
  background-image: url('/pokeemerald/graphics/pokemon/[species]/icon.png');
  background-size: 32px 64px;
  background-position: 0 0;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  animation: pokemon-icon-bounce 0.6s step-end infinite;
}

@keyframes pokemon-icon-bounce {
  0%, 85% { background-position-y: 0; }      /* Frame 1 */
  85.01%, 100% { background-position-y: -32px; } /* Frame 2 */
}
```

### Timing Breakdown

- 0% - 85%: Show frame 1 (at rest)
- 85% - 100%: Show frame 2 (bounced up)
- Total duration: 0.6 seconds
- `step-end`: Discrete frame transitions (no interpolation)

### Fainted State

```css
.party-slot-icon.fainted {
  filter: grayscale(1) brightness(0.7);
  animation: none;
}
```

---

## Front Sprite Animation (Not Yet Implemented)

### Recommended Implementation

```css
.pokemon-front-sprite {
  width: 64px;
  height: 64px;
  background-image: url('/pokeemerald/graphics/pokemon/[species]/anim_front.png');
  background-size: 64px 128px;
  background-position: 0 0;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}

/* Animate on hover or cry */
.pokemon-front-sprite.animating {
  animation: pokemon-front-anim 0.4s steps(2) forwards;
}

@keyframes pokemon-front-anim {
  0% { background-position-y: 0; }
  50% { background-position-y: -64px; }
  100% { background-position-y: 0; }
}
```

### Animation Triggers

In original games, front sprite animates on:
- Battle entry
- Pokemon cry play
- Pokedex view

### Fallback to Static

If `anim_front.png` fails to load, fall back to `front.png`:

```typescript
const frontSprite = useMemo(() => {
  const base = `/pokeemerald/graphics/pokemon/${species}`;
  return animated ? `${base}/anim_front.png` : `${base}/front.png`;
}, [species, animated]);
```

---

## Animation Timing Reference

### Original GBA Timing

The GBA games use variable timing per Pokemon, but common patterns:

| Animation Type | Duration | Frames | Notes |
|----------------|----------|--------|-------|
| Icon bounce | ~0.5-0.6s | 2 | Continuous loop |
| Front anim | ~0.3-0.5s | 2 | On cry/entry |
| Battle entry | ~0.8-1.2s | 2+ | With slide-in |

### Recommended Web Timing

For smooth 60fps animation:

```css
/* Icon: Subtle continuous bounce */
animation: pokemon-icon-bounce 0.6s step-end infinite;

/* Front: Quick one-shot on interaction */
animation: pokemon-front-anim 0.4s steps(2) forwards;

/* Front: Continuous idle (optional) */
animation: pokemon-front-idle 1.2s steps(2) infinite;
```

---

## React Component Pattern

### Animated Pokemon Sprite Component

```tsx
interface PokemonSpriteProps {
  species: string;
  type: 'icon' | 'front' | 'back';
  animated?: boolean;
  playing?: boolean;
  size?: number;
}

function PokemonSprite({
  species,
  type,
  animated = true,
  playing = true,
  size
}: PokemonSpriteProps) {
  const dimensions = {
    icon: { width: 32, height: 32, sheetHeight: 64 },
    front: { width: 64, height: 64, sheetHeight: animated ? 128 : 64 },
    back: { width: 64, height: 64, sheetHeight: 64 },
  }[type];

  const file = type === 'front' && animated ? 'anim_front.png' : `${type}.png`;
  const src = `/pokeemerald/graphics/pokemon/${species}/${file}`;

  const style: React.CSSProperties = {
    width: size ?? dimensions.width,
    height: size ?? dimensions.height,
    backgroundImage: `url(${src})`,
    backgroundSize: `${dimensions.width}px ${dimensions.sheetHeight}px`,
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };

  const className = [
    'pokemon-sprite',
    `pokemon-sprite--${type}`,
    animated && playing ? 'pokemon-sprite--playing' : '',
  ].filter(Boolean).join(' ');

  return <div className={className} style={style} />;
}
```

---

## Performance Considerations

### CSS Animation Performance

- Use `transform` and `opacity` for best performance
- `background-position` is acceptable for sprite sheets
- Avoid animating `width`, `height`, `margin`

### Image Loading

```typescript
// Preload sprites for smoother animation
function preloadPokemonSprites(species: string) {
  const files = ['icon.png', 'front.png', 'anim_front.png', 'back.png'];
  files.forEach(file => {
    const img = new Image();
    img.src = `/pokeemerald/graphics/pokemon/${species}/${file}`;
  });
}
```

### Reduced Motion

Respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  .pokemon-sprite--playing {
    animation: none;
  }
}
```

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| CSS `steps()` | ✅ | ✅ | ✅ | ✅ |
| `background-position` animation | ✅ | ✅ | ✅ | ✅ |
| `image-rendering: pixelated` | ✅ | ✅ | ✅ | ✅ |

All animation techniques used are widely supported.

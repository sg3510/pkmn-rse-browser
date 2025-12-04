# Responsive Design Notes

## Original GBA Specifications

```
Resolution: 240 × 160 pixels
Aspect Ratio: 3:2 (1.5:1)
Frame Rate: ~59.73 FPS
```

## Scaling Strategies

### Option 1: Integer Scaling (Recommended for Pixel Art)

Maintain pixel-perfect rendering by using integer multiples:

| Scale | Resolution | Best For |
|-------|------------|----------|
| 1× | 240 × 160 | Small embed, thumbnail |
| 2× | 480 × 320 | Mobile portrait |
| 3× | 720 × 480 | Mobile landscape, small tablet |
| 4× | 960 × 640 | Tablet, small desktop |
| 5× | 1200 × 800 | Desktop |
| 6× | 1440 × 960 | Large desktop |

**Implementation:**
```typescript
function calculateScale(containerWidth: number, containerHeight: number): number {
  const scaleX = Math.floor(containerWidth / 240);
  const scaleY = Math.floor(containerHeight / 160);
  return Math.max(1, Math.min(scaleX, scaleY));
}
```

### Option 2: Aspect-Ratio Preserving Scale

Scale to fit container while maintaining 3:2 ratio:

```typescript
function calculateFitScale(containerWidth: number, containerHeight: number): number {
  const scaleX = containerWidth / 240;
  const scaleY = containerHeight / 160;
  return Math.min(scaleX, scaleY);
}
```

### Option 3: Fill with Letterboxing

Fill the container, adding letterbox/pillarbox as needed:

```typescript
function calculateFillDimensions(containerWidth: number, containerHeight: number) {
  const containerRatio = containerWidth / containerHeight;
  const gbaRatio = 240 / 160; // 1.5

  if (containerRatio > gbaRatio) {
    // Container is wider - pillarbox (bars on sides)
    const height = containerHeight;
    const width = height * gbaRatio;
    return { width, height, padX: (containerWidth - width) / 2, padY: 0 };
  } else {
    // Container is taller - letterbox (bars on top/bottom)
    const width = containerWidth;
    const height = width / gbaRatio;
    return { width, height, padX: 0, padY: (containerHeight - height) / 2 };
  }
}
```

## Coordinate Transformation

### GBA to Screen Coordinates

```typescript
interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function gbaToScreen(gbaX: number, gbaY: number, transform: Transform) {
  return {
    x: gbaX * transform.scale + transform.offsetX,
    y: gbaY * transform.scale + transform.offsetY,
  };
}

function screenToGba(screenX: number, screenY: number, transform: Transform) {
  return {
    x: (screenX - transform.offsetX) / transform.scale,
    y: (screenY - transform.offsetY) / transform.scale,
  };
}
```

## Rendering Approach Options

### Canvas 2D

```typescript
// Setup for crisp pixel art
ctx.imageSmoothingEnabled = false;

// Scale all drawing operations
ctx.save();
ctx.translate(offsetX, offsetY);
ctx.scale(scale, scale);

// Draw at GBA coordinates
drawPokemonLogo(0, 48);  // Original position
drawRayquaza(56, 16);

ctx.restore();
```

### WebGL

```glsl
// Vertex shader with scaling
uniform vec2 u_resolution;  // Canvas size
uniform vec2 u_gbaSize;     // 240, 160
uniform float u_scale;
uniform vec2 u_offset;

void main() {
  // Transform from GBA coords to clip space
  vec2 scaledPos = a_position * u_scale + u_offset;
  vec2 clipPos = (scaledPos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipPos * vec2(1, -1), 0, 1);
}
```

### CSS Transform (Simplest)

```css
.gba-screen {
  width: 240px;
  height: 160px;
  transform-origin: top left;
  transform: scale(var(--scale));
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

## Asset Scaling Considerations

### Sprite Positions

All sprite positions need transformation:

| Element | Original Position | Notes |
|---------|-------------------|-------|
| Pokemon Logo | BG2 at (0, 48) offset | Affine layer, slides vertically |
| Rayquaza | BG0 at (0, 0) | Static, full 256×256 tilemap |
| Clouds | BG1, scrolling | Horizontal scroll + wave |
| Version Banner Left | X=98, Y=2→66 | Sprite, animated |
| Version Banner Right | X=162, Y=2→66 | Sprite, animated |
| Press Start | X=128 (center), Y=108 | 5 sprites, blinking |
| Copyright | X=128 (center), Y=148 | 5 sprites |
| Logo Shine | X=0→272, Y=68 | Moving sprite |

### Centering Formula

For elements that should remain centered regardless of scale:

```typescript
function getCenteredX(elementWidth: number, scale: number, containerWidth: number) {
  const scaledGbaWidth = 240 * scale;
  const offsetX = (containerWidth - scaledGbaWidth) / 2;
  return offsetX + (120 - elementWidth / 2) * scale;
}
```

## Animation Timing

### Frame-Rate Independence

GBA runs at ~59.73 FPS. For web, target 60 FPS with proper deltaTime handling:

```typescript
const GBA_FRAME_MS = 1000 / 59.7275;

class Animation {
  private accumulator = 0;

  update(deltaMs: number) {
    this.accumulator += deltaMs;

    while (this.accumulator >= GBA_FRAME_MS) {
      this.tick(); // One GBA frame's worth of animation
      this.accumulator -= GBA_FRAME_MS;
    }
  }
}
```

### Animation Speeds at Different Scales

Animations should run at the same visual speed regardless of resolution:

| Animation | GBA Speed | At Any Scale |
|-----------|-----------|--------------|
| Shine movement | 4 px/frame | 4 × scale px/frame |
| Version slide | 1 px/frame | 1 × scale px/frame |
| Cloud scroll | 0.5 px/frame | 0.5 × scale px/frame |

## Touch/Click Handling

Map touch/click coordinates back to GBA space:

```typescript
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  const gbaCoords = screenToGba(screenX, screenY, transform);

  // Check if within GBA bounds
  if (gbaCoords.x >= 0 && gbaCoords.x < 240 &&
      gbaCoords.y >= 0 && gbaCoords.y < 160) {
    handleGbaClick(gbaCoords.x, gbaCoords.y);
  }
});
```

## Responsive Breakpoints

Suggested scale thresholds:

```typescript
function getResponsiveScale(viewportWidth: number, viewportHeight: number): number {
  // Leave some padding around the game screen
  const maxWidth = viewportWidth * 0.95;
  const maxHeight = viewportHeight * 0.85;

  const scale = calculateScale(maxWidth, maxHeight);

  // Clamp to reasonable range
  return Math.min(Math.max(scale, 1), 8);
}
```

## Mobile Considerations

### Portrait Mode

GBA's landscape aspect ratio doesn't fit portrait well. Options:

1. **Letterbox**: Show at smaller scale with large bars
2. **Rotate prompt**: Ask user to rotate device
3. **Cropped view**: Show zoomed portion (not recommended for title screen)

### Touch Targets

Ensure interactive elements are large enough for touch:

```typescript
const MIN_TOUCH_SIZE = 44; // iOS Human Interface Guidelines

function ensureTouchable(gbaElement: Rect, scale: number): boolean {
  const scaledWidth = gbaElement.width * scale;
  const scaledHeight = gbaElement.height * scale;
  return scaledWidth >= MIN_TOUCH_SIZE && scaledHeight >= MIN_TOUCH_SIZE;
}
```

## Performance Tips

### Canvas Size Limits

Some mobile browsers struggle with very large canvases:

```typescript
const MAX_CANVAS_DIMENSION = 4096;
const MAX_CANVAS_PIXELS = 16777216; // 4096 × 4096

function clampScale(scale: number): number {
  const width = 240 * scale;
  const height = 160 * scale;

  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
    return Math.floor(MAX_CANVAS_DIMENSION / 240);
  }

  if (width * height > MAX_CANVAS_PIXELS) {
    return Math.floor(Math.sqrt(MAX_CANVAS_PIXELS / (240 * 160)));
  }

  return scale;
}
```

### Offscreen Rendering

For complex effects, render at 1× to offscreen canvas, then scale:

```typescript
const offscreen = document.createElement('canvas');
offscreen.width = 240;
offscreen.height = 160;
const offCtx = offscreen.getContext('2d')!;

// Render at native resolution
renderTitleScreen(offCtx);

// Scale up to display
displayCtx.imageSmoothingEnabled = false;
displayCtx.drawImage(
  offscreen,
  0, 0, 240, 160,
  offsetX, offsetY, 240 * scale, 160 * scale
);
```

## Scanline Effect Alternatives

The GBA's per-scanline wave effect is hardware-based. Web alternatives:

### Option 1: CSS Distortion Filter

```css
.wave-effect {
  filter: url(#wave-distortion);
}
```

With SVG filter:
```xml
<filter id="wave-distortion">
  <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="1" />
  <feDisplacementMap in="SourceGraphic" scale="4" />
</filter>
```

### Option 2: Per-Row Canvas Drawing

```typescript
function drawWithWave(ctx: CanvasRenderingContext2D, source: ImageData, amplitude: number) {
  for (let y = 0; y < 160; y++) {
    const offset = Math.sin(y * 0.1 + time) * amplitude;
    ctx.drawImage(
      source,
      0, y, 240, 1,  // Source row
      offset, y * scale, 240 * scale, scale  // Dest row with offset
    );
  }
}
```

### Option 3: WebGL Fragment Shader

```glsl
uniform float u_time;
uniform float u_amplitude;

void main() {
  vec2 uv = v_texCoord;
  uv.x += sin(uv.y * 40.0 + u_time) * u_amplitude / 240.0;
  gl_FragColor = texture2D(u_texture, uv);
}
```

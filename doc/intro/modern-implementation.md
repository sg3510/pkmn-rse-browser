# Modern Large-Screen Title Screen Implementation

This document explores options for recreating the Pokemon Emerald title screen with modern web technologies, optimized for large screens while maintaining the nostalgic feel.

## Available Resources

### Original Assets (from pokeemerald)
| Asset | Size | Notes |
|-------|------|-------|
| `pokemon_logo.png` | 256×64 | Yellow/blue gradient, includes TM mark |
| `rayquaza.png` | 128×128 | Green dragon silhouette on orange |
| `clouds.png` | 128×56 | Seamless tileable clouds |
| `logo_shine.png` | 64×64 | Diagonal white streak |
| `emerald_version.png` | 128×32 | Pink/green gradient banner |
| `press_start.png` | 128×24 | Pre-rendered text segments |

### Available Fonts
| Font | Path | Best For |
|------|------|----------|
| `pokemon-emerald.otf` | `public/fonts/` | "PRESS START" text |
| `pokemon-emerald-pro.otf` | `public/fonts/` | Higher quality variant |
| `pokemon-rs.otf` | `public/fonts/` | Ruby/Sapphire style |
| `latin_normal.png` | `pokeemerald/graphics/fonts/` | Bitmap font atlas |

---

## Option A: Faithful Recreation with Vector Upscaling

**Philosophy:** Pixel-perfect at any resolution using upscaled/vectorized assets.

### Approach
1. **SVG Trace Assets**: Convert PNG assets to SVG using potrace/vectorization
2. **Keep GBA Timing**: Maintain exact frame timings from original
3. **Integer Scaling**: Render at 1× internally, display at Nx scale

### Implementation
```typescript
// Render to offscreen canvas at native resolution
const offscreen = new OffscreenCanvas(240, 160);
renderTitleScreen(offscreen.getContext('2d'), frameState);

// Scale up with nearest-neighbor
mainCtx.imageSmoothingEnabled = false;
mainCtx.drawImage(offscreen, 0, 0, 240 * scale, 160 * scale);
```

### Shine Effect
Use the original `logo_shine.png` sprite, animate exactly as GBA does.

### Text Rendering
Use original `press_start.png` bitmap - scales cleanly with nearest-neighbor.

### Pros
- 100% accurate to original
- Simple implementation
- No asset recreation needed

### Cons
- Pixelated at extreme scales (intentional but some may dislike)
- Limited to original asset quality

---

## Option B: HD Remake with Generated Effects

**Philosophy:** Use original layout/timing but generate effects procedurally for crisp rendering at any resolution.

### Background Layers

#### Rayquaza Silhouette
Keep original asset but apply edge-enhancement shader:

```glsl
// Edge-aware upscaling shader
uniform sampler2D u_texture;
uniform vec2 u_texelSize;

void main() {
    vec4 center = texture2D(u_texture, v_uv);

    // Sample neighbors for edge detection
    vec4 left = texture2D(u_texture, v_uv - vec2(u_texelSize.x, 0.0));
    vec4 right = texture2D(u_texture, v_uv + vec2(u_texelSize.x, 0.0));

    // Sharpen edges
    float edge = length(center.rgb - left.rgb) + length(center.rgb - right.rgb);

    gl_FragColor = center + edge * 0.3;
}
```

#### Clouds - Parallax Depth
Add subtle parallax layers for depth:

```typescript
// Multiple cloud layers at different speeds
const cloudLayers = [
    { texture: clouds, speed: 0.5, opacity: 0.3, scale: 1.2 },  // Back
    { texture: clouds, speed: 1.0, opacity: 0.6, scale: 1.0 },  // Mid
    { texture: clouds, speed: 1.5, opacity: 1.0, scale: 0.8 },  // Front
];
```

### Generated Shine Effect

Instead of a sprite, generate the shine procedurally in WebGL:

```glsl
// Fragment shader for procedural shine
uniform float u_shineX;      // Current X position (0-272)
uniform float u_shineWidth;  // Width of shine band (64)
uniform vec2 u_resolution;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // Diagonal shine band
    float diagonal = uv.x * 240.0 + uv.y * 40.0;  // Angled
    float shinePos = u_shineX;

    // Soft falloff
    float dist = abs(diagonal - shinePos);
    float shine = smoothstep(u_shineWidth, 0.0, dist);

    // Gradient across the band
    float gradient = 1.0 - (dist / u_shineWidth);

    // Apply lighten blend
    vec3 shineColor = vec3(1.0) * shine * gradient * 0.8;

    gl_FragColor = vec4(shineColor, shine * 0.6);
}
```

**Double Shine Enhancement:**
```glsl
// Two overlapping shine bands
float shine1 = calculateShine(u_shineX);
float shine2 = calculateShine(u_shineX - 80.0);  // Trailing
float combined = max(shine1, shine2 * 0.7);      // Second slightly dimmer
```

### Dynamic Text with OTF Font

Use `pokemon-emerald.otf` for crisp text at any size:

```typescript
// Load font
const pokemonFont = new FontFace('PokemonEmerald', 'url(/fonts/pokemon-emerald.otf)');
await pokemonFont.load();
document.fonts.add(pokemonFont);

// Render "PRESS START" with proper styling
function renderPressStart(ctx: CanvasRenderingContext2D, visible: boolean) {
    if (!visible) return;

    ctx.font = `${16 * scale}px PokemonEmerald`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText('PRESS START', centerX + 1, 108 * scale + 1);

    // Main text
    ctx.fillStyle = '#f8f8f8';
    ctx.fillText('PRESS START', centerX, 108 * scale);
}
```

### Rayquaza Marking Pulse - Enhanced

Add subtle glow effect around the pulsing marking:

```glsl
uniform float u_pulseIntensity;  // 0.0 - 1.0, from cosine wave

void main() {
    vec4 texColor = texture2D(u_rayquaza, v_uv);

    // Detect marking color (palette index 15)
    if (isMarkingPixel(texColor)) {
        // Calculate pulse color
        float r = 1.0 - ((u_pulseIntensity * 31.0) / 31.0);
        float g = 1.0 - (u_pulseIntensity * 22.0 / 256.0 / 31.0);
        float b = 12.0 / 31.0;

        vec3 pulseColor = vec3(r, g, b);

        // Add bloom/glow
        float glow = u_pulseIntensity * 0.3;

        gl_FragColor = vec4(pulseColor + glow, 1.0);
    } else {
        gl_FragColor = texColor;
    }
}
```

### Pros
- Crisp at any resolution
- Modern visual enhancements
- Maintains nostalgic timing/feel

### Cons
- More complex implementation
- May drift slightly from original look

---

## Option C: Hybrid Approach (Recommended)

**Philosophy:** Use original assets where they look good scaled, generate effects where it matters most.

### Layer Strategy

| Layer | Approach | Reason |
|-------|----------|--------|
| Rayquaza (BG0) | Original + shader enhance | Silhouette scales well |
| Clouds (BG1) | Original, tiled | Clouds are forgiving |
| Pokemon Logo (BG2) | Original or HD remake | Most visible asset |
| Emerald Version | Original | Gradient looks good scaled |
| Press Start | **OTF font** | Text benefits most from vector |
| Logo Shine | **Generated** | Procedural looks better |
| Rayquaza Pulse | **Shader** | Smooth color cycling |

### Pokemon Logo Options

#### Option C1: Keep Original
The logo has enough detail that it scales reasonably:
```css
.pokemon-logo {
    image-rendering: pixelated;
    /* Crisp pixel scaling */
}
```

#### Option C2: HD Logo Asset
Create or source an HD version of the Pokemon logo (many fan-made ones exist at 1024×256 or higher).

#### Option C3: Hybrid Shine
Keep the pixelated logo but apply a smooth procedural shine over it:

```typescript
// Render pixelated logo to texture
renderLogoToTexture(logoTexture);

// Apply procedural shine as separate pass
shineShader.use();
shineShader.setUniform('u_shineX', shineX);
shineShader.setUniform('u_logoTexture', logoTexture);
renderQuad();
```

### Cloud Wave Effect - Modern Implementation

The GBA uses per-scanline DMA. Modern equivalent using fragment shader:

```glsl
uniform float u_time;
uniform float u_scrollX;
uniform sampler2D u_clouds;

void main() {
    vec2 uv = v_uv;

    // Horizontal scroll
    uv.x += u_scrollX / 256.0;

    // Per-row wave distortion (simulates scanline effect)
    float row = floor(gl_FragCoord.y);
    float wave = sin(row * 0.1 + u_time * 2.0) * 4.0 / 240.0;
    uv.x += wave;

    // Wrap UV
    uv.x = fract(uv.x);

    gl_FragColor = texture2D(u_clouds, uv);
}
```

### Press Start with OTF Font + Blink

```typescript
class PressStartRenderer {
    private blinkTimer = 0;
    private visible = true;

    update(deltaFrames: number) {
        this.blinkTimer += deltaFrames;
        if (this.blinkTimer >= 16) {
            this.blinkTimer -= 16;
            this.visible = !this.visible;
        }
    }

    render(ctx: CanvasRenderingContext2D, scale: number) {
        if (!this.visible) return;

        const fontSize = Math.round(12 * scale);
        ctx.font = `${fontSize}px PokemonEmerald`;
        ctx.textAlign = 'center';

        // Match original positioning
        const x = 120 * scale;
        const y = 108 * scale;

        // Subtle shadow for depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText('PRESS START', x + scale, y + scale);

        // White text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('PRESS START', x, y);
    }
}
```

### Copyright with Dynamic Year

```typescript
function renderCopyright(ctx: CanvasRenderingContext2D, scale: number) {
    const year = new Date().getFullYear();
    const text = `©2002-${year} Pokémon`;

    ctx.font = `${8 * scale}px PokemonEmerald`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, 120 * scale, 148 * scale);
}
```

---

## Option D: Full Modern Reimagining

**Philosophy:** Keep the spirit but fully modernize for HD/4K displays.

### Particle-Based Clouds

Replace static clouds with particle system:

```typescript
class CloudParticleSystem {
    particles: CloudParticle[] = [];

    spawn() {
        this.particles.push({
            x: 240 + Math.random() * 50,
            y: Math.random() * 80 + 40,
            size: 20 + Math.random() * 40,
            speed: 0.3 + Math.random() * 0.2,
            opacity: 0.3 + Math.random() * 0.4,
        });
    }

    update() {
        for (const p of this.particles) {
            p.x -= p.speed;
            if (p.x < -p.size) {
                // Respawn on right
                p.x = 240 + p.size;
            }
        }
    }

    render(ctx: CanvasRenderingContext2D) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.opacity;
            ctx.drawImage(cloudSprite, p.x, p.y, p.size, p.size);
        }
    }
}
```

### Rayquaza with Subtle Animation

Add breathing/floating motion:

```typescript
class RayquazaRenderer {
    private breathPhase = 0;

    update(deltaTime: number) {
        this.breathPhase += deltaTime * 0.5;
    }

    render(ctx: CanvasRenderingContext2D) {
        const breathOffset = Math.sin(this.breathPhase) * 2;
        const scaleBreath = 1 + Math.sin(this.breathPhase * 0.5) * 0.005;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scaleBreath, scaleBreath);
        ctx.translate(-centerX, -centerY + breathOffset);
        ctx.drawImage(rayquazaImage, 0, 0);
        ctx.restore();
    }
}
```

### Lens Flare Shine

```glsl
// Anamorphic lens flare shader
uniform float u_flareX;
uniform float u_intensity;

void main() {
    vec2 uv = v_uv;
    vec2 flareCenter = vec2(u_flareX / 240.0, 0.4);

    // Main flare
    float dist = distance(uv, flareCenter);
    float flare = exp(-dist * 5.0) * u_intensity;

    // Horizontal streak (anamorphic)
    float streak = exp(-abs(uv.y - flareCenter.y) * 20.0)
                 * exp(-abs(uv.x - flareCenter.x) * 2.0)
                 * u_intensity * 0.5;

    // Rainbow chromatic aberration
    vec3 flareColor = vec3(
        flare * 1.0,
        flare * 0.9,
        flare * 0.7
    ) + streak;

    gl_FragColor = vec4(flareColor, max(flare, streak));
}
```

### Full WebGL Pipeline

```typescript
class ModernTitleScreen {
    private gl: WebGL2RenderingContext;
    private shaders: Map<string, WebGLProgram>;
    private framebuffers: Map<string, WebGLFramebuffer>;

    render(time: number) {
        // Pass 1: Render Rayquaza with pulse effect
        this.bindFramebuffer('rayquaza');
        this.shaders.get('rayquazaPulse')!.use();
        this.drawRayquaza(time);

        // Pass 2: Render clouds with wave distortion
        this.bindFramebuffer('clouds');
        this.shaders.get('cloudWave')!.use();
        this.drawClouds(time);

        // Pass 3: Render logo
        this.bindFramebuffer('logo');
        this.drawLogo();

        // Pass 4: Composite with bloom
        this.bindFramebuffer('composite');
        this.shaders.get('composite')!.use();
        this.compositeAllLayers();

        // Pass 5: Apply shine effect
        this.bindFramebuffer('final');
        this.shaders.get('shine')!.use();
        this.applyShine(time);

        // Pass 6: Render to screen with color grading
        this.bindScreen();
        this.shaders.get('colorGrade')!.use();
        this.drawFinalQuad();
    }
}
```

---

## Comparison Matrix

| Feature | Option A | Option B | Option C | Option D |
|---------|----------|----------|----------|----------|
| Accuracy to Original | ★★★★★ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ |
| Visual Quality at 4K | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | ★★★★★ |
| Implementation Effort | ★☆☆☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |
| Performance | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| Nostalgia Factor | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★☆☆ |

---

## Recommended Implementation: Option C

For a balance of authenticity and quality:

1. **Use original assets** for Rayquaza, clouds, and Emerald Version banner
2. **Generate shine procedurally** for smooth diagonal light effect
3. **Use `pokemon-emerald.otf`** for "PRESS START" and copyright text
4. **Implement cloud wave** as fragment shader for smooth distortion
5. **Rayquaza pulse** as color uniform in shader (no texture swapping)
6. **Integer scale** when possible, smooth scale with nearest-neighbor filter

### Minimal Shader Set Needed

1. **`background.frag`** - Composites BG layers with proper blending
2. **`cloudWave.frag`** - Horizontal scroll + sine wave distortion
3. **`shine.frag`** - Procedural diagonal light band
4. **`pulse.frag`** - Color cycling for Rayquaza marking

### Font Loading

```css
@font-face {
    font-family: 'PokemonEmerald';
    src: url('/fonts/pokemon-emerald.otf') format('opentype');
    font-display: block;
}
```

### Timing Synchronization

Keep all timings in "GBA frames" for accuracy:

```typescript
const GBA_FPS = 59.7275;
const GBA_FRAME_MS = 1000 / GBA_FPS;

class TitleScreenController {
    private gbaFrame = 0;
    private accumulator = 0;

    update(deltaMs: number) {
        this.accumulator += deltaMs;

        while (this.accumulator >= GBA_FRAME_MS) {
            this.tickGbaFrame();
            this.accumulator -= GBA_FRAME_MS;
            this.gbaFrame++;
        }
    }

    private tickGbaFrame() {
        // All animations use this.gbaFrame for timing
        // Matches original exactly
    }
}
```

This approach gives you crisp text, smooth effects, and authentic timing while preserving the nostalgic pixel art aesthetic where it matters most.

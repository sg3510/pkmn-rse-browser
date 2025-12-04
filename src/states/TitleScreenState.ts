/**
 * Title Screen State
 *
 * Full implementation of the Pokemon Emerald title screen.
 * Uses Three.js for 3D Rayquaza model rendering.
 * Integer scaling (1x, 2x, 3x) for pixel-perfect rendering.
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import {
  GameState,
  type StateRenderer,
  type StateTransition,
  type InputState,
  type RenderContext,
} from '../core/GameState';
import type { ViewportConfig } from '../config/viewport';

// GBA timing constants
const GBA_FPS = 59.7275;
const GBA_FRAME_MS = 1000 / GBA_FPS;

// GBA native resolution
const GBA_WIDTH = 240;
const GBA_HEIGHT = 160;

// Tile size
const TILE_SIZE = 8;

// Animation timing
const SHINE_SPEED = 4;
const SHINE_DOUBLE_SPEED = 8;

// Position constants (for GBA-scale shine animation)
const SHINE_END_X = GBA_WIDTH + 32;

// Gradient colors (from palette analysis)
const GRADIENT_TOP = { r: 0, g: 57, b: 165 };
const GRADIENT_BOTTOM = { r: 8, g: 156, b: 106 };

// Shine modes (from C code)
const ShineMode = {
  INACTIVE: -1,
  SINGLE_NO_BG: 0,
  DOUBLE: 1,
  SINGLE: 2,
} as const;
type ShineMode = typeof ShineMode[keyof typeof ShineMode];

// Title screen phases (matching GBA sequence)
const TitlePhase = {
  LOADING: 0,
  PHASE1_SHINE_ON_BLACK: 1,    // Black bg, logo centered, shine animations
  PHASE2_LOGO_RISE: 2,          // Logo rises, version slides down
  PHASE3_BACKGROUND_FADE: 3,    // Gradient + clouds fade in
  PHASE4_RAYQUAZA_FADE: 4,      // Rayquaza fades in
  PHASE5_INTERACTIVE: 5,        // Full screen, press start blinks
} as const;
type TitlePhase = typeof TitlePhase[keyof typeof TitlePhase];

// Animation timing (in GBA frames)
const PHASE1_FRAMES = 256;      // Shine animations on black
const PHASE2_FRAMES = 144;      // Logo rise + version slide
const PHASE3_FRAMES = 45;       // Background fade in (~0.75 sec)
const PHASE4_FRAMES = 45;       // Rayquaza fade in (~0.75 sec)

interface TilemapEntry {
  tileIndex: number;
  hFlip: boolean;
  vFlip: boolean;
  palette: number;
}

interface ContentBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface LoadedAssets {
  // Raw images
  pokemonLogo: HTMLImageElement;
  cloudsTileset: HTMLImageElement;
  emeraldVersion: HTMLImageElement;
  logoShine: HTMLImageElement;
  // Tilemaps
  cloudsTilemap: TilemapEntry[];
  // Pre-rendered backgrounds
  cloudsBg: HTMLCanvasElement;
  // Processed sprites
  emeraldVersionCanvas: HTMLCanvasElement;
  logoShineCanvas: HTMLCanvasElement;
  pokemonLogoCanvas: HTMLCanvasElement;
  // Content bounds (excluding transparent/black areas)
  logoContentBounds: ContentBounds;
  versionContentBounds: ContentBounds;
}

export class TitleScreenState implements StateRenderer {
  readonly id = GameState.TITLE_SCREEN;

  private assets: LoadedAssets | null = null;
  private assetsLoaded = false;

  // Three.js for Rayquaza
  private threeRenderer: THREE.WebGLRenderer | null = null;
  private threeScene: THREE.Scene | null = null;
  private threeCamera: THREE.PerspectiveCamera | null = null;
  private rayquazaWrapper: THREE.Group | null = null;  // Wrapper for transforms
  private rayquazaModel: THREE.Object3D | null = null;  // Actual model inside wrapper
  private rayquazaCanvas: HTMLCanvasElement | null = null;
  private mainLight: THREE.DirectionalLight | null = null;
  private rayquazaRenderWidth = 0;
  private rayquazaRenderHeight = 0;

  // Phase tracking
  private phase: TitlePhase = TitlePhase.LOADING;
  private phaseFrameCount = 0;
  private gbaFrameAccumulator = 0;
  private totalFrames = 0;

  // Shine animation
  private shineMode: ShineMode = ShineMode.INACTIVE;
  private shineX = 0;
  private shineTrailX = -80;
  private shineBgIntensity = 0;

  // Logo position animation - progress from centered (1.0) to final position (0.0)
  private logoRiseProgress = 1;  // 1 = centered, 0 = final position at top

  // Version banner animation
  private versionAlpha = 0;
  private versionYOffset = 0;  // Slides from above to final position

  // Background fade (gradient + clouds)
  private backgroundAlpha = 0;

  // Rayquaza fade
  private rayquazaAlpha = 0;

  // Cloud scrolling (GBA scrolls vertically, not horizontally)
  private cloudScrollY = 0;
  // Wave effect phase (for horizontal scanline distortion)
  private cloudWavePhase = 0;

  // Press Start blink
  private pressStartVisible = true;

  // Viewport scaling (integer only)
  private scale = 1;
  private viewportWidth = 320;
  private viewportHeight = 320;

  // Mouse tracking for interactive light
  private mouseX = 0.5;  // Normalized 0-1 (0.5 = center)
  private mouseY = 0.5;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

  async enter(viewport: ViewportConfig): Promise<void> {
    console.log('[TitleScreenState] Entering...');

    this.viewportWidth = viewport.tilesWide * 16;
    this.viewportHeight = viewport.tilesHigh * 16;

    // Calculate INTEGER scale only (1x, 2x, 3x, etc.)
    const scaleX = Math.floor(this.viewportWidth / GBA_WIDTH);
    const scaleY = Math.floor(this.viewportHeight / GBA_HEIGHT);
    this.scale = Math.max(1, Math.min(scaleX, scaleY));

    // Reset state
    this.phase = TitlePhase.LOADING;
    this.phaseFrameCount = PHASE1_FRAMES;
    this.gbaFrameAccumulator = 0;
    this.totalFrames = 0;
    this.shineMode = ShineMode.INACTIVE;
    this.shineX = 0;
    this.shineTrailX = -80;
    this.shineBgIntensity = 0;
    this.logoRiseProgress = 1;  // Start centered (1 = center, 0 = final top position)
    this.versionAlpha = 0;
    this.versionYOffset = -64 * this.scale;  // Start above final position
    this.backgroundAlpha = 0;
    this.rayquazaAlpha = 0;
    this.cloudScrollY = 0;
    this.cloudWavePhase = 0;
    this.pressStartVisible = true;

    // Initialize Three.js for Rayquaza
    this.initThreeJS();

    // Load assets in parallel
    await Promise.all([
      this.loadAssets(),
      this.loadRayquaza3D(),
    ]);

    // Start Phase 1: Shine on black background
    this.phase = TitlePhase.PHASE1_SHINE_ON_BLACK;
    this.startShine(ShineMode.SINGLE_NO_BG);

    // Set up mouse tracking for interactive light
    this.mouseMoveHandler = (e: MouseEvent) => {
      this.mouseX = e.clientX / window.innerWidth;
      this.mouseY = e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', this.mouseMoveHandler);

    console.log('[TitleScreenState] Ready, scale:', this.scale);
  }

  private initThreeJS(): void {
    // Create offscreen canvas for Three.js rendering at NATIVE resolution (crisp 3D)
    // This makes the 3D model look sharp while rest of UI stays pixelated
    // Account for BOTH device pixel ratio AND game zoom scale for true sub-pixel crispness
    const deviceRatio = window.devicePixelRatio || 1;
    const renderScale = Math.max(deviceRatio, this.scale);  // Use whichever is higher
    this.rayquazaCanvas = document.createElement('canvas');
    this.rayquazaCanvas.width = this.viewportWidth * renderScale;
    this.rayquazaCanvas.height = this.viewportHeight * renderScale;

    // Create renderer at native resolution for crisp 3D
    this.threeRenderer = new THREE.WebGLRenderer({
      canvas: this.rayquazaCanvas,
      alpha: true,
      antialias: true, // Enable antialiasing for smooth 3D
    });
    this.threeRenderer.setSize(this.viewportWidth * renderScale, this.viewportHeight * renderScale);
    this.threeRenderer.setPixelRatio(1); // We handle pixel ratio manually
    this.threeRenderer.setClearColor(0x000000, 0); // Transparent background
    this.rayquazaRenderWidth = this.rayquazaCanvas.width;
    this.rayquazaRenderHeight = this.rayquazaCanvas.height;

    // Create scene
    this.threeScene = new THREE.Scene();

    // Create camera with config from debug page (OBJ model)
    // Aspect ratio is the same regardless of pixel ratio
    this.threeCamera = new THREE.PerspectiveCamera(35, this.viewportWidth / this.viewportHeight, 0.1, 1000);
    this.threeCamera.position.set(-0.0573375473447843, 1.0725984662026167, 4.521194911609615);
    this.threeCamera.lookAt(-0.0573375473447843, 1.0725984662026167, 0.002196338516005314);

    // Create wrapper group for model transforms
    this.rayquazaWrapper = new THREE.Group();
    this.threeScene.add(this.rayquazaWrapper);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    this.threeScene.add(ambientLight);

    // Main directional light
    this.mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.mainLight.position.set(-0.1, 0, 1.3);
    this.threeScene.add(this.mainLight);

    // Subtle fill light from below (green tint like the gradient)
    const fillLight = new THREE.DirectionalLight(0x089c6a, 0.5);
    fillLight.position.set(0, -5, 5);
    this.threeScene.add(fillLight);

    // Blue rim light from above
    const rimLight = new THREE.DirectionalLight(0x0039a5, 0.8);
    rimLight.position.set(0, 10, -5);
    this.threeScene.add(rimLight);
  }

  private async loadRayquaza3D(): Promise<void> {
    return new Promise((resolve) => {
      const mtlLoader = new MTLLoader();
      const modelPath = '/3dmodels/rayquaza-wii/';

      // First load the MTL file for materials
      mtlLoader.setPath(modelPath);
      mtlLoader.load(
        'Rayquaza.mtl',
        (materials) => {
          materials.preload();

          // Now load the OBJ file with materials
          const objLoader = new OBJLoader();
          objLoader.setMaterials(materials);
          objLoader.setPath(modelPath);

          objLoader.load(
            'Rayquaza.obj',
            (object) => {
              this.rayquazaModel = object;

              // Center the model (offset from debug page - OBJ config)
              this.rayquazaModel.position.set(0.0599, -0.9696, -0.0077);

              // Add model to wrapper
              if (this.rayquazaWrapper) {
                this.rayquazaWrapper.add(this.rayquazaModel);

                // Apply transforms to wrapper (from debug page config - OBJ)
                this.rayquazaWrapper.scale.set(0.1, 0.1, 0.1);
                this.rayquazaWrapper.position.set(0, 0, 0);
                this.rayquazaWrapper.rotation.set(0, 1.1, 0);
              }

              console.log('[TitleScreenState] 3D Rayquaza (OBJ Wii) loaded');
              resolve();
            },
            (progress) => {
              if (progress.total > 0) {
                console.log('[TitleScreenState] Loading Rayquaza OBJ:', Math.round((progress.loaded / progress.total) * 100) + '%');
              }
            },
            (error) => {
              console.error('[TitleScreenState] Failed to load Rayquaza OBJ:', error);
              resolve(); // Continue without 3D model
            }
          );
        },
        (progress) => {
          if (progress.total > 0) {
            console.log('[TitleScreenState] Loading Rayquaza MTL:', Math.round((progress.loaded / progress.total) * 100) + '%');
          }
        },
        (error) => {
          console.error('[TitleScreenState] Failed to load Rayquaza MTL:', error);
          resolve(); // Continue without 3D model
        }
      );
    });
  }

  private async loadAssets(): Promise<void> {
    const basePath = '/pokeemerald/graphics/title_screen/';

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${src}`));
        img.src = src;
      });
    };

    const loadBinary = async (src: string): Promise<ArrayBuffer> => {
      const response = await fetch(src);
      return response.arrayBuffer();
    };

    try {
      // Load images and tilemaps in parallel
      const [
        pokemonLogo,
        cloudsTileset,
        emeraldVersion,
        logoShine,
        cloudsBin,
      ] = await Promise.all([
        loadImage(basePath + 'pokemon_logo.png'),
        loadImage(basePath + 'clouds.png'),
        loadImage(basePath + 'emerald_version.png'),
        loadImage(basePath + 'logo_shine.png'),
        loadBinary(basePath + 'clouds.bin'),
      ]);

      // Parse tilemaps
      const cloudsTilemap = this.parseTilemap(cloudsBin);

      // Render backgrounds from tilesets + tilemaps
      const cloudsBg = this.renderTiledBackground(cloudsTileset, cloudsTilemap, 32, 32);

      // Process sprites for transparency
      const emeraldVersionCanvas = this.processEmeraldVersion(emeraldVersion);
      const logoShineCanvas = this.processLogoShine(logoShine); // Green background -> transparent
      const pokemonLogoCanvas = this.makeColorTransparent(pokemonLogo, 0, 0, 0);

      // Detect actual content bounds (excluding transparent areas)
      const logoContentBounds = this.detectContentBounds(pokemonLogoCanvas);
      const versionContentBounds = this.detectContentBounds(emeraldVersionCanvas);

      this.assets = {
        pokemonLogo,
        cloudsTileset,
        emeraldVersion,
        logoShine,
        cloudsTilemap,
        cloudsBg,
        emeraldVersionCanvas,
        logoShineCanvas,
        pokemonLogoCanvas,
        logoContentBounds,
        versionContentBounds,
      };
      this.assetsLoaded = true;
      console.log('[TitleScreenState] 2D assets loaded');
    } catch (err) {
      console.error('[TitleScreenState] Failed to load assets:', err);
    }
  }

  private parseTilemap(buffer: ArrayBuffer): TilemapEntry[] {
    const data = new Uint16Array(buffer);
    const entries: TilemapEntry[] = [];

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      entries.push({
        tileIndex: value & 0x3FF,
        hFlip: (value & 0x400) !== 0,
        vFlip: (value & 0x800) !== 0,
        palette: (value >> 12) & 0xF,
      });
    }

    return entries;
  }

  private renderTiledBackground(
    tileset: HTMLImageElement,
    tilemap: TilemapEntry[],
    tilesWide: number,
    tilesHigh: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tilesWide * TILE_SIZE;
    canvas.height = tilesHigh * TILE_SIZE;
    const ctx = canvas.getContext('2d')!;

    const tilesetTilesWide = Math.floor(tileset.width / TILE_SIZE);

    for (let y = 0; y < tilesHigh; y++) {
      for (let x = 0; x < tilesWide; x++) {
        const mapIndex = y * tilesWide + x;
        if (mapIndex >= tilemap.length) continue;

        const entry = tilemap[mapIndex];
        const tileIndex = entry.tileIndex;

        const srcX = (tileIndex % tilesetTilesWide) * TILE_SIZE;
        const srcY = Math.floor(tileIndex / tilesetTilesWide) * TILE_SIZE;

        const destX = x * TILE_SIZE;
        const destY = y * TILE_SIZE;

        ctx.save();
        if (entry.hFlip || entry.vFlip) {
          ctx.translate(
            destX + (entry.hFlip ? TILE_SIZE : 0),
            destY + (entry.vFlip ? TILE_SIZE : 0)
          );
          ctx.scale(entry.hFlip ? -1 : 1, entry.vFlip ? -1 : 1);
          ctx.drawImage(
            tileset,
            srcX, srcY, TILE_SIZE, TILE_SIZE,
            0, 0, TILE_SIZE, TILE_SIZE
          );
        } else {
          ctx.drawImage(
            tileset,
            srcX, srcY, TILE_SIZE, TILE_SIZE,
            destX, destY, TILE_SIZE, TILE_SIZE
          );
        }
        ctx.restore();
      }
    }

    return this.makeFirstColorTransparent(canvas);
  }

  private makeFirstColorTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const r0 = data[0];
    const g0 = data[1];
    const b0 = data[2];

    const tolerance = 5;
    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - r0) <= tolerance &&
        Math.abs(data[i + 1] - g0) <= tolerance &&
        Math.abs(data[i + 2] - b0) <= tolerance
      ) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private makeColorTransparent(img: HTMLImageElement, r: number, g: number, b: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const tolerance = 10;

    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - r) <= tolerance &&
        Math.abs(data[i + 1] - g) <= tolerance &&
        Math.abs(data[i + 2] - b) <= tolerance
      ) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private processEmeraldVersion(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const r0 = data[0];
    const g0 = data[1];
    const b0 = data[2];

    const tolerance = 10;
    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - r0) <= tolerance &&
        Math.abs(data[i + 1] - g0) <= tolerance &&
        Math.abs(data[i + 2] - b0) <= tolerance
      ) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private processLogoShine(img: HTMLImageElement): HTMLCanvasElement {
    // The logo shine has a green background that needs to be transparent
    // The white diagonal stripe is the actual shine effect
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Get the first pixel color (green background)
    const r0 = data[0];
    const g0 = data[1];
    const b0 = data[2];

    const tolerance = 10;
    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - r0) <= tolerance &&
        Math.abs(data[i + 1] - g0) <= tolerance &&
        Math.abs(data[i + 2] - b0) <= tolerance
      ) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private detectContentBounds(canvas: HTMLCanvasElement): ContentBounds {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;

    // Scan all pixels to find non-transparent, non-black content
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Check if pixel is visible (not transparent and not pure black)
        const isVisible = a > 10 && (r > 10 || g > 10 || b > 10);

        if (isVisible) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }

    // Handle case where no content found
    if (left > right || top > bottom) {
      return { left: 0, right: width - 1, top: 0, bottom: height - 1, width, height };
    }

    return {
      left,
      right,
      top,
      bottom,
      width: right - left + 1,
      height: bottom - top + 1,
    };
  }

  async exit(): Promise<void> {
    console.log('[TitleScreenState] Exiting...');

    // Remove mouse listener
    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }

    // Cleanup Three.js resources
    if (this.threeRenderer) {
      this.threeRenderer.dispose();
      this.threeRenderer = null;
    }
    if (this.threeScene) {
      this.threeScene.clear();
      this.threeScene = null;
    }
    this.threeCamera = null;
    this.rayquazaWrapper = null;
    this.rayquazaModel = null;
    this.rayquazaCanvas = null;
    this.mainLight = null;
    this.rayquazaRenderWidth = 0;
    this.rayquazaRenderHeight = 0;

    this.assets = null;
    this.assetsLoaded = false;
  }

  onViewportChange(viewport: ViewportConfig): void {
    // Update viewport dimensions
    this.viewportWidth = viewport.tilesWide * 16;
    this.viewportHeight = viewport.tilesHigh * 16;

    // Recalculate integer scale
    const scaleX = Math.floor(this.viewportWidth / GBA_WIDTH);
    const scaleY = Math.floor(this.viewportHeight / GBA_HEIGHT);
    this.scale = Math.max(1, Math.min(scaleX, scaleY));

    // Resize Three.js canvas and renderer
    if (this.rayquazaCanvas && this.threeRenderer) {
      const deviceRatio = window.devicePixelRatio || 1;
      const renderScale = Math.max(deviceRatio, this.scale);

      this.rayquazaCanvas.width = this.viewportWidth * renderScale;
      this.rayquazaCanvas.height = this.viewportHeight * renderScale;
      this.threeRenderer.setSize(this.viewportWidth * renderScale, this.viewportHeight * renderScale);
      this.rayquazaRenderWidth = this.rayquazaCanvas.width;
      this.rayquazaRenderHeight = this.rayquazaCanvas.height;
    }

    // Update camera aspect ratio
    if (this.threeCamera) {
      this.threeCamera.aspect = this.viewportWidth / this.viewportHeight;
      this.threeCamera.updateProjectionMatrix();
    }

    console.log('[TitleScreenState] Viewport changed to', this.viewportWidth, 'x', this.viewportHeight, 'scale:', this.scale);
  }

  update(dt: number): void {
    if (!this.assetsLoaded) return;

    this.gbaFrameAccumulator += dt;

    while (this.gbaFrameAccumulator >= GBA_FRAME_MS) {
      this.gbaFrameAccumulator -= GBA_FRAME_MS;
      this.totalFrames++;
      this.updateGbaFrame();
    }

    // Update Rayquaza 3D model animation
    this.updateRayquaza3D(dt);
  }

  private updateRayquaza3D(_dt: number): void {
    if (!this.rayquazaWrapper) return;

    // Base rotation from debug config (OBJ): (0, 1.1, 0)
    const baseRotX = 0;
    const baseRotY = 1.1;
    const baseRotZ = 0;

    // Keep X and Z rotation fixed
    this.rayquazaWrapper.rotation.x = baseRotX;
    this.rayquazaWrapper.rotation.z = baseRotZ;

    // Animate Y yaw: oscillate between -0.5 and +0.5 offset from base
    const yawOffset = Math.sin(this.totalFrames * 0.015) * 0.5;
    this.rayquazaWrapper.rotation.y = baseRotY + yawOffset;

    // Update light position based on mouse (interactive lighting!)
    if (this.mainLight) {
      // Map mouse position to light position
      // mouseX: 0 (left) to 1 (right) -> lightX: -2 to 2
      // mouseY: 0 (top) to 1 (bottom) -> lightY: 2 to -2
      const lightX = (this.mouseX - 0.5) * 4;
      const lightY = (0.5 - this.mouseY) * 4;
      const lightZ = 1.5;  // Keep Z relatively constant
      this.mainLight.position.set(lightX, lightY, lightZ);
    }
  }

  /**
   * Ensure the Three.js render target matches the actual canvas backing size.
   * This keeps the 3D model pixel-perfect on high-DPI and zoomed displays.
   */
  private resizeRayquazaRenderer(targetWidth: number, targetHeight: number): void {
    if (!this.threeRenderer || !this.threeCamera || !this.rayquazaCanvas) return;

    const width = Math.max(1, Math.round(targetWidth));
    const height = Math.max(1, Math.round(targetHeight));

    if (width === this.rayquazaRenderWidth && height === this.rayquazaRenderHeight) {
      return;
    }

    this.rayquazaCanvas.width = width;
    this.rayquazaCanvas.height = height;
    this.threeRenderer.setSize(width, height, false);

    this.threeCamera.aspect = width / height;
    this.threeCamera.updateProjectionMatrix();

    this.rayquazaRenderWidth = width;
    this.rayquazaRenderHeight = height;
  }

  private updateGbaFrame(): void {
    switch (this.phase) {
      case TitlePhase.PHASE1_SHINE_ON_BLACK:
        this.updatePhase1ShineOnBlack();
        break;
      case TitlePhase.PHASE2_LOGO_RISE:
        this.updatePhase2LogoRise();
        break;
      case TitlePhase.PHASE3_BACKGROUND_FADE:
        this.updatePhase3BackgroundFade();
        break;
      case TitlePhase.PHASE4_RAYQUAZA_FADE:
        this.updatePhase4RayquazaFade();
        break;
      case TitlePhase.PHASE5_INTERACTIVE:
        this.updatePhase5Interactive();
        break;
    }

    // Only scroll clouds once they're visible
    if (this.phase >= TitlePhase.PHASE3_BACKGROUND_FADE) {
      this.updateCloudScroll();
    }
    this.updateShineAnimation();
  }

  // Phase 1: Black screen with centered logo, shine animations
  private updatePhase1ShineOnBlack(): void {
    this.phaseFrameCount--;

    // Trigger shines at specific frames (counting down from 256)
    if (this.phaseFrameCount === 176) {
      this.startShine(ShineMode.DOUBLE);
    } else if (this.phaseFrameCount === 64) {
      this.startShine(ShineMode.SINGLE);
    }

    if (this.phaseFrameCount <= 0) {
      // Transition to logo rise phase
      this.phase = TitlePhase.PHASE2_LOGO_RISE;
      this.phaseFrameCount = PHASE2_FRAMES;
    }
  }

  // Phase 2: Logo rises up, version banner slides down and fades in
  private updatePhase2LogoRise(): void {
    this.phaseFrameCount--;

    const progress = 1 - (this.phaseFrameCount / PHASE2_FRAMES);

    // Logo rises up: logoRiseProgress goes from 1 (centered) to 0 (final top position)
    this.logoRiseProgress = Math.max(0, 1 - progress);

    // Version banner slides down (from above to final position)
    // GBA: VERSION_BANNER_Y=2 slides to VERSION_BANNER_Y_GOAL=66
    this.versionYOffset = (1 - progress) * -64 * this.scale;

    // Version banner fades in
    this.versionAlpha = Math.min(1, progress * 1.5);

    if (this.phaseFrameCount <= 0) {
      // Finalize positions
      this.logoRiseProgress = 0;
      this.versionYOffset = 0;
      this.versionAlpha = 1;
      // Transition to background fade
      this.phase = TitlePhase.PHASE3_BACKGROUND_FADE;
      this.phaseFrameCount = PHASE3_FRAMES;
    }
  }

  // Phase 3: Gradient + clouds fade in
  private updatePhase3BackgroundFade(): void {
    this.phaseFrameCount--;

    const progress = 1 - (this.phaseFrameCount / PHASE3_FRAMES);
    this.backgroundAlpha = Math.min(1, progress);

    if (this.phaseFrameCount <= 0) {
      this.backgroundAlpha = 1;
      // Transition to Rayquaza fade
      this.phase = TitlePhase.PHASE4_RAYQUAZA_FADE;
      this.phaseFrameCount = PHASE4_FRAMES;
    }
  }

  // Phase 4: Rayquaza fades in
  private updatePhase4RayquazaFade(): void {
    this.phaseFrameCount--;

    const progress = 1 - (this.phaseFrameCount / PHASE4_FRAMES);
    this.rayquazaAlpha = Math.min(1, progress);

    if (this.phaseFrameCount <= 0) {
      this.rayquazaAlpha = 1;
      // Transition to interactive
      this.phase = TitlePhase.PHASE5_INTERACTIVE;
    }
  }

  // Phase 5: Full interactive mode
  private updatePhase5Interactive(): void {
    // Press Start blinks every 16 frames
    this.pressStartVisible = (Math.floor(this.totalFrames / 16) % 2) === 0;

    // Periodic shine effect
    if (this.shineMode === ShineMode.INACTIVE && this.totalFrames % 240 === 0) {
      this.startShine(ShineMode.SINGLE_NO_BG);
    }
  }

  private startShine(mode: ShineMode): void {
    this.shineMode = mode;
    this.shineX = 0;
    this.shineTrailX = -80;
    this.shineBgIntensity = 0;
  }

  private updateShineAnimation(): void {
    if (this.shineMode === ShineMode.INACTIVE) return;

    const speed = this.shineMode === ShineMode.DOUBLE ? SHINE_DOUBLE_SPEED : SHINE_SPEED;
    this.shineX += speed;

    if (this.shineMode === ShineMode.DOUBLE) {
      this.shineTrailX += speed;
    }

    if (this.shineMode !== ShineMode.SINGLE_NO_BG) {
      if (this.shineX < GBA_WIDTH / 2) {
        this.shineBgIntensity = Math.min(31, this.shineBgIntensity + 2);
      } else {
        this.shineBgIntensity = Math.max(0, this.shineBgIntensity - 2);
      }
    }

    if (this.shineX > SHINE_END_X) {
      this.shineMode = ShineMode.INACTIVE;
      this.shineBgIntensity = 0;
    }
  }

  private updateCloudScroll(): void {
    // GBA scrolls clouds vertically at 0.5 pixels per frame
    // tBg1Y increments every other frame, then divided by 2
    this.cloudScrollY += 0.25; // Scroll up (positive = content moves up)
    if (this.cloudScrollY >= 256) {
      this.cloudScrollY -= 256;
    }

    // Wave effect phase increments each frame
    // GBA uses frequency=4, which means wave period is 256/4 = 64 scanlines
    // Increment by 2 for more visible animation (GBA increments faster in HBlank)
    this.cloudWavePhase += 2;
    if (this.cloudWavePhase >= 256) {
      this.cloudWavePhase -= 256;
    }
  }

  render(context: RenderContext): void {
    const { ctx2d, viewport } = context;
    const { width, height } = viewport;

    if (!this.assetsLoaded || !this.assets) {
      ctx2d.fillStyle = '#000';
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.fillStyle = '#fff';
      ctx2d.font = '16px monospace';
      ctx2d.textAlign = 'center';
      ctx2d.fillText('Loading...', width / 2, height / 2);
      return;
    }

    // Phase 1-2: Black background
    // Phase 3+: Gradient background (fades in during phase 3)
    if (this.phase < TitlePhase.PHASE3_BACKGROUND_FADE) {
      // Pure black background for phases 1-2
      ctx2d.fillStyle = '#000';
      ctx2d.fillRect(0, 0, width, height);
    } else {
      // Gradient background (with fade-in during phase 3)
      ctx2d.fillStyle = '#000';
      ctx2d.fillRect(0, 0, width, height);

      ctx2d.save();
      ctx2d.globalAlpha = this.backgroundAlpha;
      const gradient = ctx2d.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `rgb(${GRADIENT_TOP.r}, ${GRADIENT_TOP.g}, ${GRADIENT_TOP.b})`);
      gradient.addColorStop(1, `rgb(${GRADIENT_BOTTOM.r}, ${GRADIENT_BOTTOM.g}, ${GRADIENT_BOTTOM.b})`);
      ctx2d.fillStyle = gradient;
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.restore();
    }

    // Rayquaza (fades in during phase 4, visible in phase 5)
    if (this.phase >= TitlePhase.PHASE4_RAYQUAZA_FADE) {
      ctx2d.save();
      ctx2d.globalAlpha = this.rayquazaAlpha;
      this.renderRayquaza3D(ctx2d);
      ctx2d.restore();
    }

    // Clouds rendered IN FRONT of Rayquaza (with wave effect)
    if (this.phase >= TitlePhase.PHASE3_BACKGROUND_FADE) {
      ctx2d.save();
      ctx2d.globalAlpha = this.backgroundAlpha;
      this.renderCloudsViewport(ctx2d, width, height);
      ctx2d.restore();
    }

    // Pokemon logo with shine (always visible, position changes)
    this.renderPokemonLogoWithShine(ctx2d, width, height);

    // Version banner (appears in phase 2, slides down and fades in)
    if (this.phase >= TitlePhase.PHASE2_LOGO_RISE) {
      this.renderVersionBannerViewport(ctx2d, width, height);
    }

    // Press Start and Copyright (only in interactive phase)
    if (this.phase === TitlePhase.PHASE5_INTERACTIVE) {
      this.renderPressStartAndCopyrightViewport(ctx2d, width, height);
    }
  }

  private renderRayquaza3D(ctx: CanvasRenderingContext2D): void {
    if (!this.threeRenderer || !this.threeScene || !this.threeCamera || !this.rayquazaCanvas) {
      return;
    }

    // Match Three.js render target to the real backing resolution of the state canvas
    // (includes devicePixelRatio and zoom applied by the parent render loop)
    this.resizeRayquazaRenderer(ctx.canvas.width, ctx.canvas.height);

    // Render Three.js scene to offscreen canvas (at native resolution)
    this.threeRenderer.render(this.threeScene, this.threeCamera);

    // IMPORTANT: Enable image smoothing for crisp 3D downscaling
    // (pixel art elsewhere uses imageSmoothingEnabled = false)
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw the high-res 3D render scaled to viewport size
    ctx.drawImage(
      this.rayquazaCanvas,
      0, 0, this.rayquazaCanvas.width, this.rayquazaCanvas.height,  // Source (high-res)
      0, 0, this.viewportWidth, this.viewportHeight                  // Dest (viewport size)
    );

    ctx.restore();
  }

  private renderCloudsViewport(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number): void {
    if (!this.assets) return;

    const cloudImg = this.assets.cloudsBg;
    const cloudWidth = cloudImg.width;   // 256px
    const cloudHeight = cloudImg.height; // 256px

    // GBA uses BLDALPHA_BLEND(6, 15) - clouds at 6/16 = 37.5% opacity
    ctx.save();
    ctx.globalAlpha = 6 / 16;
    ctx.imageSmoothingEnabled = false;

    // Use integer scroll position to avoid sub-pixel gaps
    const scrollY = Math.floor(this.cloudScrollY);

    // Wave parameters from GBA: frequency=4, amplitude=4
    // This creates a sine wave with period of 64 scanlines (256/4)
    // and ±4 pixel horizontal displacement (scaled for viewport)
    const waveFrequency = 4;
    const waveAmplitude = 4 * this.scale;  // Scale amplitude with viewport

    // Draw clouds scanline by scanline for wave effect
    // Each scanline gets a horizontal offset based on sine wave
    for (let screenY = 0; screenY < viewportHeight; screenY++) {
      // Calculate wave offset for this scanline
      // GBA sine table is 256 entries, so theta = (y * frequency + phase) % 256
      const theta = ((screenY * waveFrequency) + this.cloudWavePhase) % 256;
      // Sine approximation: sin(theta * 2π/256) * amplitude
      const waveOffset = Math.floor(Math.sin(theta * Math.PI * 2 / 256) * waveAmplitude);

      // Calculate source Y in the cloud tilemap (with vertical scrolling)
      const srcY = (screenY + scrollY) % cloudHeight;

      // Draw this scanline across the full width, tiling horizontally
      for (let tileX = -cloudWidth + waveOffset; tileX < viewportWidth; tileX += cloudWidth) {
        ctx.drawImage(
          cloudImg,
          0, srcY, cloudWidth, 1,  // Source: full width, 1 pixel tall at srcY
          tileX, screenY, cloudWidth, 1  // Dest: at waveOffset position
        );
      }
    }

    ctx.restore();
  }

  private renderPokemonLogoWithShine(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number): void {
    if (!this.assets) return;

    const logo = this.assets.pokemonLogoCanvas;
    const shine = this.assets.logoShineCanvas;
    const bounds = this.assets.logoContentBounds;

    // Scale to fit viewport (use same scale as GBA content)
    const scaledCanvasWidth = logo.width * this.scale;
    const scaledCanvasHeight = logo.height * this.scale;

    // Use content bounds for centering (not full canvas)
    const scaledContentWidth = bounds.width * this.scale;
    const scaledContentLeft = bounds.left * this.scale;

    // Center the actual content horizontally
    const contentCenterOffset = scaledContentLeft + scaledContentWidth / 2;
    const logoX = (viewportWidth / 2) - contentCenterOffset;

    // Final Y position (about 5% from top of viewport)
    const finalY = viewportHeight * 0.05;

    // Center Y position (vertically centered in viewport)
    const centerY = (viewportHeight - scaledCanvasHeight) / 2;

    // Interpolate between center (logoRiseProgress=1) and final position (logoRiseProgress=0)
    const logoY = finalY + (centerY - finalY) * this.logoRiseProgress;

    // Draw the logo
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(logo, logoX, logoY, scaledCanvasWidth, scaledCanvasHeight);
    ctx.restore();

    // GBA OBJ_WINDOW shine effect:
    // - The shine sprite defines a window region (white pixels = inside window)
    // - BLDCNT_TGT1_BG2 | BLDCNT_EFFECT_LIGHTEN - BG2 (logo) gets BRIGHTENED inside window
    // - BLDY = 12 means 12/16 = 75% brightness increase
    // - Effect only appears where BOTH the shine window AND logo pixels exist
    if (this.shineMode !== ShineMode.INACTIVE) {
      // Create a temporary canvas for the lighten effect
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = scaledCanvasWidth;
      tempCanvas.height = scaledCanvasHeight;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.imageSmoothingEnabled = false;

      // Calculate shine position relative to logo canvas
      // GBA uses affine BG with reference point (-29, -32), but this doesn't translate
      // directly to logo canvas coordinates. The shine sweeps horizontally across
      // the logo text, so we position it to overlap the logo vertically.
      // X offset: shineX starts at 0 on GBA screen, logo visual starts around X=0-10
      // Y offset: position shine to sweep across the middle of the logo text
      const shineScaledWidth = shine.width * this.scale;
      const shineScaledHeight = shine.height * this.scale;
      const shineRelativeX = this.shineX * this.scale;
      // Position shine to sweep across the logo text (shine is 64px, logo is 64px tall)
      // A small negative offset ensures the diagonal stripe hits the text area
      const shineRelativeY = -8 * this.scale;

      // Step 1: Draw the shine sprite (this defines the "window" region)
      // The shine has green=transparent, white=window
      if (this.shineX < SHINE_END_X) {
        tempCtx.drawImage(shine, shineRelativeX, shineRelativeY, shineScaledWidth, shineScaledHeight);
      }

      // Draw trail shine for double mode
      if (this.shineMode === ShineMode.DOUBLE && this.shineTrailX > -64 && this.shineTrailX < SHINE_END_X) {
        const trailRelativeX = this.shineTrailX * this.scale;
        tempCtx.drawImage(shine, trailRelativeX, shineRelativeY, shineScaledWidth, shineScaledHeight);
      }

      // Step 2: Use 'destination-in' to mask shine to ONLY where logo pixels exist
      // This creates the intersection: shine window AND logo pixels
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(logo, 0, 0, scaledCanvasWidth, scaledCanvasHeight);

      // Step 3: Draw the masked region onto the main canvas with 'lighter' blend
      // This brightens the logo where the shine passes (GBA LIGHTEN effect)
      // GBA BLDY=12 means 12/16 = 75% increase, but 'lighter' adds, so use alpha
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.75; // Approximate BLDY=12
      ctx.drawImage(tempCanvas, logoX, logoY);
      ctx.restore();
    }
  }


  private renderVersionBannerViewport(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number): void {
    if (!this.assets) return;

    const img = this.assets.emeraldVersionCanvas;
    const bounds = this.assets.versionContentBounds;

    // Scale version banner
    const scaledCanvasWidth = img.width * this.scale;
    const scaledCanvasHeight = img.height * this.scale;

    // Use content bounds for centering (not full canvas)
    const scaledContentWidth = bounds.width * this.scale;
    const scaledContentLeft = bounds.left * this.scale;

    // Center the actual content horizontally
    const contentCenterOffset = scaledContentLeft + scaledContentWidth / 2;
    const bannerX = (viewportWidth / 2) - contentCenterOffset;

    // Final position at ~70% down the screen (between 2/3 and 3/4)
    const finalY = viewportHeight * 0.70;

    // During phase 2, version slides down (versionYOffset animates from -64*scale to 0)
    const bannerY = finalY + this.versionYOffset;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = this.versionAlpha;
    ctx.drawImage(img, bannerX, bannerY, scaledCanvasWidth, scaledCanvasHeight);
    ctx.restore();
  }

  private renderPressStartAndCopyrightViewport(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number): void {
    const fontSize = Math.max(12, 8 * this.scale);
    const smallFontSize = Math.max(10, 6 * this.scale);

    // Press Start at ~82% down
    if (this.pressStartVisible) {
      ctx.save();
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const pressStartY = viewportHeight * 0.82;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText('PRESS START', viewportWidth / 2 + 1, pressStartY + 1);

      // Text
      ctx.fillStyle = '#fff';
      ctx.fillText('PRESS START', viewportWidth / 2, pressStartY);

      ctx.restore();
    }

    // Copyright at ~92% down
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${smallFontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('© 2002-2004 POKEMON / NINTENDO', viewportWidth / 2, viewportHeight * 0.92);
    ctx.restore();
  }

  handleInput(input: InputState): StateTransition | null {
    // Skip to next phase on any button press during early phases
    if (this.phase === TitlePhase.PHASE1_SHINE_ON_BLACK && input.pressed.size > 0) {
      // Skip to logo rise phase
      this.phase = TitlePhase.PHASE2_LOGO_RISE;
      this.phaseFrameCount = PHASE2_FRAMES;
      return null;
    }

    // Go to main menu on Start/A during later phases
    if (
      this.phase >= TitlePhase.PHASE2_LOGO_RISE &&
      (input.pressed.has('Enter') ||
        input.pressed.has('Space') ||
        input.pressed.has('KeyZ') ||
        input.pressed.has('KeyA'))
    ) {
      return { to: GameState.MAIN_MENU };
    }

    return null;
  }
}

export function createTitleScreenState(): StateRenderer {
  return new TitleScreenState();
}

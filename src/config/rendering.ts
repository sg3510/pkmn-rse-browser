/**
 * Rendering Configuration
 *
 * Controls rendering backend selection and options.
 */

/**
 * Rendering configuration options
 */
export interface RenderingConfig {
  /** Enable WebGL rendering (when available) */
  enableWebGL: boolean;

  /** Force Canvas2D even if WebGL is available */
  forceCanvas2D: boolean;

  /** WebGL-specific settings */
  webgl: {
    /** Maximum texture size (power of 2) */
    maxTextureSize: number;

    /** Maximum instances per draw call */
    maxInstances: number;

    /** Enable dirty region tracking optimization */
    enableDirtyTracking: boolean;

    /** Enable costly framebuffer readback diagnostics (readPixels) */
    enableRuntimeDiagnosticsReadback: boolean;
  };

  /** Debug settings */
  debug: {
    /** Show which renderer type is active */
    showRendererType: boolean;

    /** Log frame times */
    logFrameTime: boolean;

    /** Log WebGL context events */
    logContextEvents: boolean;
  };
}

/**
 * Default rendering configuration
 */
export const DEFAULT_RENDERING_CONFIG: RenderingConfig = {
  enableWebGL: false,  // Disabled in main game - use debug page for WebGL testing
  forceCanvas2D: true,

  webgl: {
    maxTextureSize: 4096,
    maxInstances: 8192,
    enableDirtyTracking: true,
    enableRuntimeDiagnosticsReadback: false,
  },

  debug: {
    showRendererType: false,
    logFrameTime: false,
    logContextEvents: false,
  },
};

/**
 * Global rendering configuration instance
 *
 * Can be modified at runtime to change rendering behavior.
 */
export const RENDERING_CONFIG: RenderingConfig = { ...DEFAULT_RENDERING_CONFIG };

/**
 * Update rendering configuration
 *
 * @param updates - Partial configuration updates
 */
export function updateRenderingConfig(updates: Partial<RenderingConfig>): void {
  Object.assign(RENDERING_CONFIG, updates);
}

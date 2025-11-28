/**
 * WebGLContext - Manages WebGL2 context creation and lifecycle
 *
 * Handles:
 * - Context initialization with feature detection
 * - Capability querying
 * - Context loss/restore handling
 * - Cleanup
 */

import type { WebGLCapabilities, WebGLExtensions } from './types';

/**
 * WebGL context manager
 *
 * Provides a clean interface for WebGL2 context management with
 * automatic fallback detection and error handling.
 */
export class WebGLContext {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement;
  private extensions: WebGLExtensions = {};
  private capabilities: WebGLCapabilities | null = null;
  private contextLostHandler: ((event: Event) => void) | null = null;
  private contextRestoredHandler: ((event: Event) => void) | null = null;
  private onContextLost: (() => void) | null = null;
  private onContextRestored: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Initialize WebGL2 context
   *
   * @returns true if initialization succeeded, false otherwise
   */
  initialize(): boolean {
    try {
      // Try to get WebGL2 context
      const gl = this.canvas.getContext('webgl2', {
        alpha: true,
        antialias: false, // Pixel-perfect rendering, no AA
        depth: false, // 2D rendering, no depth buffer needed
        stencil: false,
        premultipliedAlpha: true, // keep alpha for drawImage to 2D canvas
        preserveDrawingBuffer: true, // retain alpha channel between composites
        powerPreference: 'high-performance',
      });

      if (!gl) {
        console.warn('WebGL2 not supported');
        return false;
      }

      this.gl = gl;
      this.detectCapabilities();
      this.setupContextLossHandlers();

      // Initial WebGL state setup
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

      return true;
    } catch (error) {
      console.error('WebGL2 initialization failed:', error);
      return false;
    }
  }

  /**
   * Get the WebGL2 rendering context
   *
   * @throws Error if context not initialized
   */
  getGL(): WebGL2RenderingContext {
    if (!this.gl) {
      throw new Error('WebGL context not initialized. Call initialize() first.');
    }
    return this.gl;
  }

  /**
   * Check if context is available and valid
   */
  isValid(): boolean {
    return this.gl !== null && !this.gl.isContextLost();
  }

  /**
   * Get detected capabilities
   */
  getCapabilities(): WebGLCapabilities {
    if (!this.capabilities) {
      throw new Error('Capabilities not available. Call initialize() first.');
    }
    return this.capabilities;
  }

  /**
   * Get WebGL extensions
   */
  getExtensions(): WebGLExtensions {
    return this.extensions;
  }

  /**
   * Set context loss callback
   */
  setContextLostCallback(callback: () => void): void {
    this.onContextLost = callback;
  }

  /**
   * Set context restored callback
   */
  setContextRestoredCallback(callback: () => void): void {
    this.onContextRestored = callback;
  }

  /**
   * Resize the viewport to match canvas size
   */
  resize(width: number, height: number): void {
    if (!this.gl) return;

    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Clear the canvas
   */
  clear(r: number = 0, g: number = 0, b: number = 0, a: number = 0): void {
    if (!this.gl) return;

    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.removeContextLossHandlers();

    if (this.gl) {
      // Note: Don't explicitly call loseContext() as it can interfere
      // with creating new contexts on the same canvas (common in React StrictMode)
      // The context will be garbage collected automatically
      this.gl = null;
    }

    this.capabilities = null;
    this.extensions = {};
  }

  /**
   * Detect WebGL capabilities
   */
  private detectCapabilities(): void {
    const gl = this.gl;
    if (!gl) return;

    this.capabilities = {
      webgl2: true,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      instancedArrays: true, // Built into WebGL2
      floatTextures: gl.getExtension('EXT_color_buffer_float') !== null,
      vertexArrayObjects: true, // Built into WebGL2
    };
  }

  /**
   * Set up context loss/restore handlers
   */
  private setupContextLossHandlers(): void {
    this.contextLostHandler = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost');
      if (this.onContextLost) {
        this.onContextLost();
      }
    };

    this.contextRestoredHandler = () => {
      console.info('WebGL context restored');
      // Re-detect capabilities after restore
      this.detectCapabilities();
      if (this.onContextRestored) {
        this.onContextRestored();
      }
    };

    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  /**
   * Remove context loss handlers
   */
  private removeContextLossHandlers(): void {
    if (this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
      this.contextLostHandler = null;
    }
    if (this.contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
      this.contextRestoredHandler = null;
    }
  }
}

/**
 * Check if WebGL2 is supported on this device
 */
export function isWebGL2Supported(canvas?: HTMLCanvasElement): boolean {
  try {
    const testCanvas = canvas || document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2');
    return gl !== null;
  } catch {
    return false;
  }
}

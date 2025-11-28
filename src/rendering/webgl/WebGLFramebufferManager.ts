/**
 * WebGLFramebufferManager - Manages framebuffers for 3-pass rendering
 *
 * Creates and manages off-screen framebuffers for:
 * - Background pass (BG2)
 * - TopBelow pass (BG1 below player)
 * - TopAbove pass (BG1 above player)
 *
 * Each framebuffer has an associated texture that can be sampled
 * during the composition phase.
 */

type PassName = 'background' | 'topBelow' | 'topAbove';

interface FramebufferEntry {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

export class WebGLFramebufferManager {
  private gl: WebGL2RenderingContext;
  private framebuffers: Map<PassName, FramebufferEntry> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Initialize framebuffers for all three passes
   */
  initialize(width: number, height: number): void {
    const passes: PassName[] = ['background', 'topBelow', 'topAbove'];
    for (const pass of passes) {
      this.createFramebuffer(pass, width, height);
    }
  }

  /**
   * Get framebuffer for a specific pass
   * Creates or resizes if necessary
   */
  getFramebuffer(pass: PassName, width: number, height: number): WebGLFramebuffer {
    const entry = this.framebuffers.get(pass);

    // Create if doesn't exist or resize if dimensions changed
    if (!entry || entry.width !== width || entry.height !== height) {
      this.createFramebuffer(pass, width, height);
    }

    const result = this.framebuffers.get(pass);
    if (!result) {
      throw new Error(`Failed to get framebuffer for pass: ${pass}`);
    }

    return result.framebuffer;
  }

  /**
   * Get the texture associated with a pass (for compositing)
   */
  getPassTexture(pass: PassName): WebGLTexture {
    const entry = this.framebuffers.get(pass);
    if (!entry) {
      throw new Error(`No framebuffer for pass: ${pass}. Call getFramebuffer first.`);
    }
    return entry.texture;
  }

  /**
   * Bind framebuffer for rendering
   */
  bindFramebuffer(pass: PassName): void {
    const entry = this.framebuffers.get(pass);
    if (!entry) {
      throw new Error(`No framebuffer for pass: ${pass}`);
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, entry.framebuffer);
    this.gl.viewport(0, 0, entry.width, entry.height);
  }

  /**
   * Unbind framebuffer (render to screen)
   */
  unbindFramebuffer(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Clear the bound framebuffer
   */
  clear(r: number = 0, g: number = 0, b: number = 0, a: number = 0): void {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * Get dimensions of a pass framebuffer
   */
  getDimensions(pass: PassName): { width: number; height: number } | null {
    const entry = this.framebuffers.get(pass);
    return entry ? { width: entry.width, height: entry.height } : null;
  }

  /**
   * Clean up all framebuffers
   */
  dispose(): void {
    const { gl } = this;

    for (const entry of this.framebuffers.values()) {
      gl.deleteFramebuffer(entry.framebuffer);
      gl.deleteTexture(entry.texture);
    }

    this.framebuffers.clear();
  }

  /**
   * Create or recreate a framebuffer for a specific pass
   */
  private createFramebuffer(pass: PassName, width: number, height: number): void {
    const { gl } = this;

    // Clean up existing framebuffer if present
    const existing = this.framebuffers.get(pass);
    if (existing) {
      gl.deleteFramebuffer(existing.framebuffer);
      gl.deleteTexture(existing.texture);
    }

    // Create texture for the framebuffer
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error(`Failed to create texture for pass: ${pass}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    // Nearest filtering for pixel-perfect rendering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create framebuffer
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      gl.deleteTexture(texture);
      throw new Error(`Failed to create framebuffer for pass: ${pass}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      throw new Error(`Framebuffer incomplete for pass ${pass}: ${status}`);
    }

    // Unbind
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Store
    this.framebuffers.set(pass, {
      framebuffer,
      texture,
      width,
      height,
    });
  }
}

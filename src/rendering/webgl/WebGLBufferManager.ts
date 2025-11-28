/**
 * WebGLBufferManager - Manages instance buffers for instanced rendering
 *
 * Handles:
 * - Instance buffer creation and resizing
 * - Efficient data packing for GPU upload
 * - Buffer binding for draw calls
 *
 * Key optimization: Pre-allocate buffers to avoid per-frame allocation
 */

import type { TileInstance } from './types';
import { packTileInstance } from './types';

/** Floats per instance (x, y, tileId, flags) */
const FLOATS_PER_INSTANCE = 4;

/** Bytes per instance (4 floats × 4 bytes) */
const BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * 4;

/**
 * Instance buffer manager for WebGL instanced rendering
 *
 * Manages a Float32Array buffer that is uploaded to GPU for
 * instanced draw calls. Handles dynamic resizing and efficient
 * data packing.
 */
export class WebGLBufferManager {
  private gl: WebGL2RenderingContext;
  private instanceBuffer: WebGLBuffer | null = null;
  private instanceData: Float32Array;
  private maxInstances: number;
  private currentInstanceCount: number = 0;

  // VAO for instanced rendering
  private vao: WebGLVertexArrayObject | null = null;
  private quadBuffer: WebGLBuffer | null = null;

  /**
   * Create a buffer manager
   *
   * @param gl - WebGL2 context
   * @param initialCapacity - Initial instance capacity (default 4096 = ~16KB)
   */
  constructor(gl: WebGL2RenderingContext, initialCapacity: number = 4096) {
    this.gl = gl;
    this.maxInstances = initialCapacity;
    this.instanceData = new Float32Array(initialCapacity * FLOATS_PER_INSTANCE);
  }

  /**
   * Initialize buffers and VAO
   *
   * Must be called before rendering.
   *
   * @param positionAttribLoc - Attribute location for quad position
   * @param instanceDataAttribLoc - Attribute location for instance data
   */
  initialize(positionAttribLoc: number, instanceDataAttribLoc: number): void {
    const { gl } = this;

    // Create VAO
    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error('Failed to create VAO');
    }
    gl.bindVertexArray(this.vao);

    // Create quad vertex buffer (unit quad: 0,0 to 1,1)
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0, // Bottom-left
        1, 0, // Bottom-right
        0, 1, // Top-left
        1, 1, // Top-right
      ]),
      gl.STATIC_DRAW
    );

    // Set up position attribute (per-vertex)
    gl.enableVertexAttribArray(positionAttribLoc);
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);

    // Create instance buffer
    this.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.instanceData.byteLength,
      gl.DYNAMIC_DRAW
    );

    // Set up instance data attribute (per-instance)
    gl.enableVertexAttribArray(instanceDataAttribLoc);
    gl.vertexAttribPointer(
      instanceDataAttribLoc,
      4, // x, y, tileId, flags
      gl.FLOAT,
      false,
      BYTES_PER_INSTANCE,
      0
    );
    // This attribute advances once per instance, not per vertex
    gl.vertexAttribDivisor(instanceDataAttribLoc, 1);

    gl.bindVertexArray(null);
  }

  /**
   * Ensure buffer can hold the given number of instances
   *
   * Resizes the buffer if needed (doubles capacity).
   */
  ensureCapacity(instanceCount: number): void {
    if (instanceCount <= this.maxInstances) {
      return;
    }

    // Double capacity until sufficient
    let newCapacity = this.maxInstances;
    while (newCapacity < instanceCount) {
      newCapacity *= 2;
    }

    // Create new data array
    this.instanceData = new Float32Array(newCapacity * FLOATS_PER_INSTANCE);
    this.maxInstances = newCapacity;

    // Resize GPU buffer
    if (this.instanceBuffer) {
      const { gl } = this;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        this.instanceData.byteLength,
        gl.DYNAMIC_DRAW
      );
    }
  }

  /**
   * Update instance buffer with tile data
   *
   * Packs tile instances into the buffer and uploads to GPU.
   *
   * @param tiles - Array of tile instances to render
   */
  updateInstanceBuffer(tiles: TileInstance[]): void {
    this.ensureCapacity(tiles.length);

    // Pack tiles into buffer
    for (let i = 0; i < tiles.length; i++) {
      const packed = packTileInstance(tiles[i]);
      const offset = i * FLOATS_PER_INSTANCE;
      this.instanceData[offset] = packed.x;
      this.instanceData[offset + 1] = packed.y;
      this.instanceData[offset + 2] = packed.tileId;
      this.instanceData[offset + 3] = packed.flags;
    }

    this.currentInstanceCount = tiles.length;

    // Upload to GPU
    if (this.instanceBuffer) {
      const { gl } = this;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      // Use subData for partial updates when possible
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.instanceData.subarray(0, tiles.length * FLOATS_PER_INSTANCE)
      );
    }
  }

  /**
   * Update instance buffer with pre-packed data
   *
   * More efficient when data is already packed.
   *
   * @param packedData - Pre-packed Float32Array of instance data
   * @param instanceCount - Number of instances in the data
   */
  updateInstanceBufferPacked(packedData: Float32Array, instanceCount: number): void {
    this.ensureCapacity(instanceCount);
    this.currentInstanceCount = instanceCount;

    if (this.instanceBuffer) {
      const { gl } = this;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, packedData);
    }
  }

  /**
   * Bind VAO for rendering
   */
  bind(): void {
    this.gl.bindVertexArray(this.vao);
  }

  /**
   * Unbind VAO
   */
  unbind(): void {
    this.gl.bindVertexArray(null);
  }

  /**
   * Get the current instance count
   */
  getInstanceCount(): number {
    return this.currentInstanceCount;
  }

  /**
   * Get the maximum capacity
   */
  getCapacity(): number {
    return this.maxInstances;
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    capacity: number;
    currentCount: number;
    bufferSizeBytes: number;
    utilizationPercent: number;
  } {
    return {
      capacity: this.maxInstances,
      currentCount: this.currentInstanceCount,
      bufferSizeBytes: this.maxInstances * BYTES_PER_INSTANCE,
      utilizationPercent: (this.currentInstanceCount / this.maxInstances) * 100,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    const { gl } = this;

    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }

    if (this.quadBuffer) {
      gl.deleteBuffer(this.quadBuffer);
      this.quadBuffer = null;
    }

    if (this.instanceBuffer) {
      gl.deleteBuffer(this.instanceBuffer);
      this.instanceBuffer = null;
    }
  }
}

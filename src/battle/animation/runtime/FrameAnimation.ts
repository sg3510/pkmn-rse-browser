/** Frame/affine command playback from public/pokeemerald/src/sprite.c. */
import type { FrameCommand } from '../types.ts';
export class FrameAnimation {
  index = -1;
  remaining = 0;
  ended = false;
  tileOffset = 0;
  scaleX = 256;
  scaleY = 256;
  rotation = 0;
  hFlip = false;
  vFlip = false;
  private commands: readonly FrameCommand[];
  private affine: boolean;
  constructor(commands: readonly FrameCommand[], affine = false) { this.commands = commands; this.affine = affine; }
  step(): void {
    if (this.ended) return;
    // BeginAnim keeps animBeginning set when its very first command is END.
    if (this.commands.length === 1 && this.commands[0].op === 'END') return;
    if (this.remaining > 0) {
      this.remaining--;
      if (this.affine) this.applyRelative(this.commands[this.index]);
      return;
    }
    this.index++;
    for (let budget = 0; budget < 32; budget++) {
      const command = this.commands[this.index];
      if (!command) throw new Error('Frame animation exceeded its command table');
      if (command.op === 'END' || command.op === 'END_ALT') { this.ended = true; return; }
      if (command.op === 'JUMP') { this.index = command.args[0]; continue; }
      if (command.op !== 'FRAME') throw new Error(`Unsupported frame command ${command.op}`);
      if (!this.affine) {
        this.tileOffset = command.args[0]; this.hFlip = !!command.hFlip; this.vFlip = !!command.vFlip;
        this.remaining = Math.max(0, command.args[1] - 1); return;
      }
      const [x, y, rotation, duration] = command.args;
      if (duration === 0) {
        this.scaleX = x; this.scaleY = y; this.rotation = rotation;
        // Absolute affine commands occupy this update, as in ApplyAffineAnimFrame.
        return;
      }
      this.applyRelative(command); this.remaining = Math.max(0, duration - 1); return;
    }
    throw new Error('Frame animation instruction limit exceeded');
  }
  private applyRelative(command: FrameCommand): void {
    this.scaleX = (this.scaleX + command.args[0]) << 16 >> 16;
    this.scaleY = (this.scaleY + command.args[1]) << 16 >> 16;
    this.rotation = (this.rotation + command.args[2]) & 255;
  }
}

/**
 * TruckSequence - State machine for the inside-of-truck intro cutscene.
 *
 * C references:
 * - public/pokeemerald/src/field_special_scene.c (Task_HandleTruckSequence, Task_Truck1/2/3)
 */

const TRUCK_CAMERA_HORIZONTAL_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  1, 2, 2, 2, 2, 2, 2,
  -1, -1, -1,
  0,
] as const;

export interface TruckBoxOffsets {
  box1X: number;
  box1Y: number;
  box2X: number;
  box2Y: number;
  box3X: number;
  box3Y: number;
}

export interface TruckSequenceOutput {
  /** Camera X panning offset in pixels (applied to view) */
  cameraOffsetX: number;
  /** Camera Y panning offset in pixels (applied to view) */
  cameraOffsetY: number;
  /** Whether player input should be locked */
  playerLocked: boolean;
  /** Whether the entire sequence is complete */
  complete: boolean;
  /** Per-box sprite offsets inside truck */
  boxOffsets: TruckBoxOffsets;
}

export class TruckSequence {
  /** Resting box offsets from field_special_scene.c */
  private static readonly RESTING_BOX_OFFSETS: TruckBoxOffsets = {
    box1X: 3,
    box1Y: 3,
    box2X: 0,
    box2Y: -3,
    box3X: -3,
    box3Y: 0,
  };

  private mainState = 0;
  private mainTimer = 0;
  private truckTask: 'none' | 'truck1' | 'truck2' | 'truck3' = 'none';

  // Task_Truck1
  private truck1Timer = 0;

  // Task_Truck2 / Task_Truck3
  private truck2TimerHorizontal = 0;
  private truck2MoveStep = 0;
  private truck2TimerVertical = 0;

  private _complete = false;
  private output: TruckSequenceOutput = {
    cameraOffsetX: 0,
    cameraOffsetY: 0,
    playerLocked: true,
    complete: false,
    boxOffsets: TruckSequence.RESTING_BOX_OFFSETS,
  };

  /**
   * Port of GetTruckCameraBobbingY from field_special_scene.c.
   */
  private static getTruckCameraBobbingY(time: number): number {
    if ((time % 120) === 0) return -1;
    if ((time % 10) <= 4) return 1;
    return 0;
  }

  /**
   * Port of GetTruckBoxYMovement from field_special_scene.c.
   */
  private static getTruckBoxYMovement(time: number): number {
    return ((time + 120) % 180) === 0 ? -1 : 0;
  }

  private static getRestingOffsetsWithCameraX(cameraX: number): TruckBoxOffsets {
    return {
      box1X: TruckSequence.RESTING_BOX_OFFSETS.box1X - cameraX,
      box1Y: TruckSequence.RESTING_BOX_OFFSETS.box1Y,
      box2X: TruckSequence.RESTING_BOX_OFFSETS.box2X - cameraX,
      box2Y: TruckSequence.RESTING_BOX_OFFSETS.box2Y,
      box3X: TruckSequence.RESTING_BOX_OFFSETS.box3X - cameraX,
      box3Y: TruckSequence.RESTING_BOX_OFFSETS.box3Y,
    };
  }

  private stepMainTask(): void {
    switch (this.mainState) {
      case 0:
        this.mainTimer++;
        if (this.mainTimer === 90) {
          this.mainTimer = 0;
          this.truckTask = 'truck1';
          this.truck1Timer = 0;
          this.mainState = 1;
        }
        break;
      case 1:
        this.mainTimer++;
        if (this.mainTimer === 150) {
          this.mainTimer = 0;
          this.mainState = 2;
        }
        break;
      case 2:
        this.mainTimer++;
        if (this.mainTimer > 300) {
          this.mainTimer = 0;
          this.truckTask = 'truck2';
          this.truck2TimerHorizontal = 0;
          this.truck2MoveStep = 0;
          this.truck2TimerVertical = 0;
          this.mainState = 3;
        }
        break;
      case 3:
        if (this.truckTask === 'none') {
          this.mainTimer = 0;
          this.mainState = 4;
        }
        break;
      case 4:
        this.mainTimer++;
        if (this.mainTimer === 90) {
          this.mainTimer = 0;
          this.mainState = 5;
        }
        break;
      case 5:
        this.mainTimer++;
        if (this.mainTimer === 120) {
          this._complete = true;
          this.truckTask = 'none';
        }
        break;
      default:
        this._complete = true;
        this.truckTask = 'none';
        break;
    }
  }

  private stepTruckTask(): { cameraX: number; cameraY: number; boxOffsets: TruckBoxOffsets } {
    if (this.truckTask === 'truck1') {
      const cameraX = 0;
      const box1Y = TruckSequence.getTruckBoxYMovement(this.truck1Timer + 30) * 4;
      const box2Y = TruckSequence.getTruckBoxYMovement(this.truck1Timer) * 2;
      const box3Y = TruckSequence.getTruckBoxYMovement(this.truck1Timer) * 4;
      const boxOffsets: TruckBoxOffsets = {
        box1X: TruckSequence.RESTING_BOX_OFFSETS.box1X - cameraX,
        box1Y: TruckSequence.RESTING_BOX_OFFSETS.box1Y + box1Y,
        box2X: TruckSequence.RESTING_BOX_OFFSETS.box2X - cameraX,
        box2Y: TruckSequence.RESTING_BOX_OFFSETS.box2Y + box2Y,
        box3X: TruckSequence.RESTING_BOX_OFFSETS.box3X - cameraX,
        box3Y: TruckSequence.RESTING_BOX_OFFSETS.box3Y + box3Y,
      };

      this.truck1Timer++;
      if (this.truck1Timer === 30000) {
        this.truck1Timer = 0;
      }

      const cameraY = TruckSequence.getTruckCameraBobbingY(this.truck1Timer);
      return { cameraX, cameraY, boxOffsets };
    }

    if (this.truckTask === 'truck2') {
      this.truck2TimerHorizontal++;
      this.truck2TimerVertical++;

      if (this.truck2TimerHorizontal > 5) {
        this.truck2TimerHorizontal = 0;
        this.truck2MoveStep++;
      }

      if (this.truck2MoveStep >= TRUCK_CAMERA_HORIZONTAL_TABLE.length) {
        this.truckTask = 'none';
        return {
          cameraX: 0,
          cameraY: 0,
          boxOffsets: TruckSequence.RESTING_BOX_OFFSETS,
        };
      }

      const cameraX = TRUCK_CAMERA_HORIZONTAL_TABLE[this.truck2MoveStep];
      if (cameraX === 2) {
        this.truckTask = 'truck3';
      }

      const cameraY = TruckSequence.getTruckCameraBobbingY(this.truck2TimerVertical);
      const box1Y = TruckSequence.getTruckBoxYMovement(this.truck2TimerVertical + 30) * 4;
      const box2Y = TruckSequence.getTruckBoxYMovement(this.truck2TimerVertical) * 2;
      const box3Y = TruckSequence.getTruckBoxYMovement(this.truck2TimerVertical) * 4;
      const boxOffsets: TruckBoxOffsets = {
        box1X: TruckSequence.RESTING_BOX_OFFSETS.box1X - cameraX,
        box1Y: TruckSequence.RESTING_BOX_OFFSETS.box1Y + box1Y,
        box2X: TruckSequence.RESTING_BOX_OFFSETS.box2X - cameraX,
        box2Y: TruckSequence.RESTING_BOX_OFFSETS.box2Y + box2Y,
        box3X: TruckSequence.RESTING_BOX_OFFSETS.box3X - cameraX,
        box3Y: TruckSequence.RESTING_BOX_OFFSETS.box3Y + box3Y,
      };

      return { cameraX, cameraY, boxOffsets };
    }

    if (this.truckTask === 'truck3') {
      this.truck2TimerHorizontal++;

      if (this.truck2TimerHorizontal > 5) {
        this.truck2TimerHorizontal = 0;
        this.truck2MoveStep++;
      }

      if (this.truck2MoveStep >= TRUCK_CAMERA_HORIZONTAL_TABLE.length) {
        this.truckTask = 'none';
        return {
          cameraX: 0,
          cameraY: 0,
          boxOffsets: TruckSequence.RESTING_BOX_OFFSETS,
        };
      }

      const cameraX = TRUCK_CAMERA_HORIZONTAL_TABLE[this.truck2MoveStep];
      const cameraY = 0;
      const boxOffsets = TruckSequence.getRestingOffsetsWithCameraX(cameraX);
      return { cameraX, cameraY, boxOffsets };
    }

    return {
      cameraX: 0,
      cameraY: 0,
      boxOffsets: TruckSequence.RESTING_BOX_OFFSETS,
    };
  }

  /**
   * Advance by one or more GBA logic frames.
   */
  update(frames: number = 1): TruckSequenceOutput {
    if (this._complete) {
      return {
        cameraOffsetX: 0,
        cameraOffsetY: 0,
        playerLocked: false,
        complete: true,
        boxOffsets: TruckSequence.RESTING_BOX_OFFSETS,
      };
    }

    const frameSteps = Math.max(1, Math.floor(frames));
    let latestOutput = this.output;
    for (let i = 0; i < frameSteps; i++) {
      this.stepMainTask();

      if (this._complete) {
        latestOutput = {
          cameraOffsetX: 0,
          cameraOffsetY: 0,
          playerLocked: false,
          complete: true,
          boxOffsets: TruckSequence.RESTING_BOX_OFFSETS,
        };
        break;
      }

      const { cameraX, cameraY, boxOffsets } = this.stepTruckTask();
      const frameOutput: TruckSequenceOutput = {
        cameraOffsetX: cameraX,
        cameraOffsetY: cameraY,
        playerLocked: true,
        complete: false,
        boxOffsets,
      };
      latestOutput = frameOutput;
    }

    this.output = latestOutput;
    return this.output;
  }

  isComplete(): boolean {
    return this._complete;
  }

  reset(): void {
    this.mainState = 0;
    this.mainTimer = 0;
    this.truckTask = 'none';
    this.truck1Timer = 0;
    this.truck2TimerHorizontal = 0;
    this.truck2MoveStep = 0;
    this.truck2TimerVertical = 0;
    this._complete = false;
    this.output = {
      cameraOffsetX: 0,
      cameraOffsetY: 0,
      playerLocked: true,
      complete: false,
      boxOffsets: TruckSequence.RESTING_BOX_OFFSETS,
    };
  }
}

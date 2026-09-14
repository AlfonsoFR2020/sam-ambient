const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export interface OrientationSnapshot {
  readonly matrix: Float32Array;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly dragging: boolean;
}

/** Allocation-free pointer orientation with bounded, frame-rate-independent inertia. */
export class OrbInteraction {
  private readonly quaternion = new Float32Array([0, 0, 0, 1]);
  private readonly matrixValue = new Float32Array(9);
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastMs = 0;
  private velocityX = 0;
  private velocityY = 0;

  constructor(
    private readonly sensitivity = 0.006,
    private readonly maximumVelocity = 4,
    private readonly damping = 4.5,
  ) {
    this.writeMatrix();
  }

  begin(x: number, y: number, nowMs: number): void {
    this.dragging = true;
    this.lastX = x;
    this.lastY = y;
    this.lastMs = nowMs;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  move(x: number, y: number, nowMs: number): boolean {
    if (!this.dragging) return false;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dt = clamp((nowMs - this.lastMs) / 1000, 1 / 240, 0.1);
    const yaw = dx * this.sensitivity;
    const pitch = dy * this.sensitivity;
    this.rotate(pitch, yaw);
    this.velocityX = clamp(pitch / dt, -this.maximumVelocity, this.maximumVelocity);
    this.velocityY = clamp(yaw / dt, -this.maximumVelocity, this.maximumVelocity);
    this.lastX = x;
    this.lastY = y;
    this.lastMs = nowMs;
    return dx !== 0 || dy !== 0;
  }

  end(reducedMotion = false): void {
    this.dragging = false;
    if (reducedMotion) this.stop();
  }

  cancel(): void {
    this.dragging = false;
    this.stop();
  }

  step(deltaSeconds: number, reducedMotion = false): boolean {
    if (this.dragging) return false;
    if (reducedMotion) {
      this.stop();
      return false;
    }
    const dt = clamp(deltaSeconds, 0, 0.05);
    if (dt === 0 || Math.hypot(this.velocityX, this.velocityY) < 0.002) {
      this.stop();
      return false;
    }
    this.rotate(this.velocityX * dt, this.velocityY * dt);
    const decay = Math.exp(-this.damping * dt);
    this.velocityX *= decay;
    this.velocityY *= decay;
    return true;
  }

  snapshot(): OrientationSnapshot {
    return {
      matrix: this.matrixValue,
      velocityX: this.velocityX,
      velocityY: this.velocityY,
      dragging: this.dragging,
    };
  }

  orientationMatrix(): Float32Array {
    return this.matrixValue;
  }

  private stop(): void {
    this.velocityX = 0;
    this.velocityY = 0;
  }

  private rotate(pitch: number, yaw: number): void {
    this.multiplyAxisAngle(1, 0, 0, pitch);
    this.multiplyAxisAngle(0, 1, 0, yaw);
    this.writeMatrix();
  }

  private multiplyAxisAngle(ax: number, ay: number, az: number, angle: number): void {
    const half = angle * 0.5;
    const sine = Math.sin(half);
    const bx = ax * sine;
    const by = ay * sine;
    const bz = az * sine;
    const bw = Math.cos(half);
    const [x, y, z, w] = this.quaternion;
    this.quaternion[0] = bw * x + bx * w + by * z - bz * y;
    this.quaternion[1] = bw * y - bx * z + by * w + bz * x;
    this.quaternion[2] = bw * z + bx * y - by * x + bz * w;
    this.quaternion[3] = bw * w - bx * x - by * y - bz * z;
    const inverse = 1 / Math.hypot(...this.quaternion);
    for (let index = 0; index < 4; index++) this.quaternion[index] *= inverse;
  }

  private writeMatrix(): void {
    const [x, y, z, w] = this.quaternion;
    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;
    this.matrixValue.set([
      1 - y * y2 - z * z2,
      x * y2 + w * z2,
      x * z2 - w * y2,
      x * y2 - w * z2,
      1 - x * x2 - z * z2,
      y * z2 + w * x2,
      x * z2 + w * y2,
      y * z2 - w * x2,
      1 - x * x2 - y * y2,
    ]);
  }
}

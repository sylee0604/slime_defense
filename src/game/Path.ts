export class Path {
  readonly pts: [number, number][];
  readonly cum: number[] = [0];
  readonly length: number;

  constructor(points: [number, number][]) {
    this.pts = points;
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1];
      const [bx, bz] = points[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(bx - ax, bz - az));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  /** 경로 위 dist 지점의 좌표와 진행 방향(라디안) */
  sample(dist: number, out: { x: number; z: number; angle: number }): void {
    const d = Math.max(0, Math.min(this.length, dist));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    const [ax, az] = this.pts[i - 1];
    const [bx, bz] = this.pts[i];
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const t = (d - this.cum[i - 1]) / seg;
    out.x = ax + (bx - ax) * t;
    out.z = az + (bz - az) * t;
    out.angle = Math.atan2(bx - ax, bz - az);
  }

  distanceTo(x: number, z: number): number {
    let best = Infinity;
    for (let i = 1; i < this.pts.length; i++) {
      const [ax, az] = this.pts[i - 1];
      const [bx, bz] = this.pts[i];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t - x;
      const pz = az + dz * t - z;
      best = Math.min(best, Math.hypot(px, pz));
    }
    return best;
  }
}

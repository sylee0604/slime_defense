import * as THREE from 'three';

const MAX_PARTICLES = 900;

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grav: number; r: number; g: number; b: number }
interface Ring { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; max: number; from: number; to: number }
interface Bolt { line: THREE.Line; mat: THREE.LineBasicMaterial; life: number; max: number }

export class Effects {
  readonly group = new THREE.Group();
  private readonly inst: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  private readonly rings: Ring[] = [];
  private readonly bolts: Bolt[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  shake = 0;

  constructor() {
    this.inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.4 }), MAX_PARTICLES);
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inst.count = 0;
    this.inst.frustumCulled = false;
    this.group.add(this.inst);
    const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(ringGeo, m);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, mat: m, life: 0, max: 1, from: 0, to: 1 });
    }
    for (let i = 0; i < 40; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
      const m = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
      const line = new THREE.Line(g, m);
      line.visible = false;
      line.frustumCulled = false;
      this.group.add(line);
      this.bolts.push({ line, mat: m, life: 0, max: 1 });
    }
  }

  burst(x: number, y: number, z: number, color: number, count: number, speed = 4, size = 0.09, grav = 14): void {
    this.color.setHex(color);
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y, z,
        vx: Math.cos(a) * sp, vy: 2 + up * speed, vz: Math.sin(a) * sp,
        life: 0, max: 0.35 + Math.random() * 0.35, size: size * (0.6 + Math.random() * 0.8), grav,
        r: this.color.r, g: this.color.g, b: this.color.b,
      });
    }
  }

  flame(x: number, z: number, dx: number, dz: number): void {
    for (let i = 0; i < 3 && this.particles.length < MAX_PARTICLES; i++) {
      const c = Math.random() < 0.5 ? 0xff7a1a : 0xffd23a;
      this.color.setHex(c);
      this.particles.push({
        x, y: 1.0, z,
        vx: dx * (6 + Math.random() * 3) + (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, vz: dz * (6 + Math.random() * 3) + (Math.random() - 0.5) * 2,
        life: 0, max: 0.35, size: 0.16, grav: -2, r: this.color.r, g: this.color.g, b: this.color.b,
      });
    }
  }

  ring(x: number, z: number, color: number, from: number, to: number, dur = 0.4, y = 0.15): void {
    const r = this.rings.find((q) => !q.mesh.visible);
    if (!r) return;
    r.mesh.visible = true;
    r.mesh.position.set(x, y, z);
    r.mat.color.setHex(color);
    r.life = 0;
    r.max = dur;
    r.from = from;
    r.to = to;
  }

  bolt(points: THREE.Vector3[], color: number, dur = 0.14, jitter = 0.25): void {
    const b = this.bolts.find((q) => !q.line.visible);
    if (!b || points.length < 2) return;
    const attr = b.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = Math.min(points.length, 12);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const j = i === 0 || i === n - 1 ? 0 : jitter;
      attr.setXYZ(i, p.x + (Math.random() - 0.5) * j, p.y + (Math.random() - 0.5) * j, p.z + (Math.random() - 0.5) * j);
    }
    attr.needsUpdate = true;
    b.line.geometry.setDrawRange(0, n);
    b.mat.color.setHex(color);
    b.line.visible = true;
    b.life = 0;
    b.max = dur;
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
    }
    for (const p of this.particles) {
      const k = 1 - p.life / p.max;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(p.size * (0.3 + 0.7 * k));
      this.dummy.updateMatrix();
      this.inst.setMatrixAt(n, this.dummy.matrix);
      this.color.setRGB(p.r, p.g, p.b);
      this.inst.setColorAt(n, this.color);
      n++;
    }
    this.inst.count = n;
    this.inst.instanceMatrix.needsUpdate = true;
    if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;

    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.life += dt;
      const t = r.life / r.max;
      if (t >= 1) { r.mesh.visible = false; continue; }
      const e = 1 - (1 - t) * (1 - t);
      r.mesh.scale.setScalar(r.from + (r.to - r.from) * e);
      r.mat.opacity = 0.85 * (1 - t);
    }
    for (const b of this.bolts) {
      if (!b.line.visible) continue;
      b.life += dt;
      if (b.life >= b.max) { b.line.visible = false; continue; }
      b.mat.opacity = 1 - b.life / b.max;
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  clear(): void {
    this.particles.length = 0;
    this.inst.count = 0;
    for (const r of this.rings) r.mesh.visible = false;
    for (const b of this.bolts) b.line.visible = false;
    this.shake = 0;
  }
}

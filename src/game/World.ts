import * as THREE from 'three';
import type { MapDef, Theme } from './data/maps';
import { FIELD, PATH_HALF_WIDTH } from './data/maps';
import { Path } from './Path';
import { mat } from './models';
import { createSeededRandom } from '../utils/random';

export interface Blocker { x: number; z: number; r: number }

interface Palette {
  bg: number; ground: number; ground2: number; side: number; path: number; pathEdge: number; water: number;
}

const PALETTES: Record<Theme, Palette> = {
  meadow: { bg: 0x9fd3e8, ground: 0x6fbf4a, ground2: 0x5aa83c, side: 0x7a5636, path: 0xe2c48a, pathEdge: 0xb8955d, water: 0x3f9fd8 },
  desert: { bg: 0x9cc9dc, ground: 0xe3b778, ground2: 0xd3a265, side: 0xa4673b, path: 0xc98b55, pathEdge: 0x9e6638, water: 0x2fb5c9 },
  snow: { bg: 0x7e98b6, ground: 0xeef4fb, ground2: 0xdbe6f2, side: 0x6f7f95, path: 0x9aa8b8, pathEdge: 0x7d8a9b, water: 0xa9dcf5 },
  volcano: { bg: 0x3a2a2e, ground: 0x4a3c3a, ground2: 0x3a2f2e, side: 0x2a2122, path: 0x8a6a52, pathEdge: 0x5e4637, water: 0xe8400a },
  swamp: { bg: 0x5d7a6a, ground: 0x5d7a3e, ground2: 0x4c6a34, side: 0x3e3324, path: 0x8a7a52, pathEdge: 0x645638, water: 0x3e5a3a },
  ruins: { bg: 0x6fa3a0, ground: 0x4e9a48, ground2: 0x3f8a3e, side: 0x5a4a38, path: 0xb8ae96, pathEdge: 0x8a8070, water: 0x8a8475 },
  crystal: { bg: 0x1e1830, ground: 0x3c3350, ground2: 0x332b46, side: 0x221c30, path: 0x7a6f92, pathEdge: 0x584e70, water: 0xc77dff },
  castle: { bg: 0x241c26, ground: 0x3f3f46, ground2: 0x35353c, side: 0x232328, path: 0x6e6470, pathEdge: 0x4c4450, water: 0x7a1020 },
};

export class World {
  readonly group = new THREE.Group();
  readonly blockers: Blocker[] = [];
  readonly paths: Path[];
  readonly palette: Palette;

  constructor(readonly map: MapDef) {
    this.paths = map.paths.map((p) => new Path(p));
    this.palette = PALETTES[map.theme];
    this.build();
  }

  private build(): void {
    const p = this.palette;
    const w = FIELD.maxX - FIELD.minX + 1.2;
    const d = FIELD.maxZ - FIELD.minZ + 1.2;
    // 디오라마 받침
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), [
      mat(p.side, { rough: 1 }), mat(p.side, { rough: 1 }), mat(p.ground, { rough: 0.95 }),
      mat(p.side, { rough: 1 }), mat(p.side, { rough: 1 }), mat(p.side, { rough: 1 }),
    ]);
    slab.position.y = -1;
    slab.receiveShadow = true;
    this.group.add(slab);

    const rand = createSeededRandom(this.map.seed);
    // 바닥 얼룩
    const patchGeo = new THREE.CircleGeometry(1, 20);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(patchGeo, mat(p.ground2, { rough: 1 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(THREE.MathUtils.lerp(FIELD.minX, FIELD.maxX, rand()), 0.005, THREE.MathUtils.lerp(FIELD.minZ, FIELD.maxZ, rand()));
      m.scale.set(1 + rand() * 2.5, 0.6 + rand() * 1.6, 1);
      m.receiveShadow = true;
      this.group.add(m);
    }

    this.buildPath();

    for (const pond of this.map.ponds) {
      this.buildObstacle(pond.x, pond.z, pond.r, rand);
      this.blockers.push({ x: pond.x, z: pond.z, r: pond.r + 0.2 });
    }

    this.scatterProps(rand);
    this.buildGates();
  }

  distanceToPath(x: number, z: number): number {
    let d = Infinity;
    for (const p of this.paths) d = Math.min(d, p.distanceTo(x, z));
    return d;
  }

  private buildObstacle(x: number, z: number, r: number, rand: () => number): void {
    const p = this.palette;
    const theme = this.map.theme;
    const add = (o: THREE.Mesh, shadow = true) => {
      o.castShadow = shadow;
      o.receiveShadow = true;
      this.group.add(o);
      return o;
    };
    if (theme === 'ruins') {
      // 무너진 석상 받침과 기둥
      const stone = mat(0x9a9484, { rough: 1, flat: true });
      const base = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.4, 8), stone));
      base.position.set(x, 0.2, z);
      const pillar = add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.4, 2.2, 8), stone));
      pillar.position.set(x + r * 0.25, 1.4, z - r * 0.2);
      const broken = add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, 1.4, 8), stone));
      broken.position.set(x - r * 0.45, 0.6, z + r * 0.35);
      broken.rotation.z = Math.PI / 2 - 0.2;
      broken.rotation.y = rand() * 3;
      const moss = add(new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.3, 0), mat(0x3f8a3e, { flat: true })), false);
      moss.position.set(x + r * 0.25, 2.55, z - r * 0.2);
      return;
    }
    if (theme === 'crystal') {
      const rock = add(new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.8, 0), mat(0x2b2440, { flat: true, rough: 1 })));
      rock.position.set(x, 0.1, z);
      rock.scale.y = 0.35;
      const cm = mat(p.water, { emissive: 0x7a2fd0, rough: 0.15, flat: true });
      for (let i = 0; i < 6; i++) {
        const h = 1 + rand() * 1.8;
        const c = add(new THREE.Mesh(new THREE.ConeGeometry(0.28 + rand() * 0.2, h, 5), cm), true);
        const a = (i / 6) * Math.PI * 2 + rand();
        const d = i === 0 ? 0 : r * 0.45;
        c.position.set(x + Math.cos(a) * d, h / 2, z + Math.sin(a) * d);
        c.rotation.set((rand() - 0.5) * 0.5, rand() * 3, (rand() - 0.5) * 0.5);
      }
      const light = new THREE.PointLight(0xc77dff, 6, r * 4, 2);
      light.position.set(x, 1.6, z);
      this.group.add(light);
      return;
    }
    const glowing = theme === 'volcano' || theme === 'castle';
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.08, 40),
      glowing
        ? new THREE.MeshStandardMaterial({ color: p.water, emissive: p.water, emissiveIntensity: theme === 'volcano' ? 0.75 : 0.8, roughness: 0.6 })
        : new THREE.MeshStandardMaterial({ color: p.water, roughness: theme === 'snow' ? 0.15 : 0.05, metalness: 0.1, transparent: true, opacity: 0.88 }),
    );
    water.position.set(x, 0.03, z);
    water.receiveShadow = !glowing;
    this.group.add(water);
    const rimColor = theme === 'snow' ? 0xffffff : theme === 'volcano' ? 0x2a1f1e : theme === 'castle' ? 0x55525c : theme === 'swamp' ? 0x4a3f2c : 0x8e8a80;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 6, 40), mat(rimColor, { rough: 0.95, flat: theme === 'volcano' }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.05, z);
    this.group.add(rim);
    if (theme === 'volcano') {
      const light = new THREE.PointLight(0xff6a1a, 8, r * 4.5, 2);
      light.position.set(x, 1.2, z);
      this.group.add(light);
    }
    if (theme === 'swamp') {
      for (let i = 0; i < 3; i++) {
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12, 0.3, Math.PI * 1.8), mat(0x5aa04a));
        pad.rotation.x = -Math.PI / 2;
        const a = rand() * Math.PI * 2;
        pad.position.set(x + Math.cos(a) * r * 0.55, 0.08, z + Math.sin(a) * r * 0.55);
        this.group.add(pad);
      }
    }
    if (theme === 'castle') {
      const light = new THREE.PointLight(0xff2030, 5, r * 4, 2);
      light.position.set(x, 1.2, z);
      this.group.add(light);
    }
  }

  private buildPath(): void {
    for (const pts of this.map.paths) this.buildPathRibbon(pts);
    // 돌멩이 디테일
    const p = this.palette;
    const rand = createSeededRandom(this.map.seed + 99);
    const pebbleGeo = new THREE.DodecahedronGeometry(0.09, 0);
    const pebbleMat = mat(p.pathEdge, { rough: 1, flat: true });
    const pos = { x: 0, z: 0, angle: 0 };
    for (const path of this.paths) {
      for (let i = 0; i < 60; i++) {
        path.sample(rand() * path.length, pos);
        const off = (rand() - 0.5) * PATH_HALF_WIDTH * 1.8;
        const m = new THREE.Mesh(pebbleGeo, pebbleMat);
        m.position.set(pos.x + Math.cos(pos.angle) * off, 0.04, pos.z - Math.sin(pos.angle) * off);
        m.scale.setScalar(0.6 + rand());
        if (Math.abs(m.position.x) < FIELD.maxX && Math.abs(m.position.z) < FIELD.maxZ) this.group.add(m);
      }
    }
  }

  private buildPathRibbon(raw: [number, number][]): void {
    const p = this.palette;
    const pts = raw.map(([x, z]) => [
      THREE.MathUtils.clamp(x, FIELD.minX - 0.6, FIELD.maxX + 0.6),
      THREE.MathUtils.clamp(z, FIELD.minZ - 0.6, FIELD.maxZ + 0.6),
    ]);
    const layers: [number, number, number][] = [
      [PATH_HALF_WIDTH + 0.25, 0.012, p.pathEdge],
      [PATH_HALF_WIDTH, 0.024, p.path],
    ];
    for (const [hw, y, color] of layers) {
      const m = mat(color, { rough: 1 });
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const [bx, bz] = pts[i];
        const len = Math.hypot(bx - ax, bz - az);
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, len), m);
        seg.rotation.x = -Math.PI / 2;
        seg.rotation.z = -Math.atan2(bx - ax, bz - az) + Math.PI;
        seg.rotation.order = 'XYZ';
        seg.position.set((ax + bx) / 2, y, (az + bz) / 2);
        seg.receiveShadow = true;
        // plane 회전: x축으로 눕힌 뒤 z축(로컬)으로 방향 맞춤
        seg.rotation.set(-Math.PI / 2, 0, Math.atan2(bx - ax, bz - az));
        this.group.add(seg);
        if (i < pts.length - 1) {
          const joint = new THREE.Mesh(new THREE.CircleGeometry(hw, 24), m);
          joint.rotation.x = -Math.PI / 2;
          joint.position.set(bx, y + 0.001, bz);
          joint.receiveShadow = true;
          this.group.add(joint);
        }
      }
    }
  }

  private buildGates(): void {
    const edgePoint = (from: [number, number], dir: THREE.Vector2, sign: number) => {
      // 경로 끝점에서 필드 경계 안쪽으로 들어온 지점
      let x = from[0];
      let z = from[1];
      for (let i = 0; i < 80; i++) {
        if (x > FIELD.minX + 0.2 && x < FIELD.maxX - 0.2 && z > FIELD.minZ + 0.2 && z < FIELD.maxZ - 0.2) break;
        x += dir.x * 0.1 * sign;
        z += dir.y * 0.1 * sign;
      }
      return [x, z];
    };
    const done: [number, number][] = [];
    const isNew = (x: number, z: number) => {
      if (done.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < 1)) return false;
      done.push([x, z]);
      return true;
    };
    for (const pts of this.map.paths) {
      const n = pts.length;
      const startDir = new THREE.Vector2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]).normalize();
      const endDir = new THREE.Vector2(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]).normalize();
      const [sx, sz] = edgePoint(pts[0], startDir, 1);
      const [ex, ez] = edgePoint(pts[n - 1], endDir, -1);
      if (isNew(sx, sz)) this.buildCave(sx, sz, Math.atan2(startDir.x, startDir.y));
      if (isNew(ex, ez)) this.buildExit(ex, ez, Math.atan2(endDir.x, endDir.y));
    }
  }

  private buildCave(x: number, z: number, rot: number): void {
    const cave = new THREE.Group();
    const rock = mat(this.map.theme === 'crystal' ? 0x2b2440 : 0x5b5560, { rough: 1, flat: true });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.55, 6, 12, Math.PI), rock);
    arch.castShadow = true;
    cave.add(arch);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20, 0, Math.PI), mat(0x140f1c, { rough: 1 }));
    hole.position.z = -0.05;
    cave.add(hole);
    cave.position.set(x, 0, z);
    cave.rotation.y = rot;
    this.group.add(cave);
    this.blockers.push({ x, z, r: 1.8 });
  }

  private buildExit(x: number, z: number, rot: number): void {
    const gate = new THREE.Group();
    const stoneTheme = this.map.theme === 'castle' || this.map.theme === 'ruins' || this.map.theme === 'crystal';
    const wood = mat(stoneTheme ? 0x6a6470 : 0x7a4f2c, { rough: 0.9, flat: stoneTheme });
    const roof = mat(this.map.theme === 'castle' ? 0x5a1020 : 0xb5432f, { rough: 0.7 });
    for (const side of [-1.5, 1.5]) {
      const post = new THREE.Mesh(stoneTheme ? new THREE.CylinderGeometry(0.45, 0.5, 2.8, 8) : new THREE.BoxGeometry(0.4, 2.4, 0.4), wood);
      post.position.set(side, stoneTheme ? 1.4 : 1.2, 0);
      post.castShadow = true;
      gate.add(post);
      if (stoneTheme) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 8), roof);
        cap.position.set(side, 3.2, 0);
        cap.castShadow = true;
        gate.add(cap);
      }
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.35, 0.6), roof);
    beam.position.y = 2.45;
    beam.castShadow = true;
    gate.add(beam);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), mat(0xffd447));
    flag.position.set(0, 1.95, 0);
    gate.add(flag);
    if (this.map.theme === 'castle') {
      gate.scale.setScalar(1.45);
      const keep = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.2, 1.4), wood);
      keep.position.set(0, 1.1, -1.1);
      keep.castShadow = true;
      gate.add(keep);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.1), mat(0x1a0a10));
      door.position.set(0, 0.8, -0.38);
      gate.add(door);
    }
    gate.position.set(x, 0, z);
    gate.rotation.y = rot;
    this.group.add(gate);
    this.blockers.push({ x, z, r: 2 });
  }

  private scatterProps(rand: () => number): void {
    const placed: Blocker[] = [];
    let attempts = 0;
    while (placed.length < this.map.propCount && attempts < 2000) {
      attempts++;
      const x = THREE.MathUtils.lerp(FIELD.minX + 0.8, FIELD.maxX - 0.8, rand());
      const z = THREE.MathUtils.lerp(FIELD.minZ + 0.8, FIELD.maxZ - 0.8, rand());
      // 가장자리 쪽을 선호해서 배치 공간을 너무 잡아먹지 않게
      const edgeBias = Math.max(Math.abs(x) / FIELD.maxX, Math.abs(z) / FIELD.maxZ);
      if (edgeBias < 0.62 && rand() < 0.7) continue;
      if (this.distanceToPath(x, z) < PATH_HALF_WIDTH + 1.3) continue;
      if (this.map.ponds.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 1.2)) continue;
      if (placed.some((b) => Math.hypot(b.x - x, b.z - z) < 2.0)) continue;
      const kind = rand();
      const r = this.makeProp(x, z, kind, rand);
      placed.push({ x, z, r });
    }
    this.blockers.push(...placed);
  }

  private makeProp(x: number, z: number, k: number, rand: () => number): number {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rand() * Math.PI * 2;
    const s = 0.8 + rand() * 0.5;
    g.scale.setScalar(s);
    let radius = 0.8 * s;
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, px: number, py: number, pz: number) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(px, py, pz);
      o.castShadow = true;
      o.receiveShadow = true;
      g.add(o);
      return o;
    };
    const theme = this.map.theme;
    if (theme === 'meadow') {
      if (k < 0.6) {
        add(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 8), mat(0x7a5232), 0, 0.55, 0);
        const shade = [0x3f9a3a, 0x4fae45, 0x36873a][Math.floor(rand() * 3)];
        add(new THREE.IcosahedronGeometry(0.9, 1), mat(shade, { flat: true }), 0, 1.55, 0);
        add(new THREE.IcosahedronGeometry(0.6, 1), mat(shade, { flat: true }), 0.45, 1.25, 0.2);
      } else if (k < 0.82) {
        add(new THREE.IcosahedronGeometry(0.55, 1), mat(0x4a9c3c, { flat: true }), 0, 0.35, 0);
        add(new THREE.SphereGeometry(0.1, 6, 4), mat(0xff6f91), 0.3, 0.65, 0.2);
        add(new THREE.SphereGeometry(0.1, 6, 4), mat(0xffe066), -0.25, 0.6, -0.1);
        radius = 0.6 * s;
      } else {
        add(new THREE.DodecahedronGeometry(0.55, 0), mat(0x8d8f8a, { flat: true, rough: 1 }), 0, 0.3, 0);
        radius = 0.6 * s;
      }
    } else if (theme === 'desert') {
      if (k < 0.5) {
        const cactus = mat(0x4d9a4a, { rough: 0.8 });
        add(new THREE.CapsuleGeometry(0.22, 1.2, 4, 10), cactus, 0, 0.8, 0);
        const arm = add(new THREE.CapsuleGeometry(0.13, 0.4, 4, 8), cactus, 0.32, 0.95, 0);
        arm.rotation.z = 0.2;
        add(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8), cactus, -0.3, 1.15, 0);
        radius = 0.6 * s;
      } else if (k < 0.85) {
        add(new THREE.DodecahedronGeometry(0.7, 0), mat(0xb5683a, { flat: true, rough: 1 }), 0, 0.35, 0);
        add(new THREE.DodecahedronGeometry(0.4, 0), mat(0xc77a45, { flat: true, rough: 1 }), 0.6, 0.2, 0.2);
      } else {
        add(new THREE.CylinderGeometry(0.9, 1.1, 1.4, 7), mat(0xc0703c, { flat: true, rough: 1 }), 0, 0.7, 0);
        add(new THREE.CylinderGeometry(0.95, 0.9, 0.15, 7), mat(0xd88b52, { flat: true }), 0, 1.45, 0);
        radius = 1.1 * s;
      }
    } else if (theme === 'snow') {
      if (k < 0.55) {
        add(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 6), mat(0x5a3d28), 0, 0.25, 0);
        const pine = mat(0x2f6b4f, { flat: true });
        const snow = mat(0xffffff, { flat: true });
        for (let i = 0; i < 3; i++) {
          add(new THREE.ConeGeometry(0.85 - i * 0.22, 0.9, 8), pine, 0, 0.75 + i * 0.5, 0);
          add(new THREE.ConeGeometry(0.42 - i * 0.1, 0.35, 8), snow, 0, 1.08 + i * 0.5, 0);
        }
        radius = 0.8 * s;
      } else if (k < 0.8) {
        add(new THREE.BoxGeometry(1.3, 0.9, 1.1), mat([0xc96b4a, 0x6b8fc9, 0xd8b45a][Math.floor(rand() * 3)]), 0, 0.45, 0);
        const roof = add(new THREE.CylinderGeometry(0.01, 0.95, 0.7, 4), mat(0xffffff, { flat: true }), 0, 1.25, 0);
        roof.rotation.y = Math.PI / 4;
        add(new THREE.BoxGeometry(0.3, 0.5, 0.05), mat(0x4a2f1e), 0, 0.25, 0.56);
        add(new THREE.BoxGeometry(0.26, 0.26, 0.05), mat(0xffe08a, { emissive: 0xffb84a }), 0.38, 0.55, 0.56);
        radius = 1.0 * s;
      } else {
        const snow = mat(0xffffff, { rough: 0.9 });
        add(new THREE.SphereGeometry(0.45, 12, 10), snow, 0, 0.42, 0);
        add(new THREE.SphereGeometry(0.32, 12, 10), snow, 0, 1.0, 0);
        add(new THREE.SphereGeometry(0.22, 12, 10), snow, 0, 1.45, 0);
        add(new THREE.ConeGeometry(0.05, 0.25, 6), mat(0xff8a2a), 0, 1.45, 0.3).rotation.x = Math.PI / 2;
        radius = 0.55 * s;
      }
    } else if (theme === 'volcano') {
      if (k < 0.45) {
        // 화산암 덩어리 + 갈라진 틈의 용암
        add(new THREE.DodecahedronGeometry(0.75, 0), mat(0x2a2224, { flat: true, rough: 1 }), 0, 0.35, 0);
        add(new THREE.DodecahedronGeometry(0.4, 0), mat(0x3a2e2e, { flat: true, rough: 1 }), 0.65, 0.2, 0.2);
        add(new THREE.BoxGeometry(0.08, 0.05, 0.9), mat(0xff6a1a, { emissive: 0xff5a10 }), 0.1, 0.72, 0).rotation.y = 0.5;
      } else if (k < 0.75) {
        // 죽은 나무
        const wood = mat(0x2e2522, { rough: 1 });
        add(new THREE.CylinderGeometry(0.1, 0.18, 1.6, 6), wood, 0, 0.8, 0);
        add(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 5), wood, 0.25, 1.4, 0).rotation.z = -0.8;
        add(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 5), wood, -0.2, 1.2, 0).rotation.z = 0.9;
        radius = 0.5 * s;
      } else {
        // 증기 분출구
        add(new THREE.CylinderGeometry(0.35, 0.7, 0.7, 7), mat(0x3a2e2e, { flat: true, rough: 1 }), 0, 0.35, 0);
        add(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 10), mat(0xffa040, { emissive: 0xff6a1a }), 0, 0.71, 0);
        radius = 0.7 * s;
      }
    } else if (theme === 'swamp') {
      if (k < 0.4) {
        // 축 늘어진 늪 나무
        add(new THREE.CylinderGeometry(0.14, 0.28, 1.4, 7), mat(0x4a3b28), 0, 0.7, 0);
        add(new THREE.IcosahedronGeometry(0.85, 0), mat(0x3e5a2e, { flat: true }), 0, 1.7, 0);
        add(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4), mat(0x6a7a4a), 0.5, 1.2, 0.2);
        add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), mat(0x6a7a4a), -0.45, 1.3, -0.2);
      } else if (k < 0.75) {
        // 버섯 무리
        const caps = [0xd94a3a, 0xe8c06a, 0x9a6ad9];
        for (let i = 0; i < 3; i++) {
          const ox = (i - 1) * 0.35;
          const h = 0.3 + i * 0.12;
          add(new THREE.CylinderGeometry(0.06, 0.08, h, 6), mat(0xf0e6d0), ox, h / 2, (i % 2) * 0.2);
          add(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(caps[i]), ox, h, (i % 2) * 0.2);
        }
        radius = 0.55 * s;
      } else {
        // 갈대
        for (let i = 0; i < 6; i++) {
          const r = add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4), mat(0x8a9a4a), (rand() - 0.5) * 0.6, 0.55, (rand() - 0.5) * 0.6);
          r.rotation.z = (rand() - 0.5) * 0.3;
        }
        radius = 0.5 * s;
      }
    } else if (theme === 'ruins') {
      if (k < 0.5) {
        // 야자수
        const trunk = add(new THREE.CylinderGeometry(0.1, 0.16, 1.8, 6), mat(0x8a6a42), 0, 0.9, 0);
        trunk.rotation.z = 0.15;
        for (let i = 0; i < 5; i++) {
          const leaf = add(new THREE.BoxGeometry(1.1, 0.04, 0.3), mat(0x2f8a3a, { flat: true }), 0, 1.8, 0);
          leaf.rotation.y = (i / 5) * Math.PI * 2;
          leaf.rotation.z = -0.35;
          leaf.translateX(0.45);
        }
        radius = 0.6 * s;
      } else if (k < 0.8) {
        // 부서진 석재 블록
        const stone = mat(0x9a9484, { flat: true, rough: 1 });
        add(new THREE.BoxGeometry(0.9, 0.6, 0.7), stone, 0, 0.3, 0);
        add(new THREE.BoxGeometry(0.6, 0.45, 0.5), stone, 0.5, 0.22, 0.45).rotation.y = 0.6;
        add(new THREE.IcosahedronGeometry(0.25, 0), mat(0x3f8a3e, { flat: true }), -0.2, 0.65, 0);
      } else {
        add(new THREE.IcosahedronGeometry(0.6, 1), mat(0x2f7a32, { flat: true }), 0, 0.4, 0);
        radius = 0.6 * s;
      }
    } else if (theme === 'crystal') {
      if (k < 0.55) {
        const cm = mat([0xc77dff, 0x5ad1ff, 0xff7ad9][Math.floor(rand() * 3)], { emissive: 0x4a2a80, rough: 0.15, flat: true });
        for (let i = 0; i < 3; i++) {
          const h = 0.8 + rand() * 1.2;
          const c = add(new THREE.ConeGeometry(0.2 + rand() * 0.12, h, 5), cm, (i - 1) * 0.3, h / 2, (rand() - 0.5) * 0.3);
          c.rotation.z = (i - 1) * 0.3;
        }
        radius = 0.55 * s;
      } else {
        // 석순
        add(new THREE.ConeGeometry(0.45, 1.6, 7), mat(0x4a4060, { flat: true, rough: 1 }), 0, 0.8, 0);
        add(new THREE.ConeGeometry(0.28, 0.9, 7), mat(0x4a4060, { flat: true, rough: 1 }), 0.45, 0.45, 0.1);
        radius = 0.6 * s;
      }
    } else {
      // castle
      if (k < 0.4) {
        // 작은 망루
        const stone = mat(0x55525c, { flat: true, rough: 1 });
        add(new THREE.CylinderGeometry(0.55, 0.65, 2, 8), stone, 0, 1, 0);
        add(new THREE.ConeGeometry(0.75, 0.9, 8), mat(0x5a1020), 0, 2.45, 0);
        add(new THREE.BoxGeometry(0.2, 0.3, 0.05), mat(0xffb03a, { emissive: 0xff8a1a }), 0, 1.4, 0.62);
        radius = 0.8 * s;
      } else if (k < 0.7) {
        // 횃불
        add(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), mat(0x3a2a22), 0, 0.7, 0);
        add(new THREE.SphereGeometry(0.16, 8, 6), mat(0xffa040, { emissive: 0xff6a1a }), 0, 1.5, 0);
        radius = 0.4 * s;
      } else {
        // 무너진 성벽
        const stone = mat(0x4a4850, { flat: true, rough: 1 });
        add(new THREE.BoxGeometry(1.4, 0.8, 0.5), stone, 0, 0.4, 0);
        add(new THREE.BoxGeometry(0.5, 0.4, 0.5), stone, -0.35, 1.0, 0);
        radius = 0.8 * s;
      }
    }
    this.group.add(g);
    return radius;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}

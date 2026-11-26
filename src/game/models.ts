import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TowerDef } from './data/towers';
import { SLIMES, type SlimeId } from './data/slimes';

const matCache = new Map<string, THREE.Material>();
export function mat(color: number, opts: { rough?: number; metal?: number; emissive?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.rough ?? 0.75}|${opts.metal ?? 0}|${opts.emissive ?? 0}|${opts.flat ?? false}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.75,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0,
      emissiveIntensity: opts.emissive ? 0.9 : 0,
      flatShading: opts.flat ?? false,
    });
    matCache.set(key, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = false;
  return m;
}

const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  lowSphere: new THREE.SphereGeometry(1, 10, 8),
  torso: new THREE.CapsuleGeometry(0.27, 0.32, 6, 12),
  arm: new THREE.CapsuleGeometry(0.085, 0.36, 4, 8),
  leg: new THREE.CapsuleGeometry(0.1, 0.3, 4, 8),
  base: new THREE.CylinderGeometry(0.72, 0.8, 0.12, 28),
  ring: new THREE.TorusGeometry(0.78, 0.05, 6, 36),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.ConeGeometry(1, 1, 16),
};

const SKIN = [0xf2c9a0, 0xd9a273, 0xa8704a, 0x7a4b2e, 0xf6d7b8];

export interface HumanModel {
  root: THREE.Group;
  body: THREE.Group;
  armR: THREE.Group;
  ring: THREE.Mesh;
  pips: THREE.Group;
}

export function buildHuman(def: TowerDef, skinIndex: number): HumanModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = mat(SKIN[skinIndex % SKIN.length], { rough: 0.6 });
  const shirt = mat(def.color, { rough: 0.7 });
  const accent = mat(def.accent, { rough: 0.6 });
  const pants = mat(0x2d3140);
  const dark = mat(0x1b1b22, { rough: 0.4 });

  const base = mesh(G.base, mat(0x6b5f52, { rough: 0.9 }), 0, 0.06, 0);
  base.receiveShadow = true;
  root.add(base);
  const ring = mesh(G.ring, mat(def.color, { emissive: def.color }), 0, 0.13, 0, false);
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  root.add(ring);

  body.add(mesh(G.leg, pants, -0.12, 0.38, 0));
  body.add(mesh(G.leg, pants, 0.12, 0.38, 0));
  const torso = mesh(G.torso, shirt, 0, 0.88, 0);
  body.add(torso);
  const belt = mesh(G.cyl, accent, 0, 0.68, 0);
  belt.scale.set(0.29, 0.06, 0.29);
  body.add(belt);
  const head = mesh(G.sphere, skin, 0, 1.36, 0);
  head.scale.setScalar(0.24);
  body.add(head);
  for (const sx of [-0.08, 0.08]) {
    const eye = mesh(G.lowSphere, dark, sx, 1.39, 0.21, false);
    eye.scale.setScalar(0.035);
    body.add(eye);
  }
  // 왼팔(고정)
  const armL = mesh(G.arm, shirt, -0.36, 0.9, 0);
  armL.rotation.z = -0.2;
  body.add(armL);
  // 오른팔(공격 애니메이션 피벗)
  const armR = new THREE.Group();
  armR.position.set(0.36, 1.08, 0);
  const armMesh = mesh(G.arm, shirt, 0, -0.2, 0);
  armR.add(armMesh);
  const hand = mesh(G.sphere, skin, 0, -0.42, 0);
  hand.scale.setScalar(0.09);
  armR.add(hand);
  body.add(armR);

  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], s: [number, number, number], r?: [number, number, number]) => {
    const o = mesh(geo, m, ...p);
    o.scale.set(...s);
    if (r) o.rotation.set(...r);
    parent.add(o);
    return o;
  };

  switch (def.kind) {
    case 'dart': {
      add(body, G.sphere, shirt, [0, 1.47, 0], [0.25, 0.16, 0.25]);
      add(body, G.cyl, accent, [0, 1.46, 0.2], [0.18, 0.02, 0.14]);
      add(armR, G.cone, mat(0xdddddd, { metal: 0.6, rough: 0.3 }), [0, -0.6, 0.05], [0.04, 0.22, 0.04], [Math.PI, 0, 0]);
      add(armR, G.box, accent, [0, -0.47, 0.05], [0.07, 0.08, 0.02]);
      break;
    }
    case 'tack': {
      add(body, G.sphere, mat(0xf2c230, { rough: 0.4 }), [0, 1.48, 0], [0.27, 0.17, 0.27]);
      add(body, G.cyl, mat(0xf2c230, { rough: 0.4 }), [0, 1.45, 0], [0.31, 0.02, 0.31]);
      const pack = add(body, G.box, accent, [0, 0.95, -0.34], [0.42, 0.46, 0.22]);
      pack.castShadow = true;
      for (let i = 0; i < 5; i++) {
        add(body, G.cone, mat(0xcfd6dc, { metal: 0.8, rough: 0.3 }), [-0.16 + i * 0.08, 1.25, -0.34], [0.025, 0.14, 0.025]);
      }
      add(armR, G.cyl, mat(0x777777, { metal: 0.6 }), [0, -0.5, 0.06], [0.06, 0.18, 0.06], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'bomb': {
      add(body, G.sphere, mat(0x4d5a35), [0, 1.47, 0], [0.28, 0.18, 0.3]);
      add(body, G.box, mat(0x3a4428), [0, 0.92, 0.27], [0.4, 0.3, 0.06]);
      add(armR, G.sphere, dark, [0, -0.52, 0.06], [0.14, 0.14, 0.14]);
      add(armR, G.cyl, mat(0xd9a03a), [0, -0.36, 0.06], [0.02, 0.08, 0.02]);
      break;
    }
    case 'freeze': {
      add(body, G.sphere, mat(0xffffff), [0, 1.48, 0], [0.26, 0.2, 0.26]);
      add(body, G.sphere, mat(0x7cc6ef), [0, 1.7, 0], [0.08, 0.08, 0.08]);
      add(body, G.box, mat(0x223344, { rough: 0.2, metal: 0.4 }), [0, 1.4, 0.18], [0.36, 0.08, 0.08]);
      add(body, G.cyl, mat(0xbfe8ff, { emissive: 0x4fc3ff, rough: 0.2 }), [0, 0.95, -0.33], [0.14, 0.5, 0.14]);
      add(armR, G.cyl, mat(0x9aa6b2, { metal: 0.7, rough: 0.3 }), [0, -0.52, 0.12], [0.05, 0.3, 0.05], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'sniper': {
      add(body, G.cyl, mat(0x5d6b3e), [0, 1.48, 0], [0.34, 0.03, 0.34]);
      add(body, G.sphere, mat(0x5d6b3e), [0, 1.5, 0], [0.24, 0.12, 0.24]);
      add(armR, G.box, dark, [0, -0.45, 0.3], [0.06, 0.07, 0.95]);
      add(armR, G.cyl, mat(0x6b4a2e), [0, -0.45, -0.05], [0.05, 0.25, 0.05], [Math.PI / 2, 0, 0]);
      add(armR, G.cyl, dark, [0, -0.36, 0.3], [0.035, 0.18, 0.035], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'boomerang': {
      add(body, G.cyl, accent, [0, 1.42, 0], [0.25, 0.05, 0.25]);
      add(body, G.sphere, mat(0x3a2418), [0, 1.48, -0.03], [0.24, 0.14, 0.24]);
      const b = add(armR, G.box, mat(0xb07a3e), [0.08, -0.5, 0.05], [0.32, 0.03, 0.08]);
      b.rotation.y = 0.6;
      break;
    }
    case 'mage': {
      add(body, G.cone, shirt, [0, 1.72, 0], [0.3, 0.6, 0.3]);
      add(body, G.cyl, shirt, [0, 1.47, 0], [0.38, 0.03, 0.38]);
      add(body, G.sphere, mat(0xeeeeee), [0, 1.22, 0.16], [0.16, 0.18, 0.1]);
      add(armR, G.cyl, mat(0x6b4a2e), [0, -0.3, 0.05], [0.035, 0.75, 0.035]);
      add(armR, G.sphere, mat(def.accent, { emissive: 0xffb02e, rough: 0.2 }), [0, 0.1, 0.05], [0.09, 0.09, 0.09]);
      break;
    }
    case 'merchant': {
      add(body, G.cyl, mat(0xe8c770), [0, 1.48, 0], [0.4, 0.03, 0.4]);
      add(body, G.cone, mat(0xe8c770), [0, 1.58, 0], [0.24, 0.2, 0.24]);
      add(body, G.box, mat(0xf3ead8), [0, 0.82, 0.22], [0.36, 0.42, 0.05]);
      const stall = add(root, G.box, mat(0x8a5a33), [0, 0.32, 0.62], [0.9, 0.08, 0.38]);
      stall.castShadow = true;
      add(root, G.cyl, mat(0xffd447, { metal: 0.8, rough: 0.25, emissive: 0x4a3000 }), [0.2, 0.42, 0.62], [0.12, 0.1, 0.12]);
      add(root, G.box, mat(0xb07a3e), [-0.22, 0.48, 0.62], [0.26, 0.24, 0.24]);
      add(armR, G.cyl, mat(0xffd447, { metal: 0.8, rough: 0.25 }), [0, -0.48, 0.05], [0.07, 0.02, 0.07]);
      break;
    }
  }

  const pips = new THREE.Group();
  pips.position.set(0, 2.0, 0);
  root.add(pips);

  return { root, body, armR, ring, pips };
}

// ---------- 슬라임 ----------
function stripeTexture(a: number, b: number, rainbow = false): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  if (rainbow) {
    const colors = ['#ff4d4d', '#ff9f2e', '#ffe14d', '#4cd964', '#3da5ff', '#9b5cff'];
    colors.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(0, (i * 64) / colors.length, 64, 64 / colors.length + 1);
    });
  } else {
    g.fillStyle = `#${a.toString(16).padStart(6, '0')}`;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = `#${b.toString(16).padStart(6, '0')}`;
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 16, 64, 7);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const slimeMatCache = new Map<SlimeId, THREE.Material>();
export function slimeMaterial(id: SlimeId): THREE.Material {
  let m = slimeMatCache.get(id);
  if (m) return m;
  const d = SLIMES[id];
  switch (id) {
    case 'steel':
      m = new THREE.MeshStandardMaterial({ color: d.color, metalness: 0.85, roughness: 0.28 });
      break;
    case 'zebra':
      m = new THREE.MeshStandardMaterial({ map: stripeTexture(d.color, d.color2!), roughness: 0.3 });
      break;
    case 'rainbow':
      m = new THREE.MeshStandardMaterial({ map: stripeTexture(0, 0, true), roughness: 0.25 });
      break;
    case 'rock':
      m = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.95, flatShading: true });
      break;
    case 'storm':
      m = new THREE.MeshStandardMaterial({ color: d.color, emissive: 0x1aa8d0, emissiveIntensity: 0.9, roughness: 0.2 });
      break;
    case 'armored':
    case 'knight':
      m = new THREE.MeshStandardMaterial({ color: d.color, metalness: 0.75, roughness: 0.35, flatShading: id === 'armored' });
      break;
    case 'titan':
      m = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.55, flatShading: true });
      break;
    case 'overlord':
      m = new THREE.MeshPhysicalMaterial({ color: d.color, emissive: 0x3a0a2a, emissiveIntensity: 0.8, roughness: 0.3, clearcoat: 1 });
      break;
    default:
      m = new THREE.MeshPhysicalMaterial({ color: d.color, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  }
  slimeMatCache.set(id, m);
  return m;
}

export const SLIME_GEO = {
  body: (() => {
    const g = new THREE.SphereGeometry(1, 22, 16);
    // 아래가 퍼진 슬라임 실루엣
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const spread = y < 0 ? 1 + -y * 0.18 : 1 - y * 0.06;
      p.setX(i, p.getX(i) * spread);
      p.setZ(i, p.getZ(i) * spread);
      if (y < -0.55) p.setY(i, -0.55 + (y + 0.55) * 0.25);
    }
    g.computeVertexNormals();
    return g;
  })(),
  rock: new THREE.DodecahedronGeometry(1, 0),
  eyes: (() => {
    const a = new THREE.SphereGeometry(0.2, 10, 8);
    a.translate(-0.32, 0.22, 0.82);
    const b = new THREE.SphereGeometry(0.2, 10, 8);
    b.translate(0.32, 0.22, 0.82);
    return mergeGeometries([a, b])!;
  })(),
  pupils: (() => {
    const a = new THREE.SphereGeometry(0.1, 8, 6);
    a.translate(-0.32, 0.22, 0.98);
    const b = new THREE.SphereGeometry(0.1, 8, 6);
    b.translate(0.32, 0.22, 0.98);
    return mergeGeometries([a, b])!;
  })(),
  helm: null as unknown as THREE.BufferGeometry,
  plume: null as unknown as THREE.BufferGeometry,
  horns: null as unknown as THREE.BufferGeometry,
  band: null as unknown as THREE.BufferGeometry,
  crown: (() => {
    const parts: THREE.BufferGeometry[] = [];
    const band = new THREE.CylinderGeometry(0.42, 0.46, 0.18, 16, 1, true);
    band.translate(0, 0.92, 0);
    parts.push(band);
    for (let i = 0; i < 5; i++) {
      const cone = new THREE.ConeGeometry(0.1, 0.28, 6);
      const a = (i / 5) * Math.PI * 2;
      cone.translate(Math.sin(a) * 0.42, 1.12, Math.cos(a) * 0.42);
      parts.push(cone.toNonIndexed());
    }
    return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  })(),
};

const HELM_MAT = new THREE.MeshStandardMaterial({ color: 0xc9d0dc, metalness: 0.85, roughness: 0.3 });
Object.assign(SLIME_GEO, {
  helm: (() => {
    const g = new THREE.SphereGeometry(0.98, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.36);
    g.translate(0, 0.08, 0);
    return g;
  })(),
  plume: (() => {
    const g = new THREE.BoxGeometry(0.12, 0.5, 0.8);
    g.translate(0, 1.15, -0.1);
    return g;
  })(),
  horns: (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const c = new THREE.ConeGeometry(0.16, 0.75, 8);
      c.rotateZ(-side * 0.55);
      c.translate(side * 0.55, 0.95, 0.05);
      parts.push(c.toNonIndexed());
    }
    return mergeGeometries(parts)!;
  })(),
  band: (() => {
    const g = new THREE.TorusGeometry(0.92, 0.09, 6, 28);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.05, 0);
    return g;
  })(),
});

export const EYE_WHITE = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
export const EYE_PUPIL = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
export const CROWN_MAT = new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide });

export function buildSlime(id: SlimeId): { root: THREE.Group; body: THREE.Mesh } {
  const d = SLIMES[id];
  const root = new THREE.Group();
  const geo: THREE.BufferGeometry = id === 'rock' ? SLIME_GEO.rock : SLIME_GEO.body;
  const body = new THREE.Mesh(geo, slimeMaterial(id));
  body.castShadow = true;
  body.add(new THREE.Mesh(SLIME_GEO.eyes, EYE_WHITE));
  body.add(new THREE.Mesh(SLIME_GEO.pupils, EYE_PUPIL));
  const gear = d.gear;
  if (gear === 'crown' || gear === 'bigcrown') {
    const crown = new THREE.Mesh(SLIME_GEO.crown, CROWN_MAT);
    crown.castShadow = true;
    if (gear === 'bigcrown') {
      crown.scale.set(1.25, 1.5, 1.25);
      crown.position.y = -0.45;
    }
    body.add(crown);
  } else if (gear === 'helm') {
    const helm = new THREE.Mesh(SLIME_GEO.helm, HELM_MAT);
    helm.castShadow = true;
    body.add(helm);
    const plume = new THREE.Mesh(SLIME_GEO.plume, mat(d.color2 ?? 0xc8323c));
    body.add(plume);
  } else if (gear === 'horns') {
    const horns = new THREE.Mesh(SLIME_GEO.horns, mat(d.color2 ?? 0xe8e0c8, { rough: 0.5 }));
    horns.castShadow = true;
    body.add(horns);
  } else if (gear === 'band') {
    const band = new THREE.Mesh(SLIME_GEO.band, mat(d.color2 ?? 0xd9a63a, { metal: 0.8, rough: 0.3 }));
    body.add(band);
  }
  if (id === 'overlord' || id === 'titan') {
    // 붉게 빛나는 눈동자
    const glow = new THREE.Mesh(SLIME_GEO.pupils, new THREE.MeshBasicMaterial({ color: id === 'overlord' ? 0xff2a2a : 0xffb02a }));
    glow.scale.setScalar(1.02);
    body.add(glow);
  }
  body.scale.setScalar(d.radius);
  body.position.y = d.radius * 0.62;
  root.add(body);
  return { root, body };
}

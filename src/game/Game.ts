import * as THREE from 'three';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { MAPS, FIELD, PATH_HALF_WIDTH, type MapDef } from './data/maps';
import { SLIMES, slimeRBE, type DamageType, type SlimeDef, type SlimeId } from './data/slimes';
import { TOWERS, TOWER_BY_KIND, computeStats, canUpgrade, type TowerDef, type TowerKind, type TowerStats } from './data/towers';
import { WAVES, type SpawnGroup } from './data/waves';
import { World } from './World';
import { Effects } from './Effects';
import { AudioSystem, type Sfx } from './Audio';
import { buildHuman, buildSlime, type HumanModel } from './models';
import { Ui } from '../ui/Ui';

export type GameState = 'menu' | 'playing' | 'won' | 'lost';
export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export const TARGET_LABEL: Record<TargetMode, string> = { first: '맨 앞', last: '맨 뒤', strong: '강한 적', close: '가까운 적' };
const TARGET_ORDER: TargetMode[] = ['first', 'last', 'strong', 'close'];

const SIM_DT = 1 / 60;
const BASIC: SlimeId[] = ['red', 'blue', 'green', 'yellow', 'pink'];
const BASE_SPEED = 2.1;
const TOWER_VIS = 1.3;
const SLIME_VIS = 1.25;

export interface Slime {
  uid: number;
  id: SlimeId;
  def: SlimeDef;
  hp: number;
  maxHp: number;
  dist: number;
  pathIdx: number;
  x: number;
  z: number;
  frozen: number;
  slowT: number;
  slowMul: number;
  slowAfter: number;
  phase: number;
  flash: number;
  alive: boolean;
  root: THREE.Group;
  body: THREE.Mesh;
  ice: THREE.Mesh;
  bar?: { group: THREE.Group; fg: THREE.Mesh };
}

export interface Tower {
  uid: number;
  def: TowerDef;
  levels: [number, number];
  stats: TowerStats;
  x: number;
  z: number;
  model: HumanModel;
  cd: number;
  extraCd: number;
  anim: number;
  facing: number;
  target: TargetMode;
  invested: number;
  pops: number;
}

type ProjKind = 'dart' | 'tack' | 'bomb' | 'boomerang' | 'magic' | 'fireball' | 'frag';
interface Projectile {
  kind: ProjKind;
  obj: THREE.Object3D;
  x: number; y: number; z: number;
  vx: number; vz: number;
  life: number;
  pierce: number;
  damage: number;
  type: DamageType;
  bossMult: number;
  hits: Set<number>;
  radius: number;
  splash: number;
  tower: Tower;
  // 부메랑
  ox: number; oz: number; dirx: number; dirz: number; L: number; W: number; t: number; dur: number;
  travel: number;
}
type ProjOpts = Partial<{ damage: number; pierce: number; splash: number; type: DamageType; speed: number }>;
interface PendingBlast { t: number; x: number; z: number; r: number; dmg: number; max: number; type: DamageType; bossMult: number; tower: Tower }

const tmpSample = { x: 0, z: 0, angle: 0 };
const tmpV = new THREE.Vector3();

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 300);
  readonly audio = new AudioSystem();
  readonly effects = new Effects();
  readonly ui: Ui;
  private readonly loop: Loop;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly sun: THREE.DirectionalLight;
  private readonly camBase = new THREE.Vector3();
  private readonly camTarget = new THREE.Vector3(0, 0, 0.6);

  state: GameState = 'menu';
  paused = false;
  speed = 1;
  autoStart = false;
  map: MapDef = MAPS[0];
  world: World | null = null;
  money = 0;
  lives = 0;
  wave = 0; // 시작한 웨이브 수
  waveActive = false;
  totalPops = 0;
  slimes: Slime[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  private blasts: PendingBlast[] = [];
  leaks: Partial<Record<SlimeId, number>> = {};
  private seen = new Set<SlimeId>();
  private spawners: { g: SpawnGroup; n: number; t: number; lane: number }[] = [];
  private uid = 1;
  private acc = 0;
  private frame = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  fps = 60;
  private slimePool = new Map<SlimeId, { root: THREE.Group; body: THREE.Mesh; ice: THREE.Mesh }[]>();
  private projPool = new Map<ProjKind, THREE.Object3D[]>();

  // 배치/선택
  placing: TowerKind | null = null;
  selected: Tower | null = null;
  private ghost: THREE.Group | null = null;
  private ghostKind: TowerKind | null = null;
  private ghostValid = false;
  private readonly rangeRing: THREE.Mesh;
  private readonly pointer = new THREE.Vector2();
  private pointerGround = new THREE.Vector3(9999, 0, 9999);
  private pointerInside = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x9fd3e8);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x6b5a48, 1.6);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.position.set(-14, 30, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.effects.group);

    this.rangeRing = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    const edge = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
    edge.position.y = 0.001;
    this.rangeRing.add(edge);
    this.rangeRing.position.y = 0.06;
    this.rangeRing.visible = false;
    this.rangeRing.renderOrder = 2;
    this.scene.add(this.rangeRing);

    this.ui = new Ui(this);
    this.loop = new Loop(this.update, this.render);
    this.bindInput();
    this.loadMap(MAPS[0]);
    this.exposeHooks();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.renderer.dispose();
  }

  // ---------------- 게임 흐름 ----------------
  loadMap(map: MapDef): void {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.clearEntities();
    this.map = map;
    this.world = new World(map);
    this.scene.add(this.world.group);
    this.scene.background = new THREE.Color(this.world.palette.bg);
    this.money = map.money;
    this.lives = map.lives;
    this.wave = 0;
    this.waveActive = false;
    this.totalPops = 0;
    this.leaks = {};
    this.seen = new Set();
    this.paused = false;
  }

  startMap(index: number): void {
    this.audio.unlock();
    this.loadMap(MAPS[index]);
    this.state = 'playing';
    this.ui.showScreen(null);
    this.ui.refreshAll();
  }

  restart(): void {
    const idx = MAPS.indexOf(this.map);
    this.startMap(idx);
  }

  toMenu(): void {
    this.loadMap(this.map);
    this.state = 'menu';
    this.ui.showScreen('menu');
  }

  private clearEntities(): void {
    for (const s of this.slimes) this.releaseSlime(s);
    this.slimes = [];
    for (const t of this.towers) this.scene.remove(t.model.root);
    this.towers = [];
    for (const p of this.projectiles) this.releaseProj(p);
    this.projectiles = [];
    this.blasts = [];
    this.spawners = [];
    this.effects.clear();
    this.cancelPlacing();
    this.select(null);
  }

  startWave(): void {
    if (this.state !== 'playing' || this.waveActive || this.wave >= this.map.waves) return;
    this.audio.unlock();
    const groups = WAVES[this.wave];
    this.wave++;
    this.waveActive = true;
    const crowd = this.map.crowd;
    this.spawners = groups.map((g, i) => {
      const scaled = SLIMES[g.id].boss || crowd === 1 ? g : { ...g, count: Math.round(g.count * crowd), spacing: g.spacing / crowd };
      return { g: scaled, n: 0, t: -g.delay, lane: i };
    });
    const boss = groups.some((g) => SLIMES[g.id].boss);
    this.sfx(boss ? 'boss' : 'wave');
    const fresh = groups.map((g) => SLIMES[g.id]).find((d) => !this.seen.has(d.id) && !BASIC.includes(d.id));
    for (const g of groups) this.seen.add(g.id);
    const head = boss ? `웨이브 ${this.wave} · 보스 등장!` : `웨이브 ${this.wave}`;
    this.ui.banner(fresh ? `${head}  —  새로운 적: ${fresh.name} (${fresh.desc})` : head, boss);
    this.ui.refreshAll();
  }

  private endWave(): void {
    this.waveActive = false;
    const bonus = 150 + this.wave * 5;
    let income = 0;
    let heal = 0;
    for (const t of this.towers) {
      if (t.stats.income > 0) {
        income += t.stats.income;
        this.ui.floatText(`+$${t.stats.income}`, t.x, 1.8, t.z, '#ffd447');
      }
      if (t.stats.livesPerWave > 0) {
        heal += t.stats.livesPerWave;
        this.ui.floatText(`+${t.stats.livesPerWave}♥`, t.x, 2.3, t.z, '#ff7a9a');
      }
    }
    this.money += bonus + income;
    this.lives += heal;
    if (income > 0) this.sfx('coin');
    if (this.wave >= this.map.waves) {
      this.state = 'won';
      this.sfx('win');
      this.saveBest(true);
      this.ui.showScreen('won');
      return;
    }
    this.saveBest(false);
    this.ui.banner(`웨이브 ${this.wave} 클리어  +$${bonus + income}`, false);
    this.ui.refreshAll();
    if (this.autoStart) this.startWave();
  }

  private lose(): void {
    if (this.state !== 'playing') return;
    this.lives = 0;
    this.state = 'lost';
    this.sfx('lose');
    this.saveBest(false);
    this.ui.showScreen('lost');
  }

  bestFor(mapId: string): { wave: number; cleared: boolean } {
    try {
      const raw = localStorage.getItem('slime-rush-best');
      const data = raw ? JSON.parse(raw) : {};
      return data[mapId] ?? { wave: 0, cleared: false };
    } catch {
      return { wave: 0, cleared: false };
    }
  }

  private saveBest(cleared: boolean): void {
    try {
      const raw = localStorage.getItem('slime-rush-best');
      const data = raw ? JSON.parse(raw) : {};
      const prev = data[this.map.id] ?? { wave: 0, cleared: false };
      const reached = cleared ? this.map.waves : Math.max(0, this.wave - (this.state === 'lost' ? 1 : 0));
      data[this.map.id] = { wave: Math.max(prev.wave, reached), cleared: prev.cleared || cleared };
      localStorage.setItem('slime-rush-best', JSON.stringify(data));
    } catch {
      /* 저장 불가 환경 */
    }
  }

  setPaused(p: boolean): void {
    if (this.state !== 'playing') return;
    this.paused = p;
    this.ui.showScreen(p ? 'pause' : null);
  }

  cycleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    this.ui.refreshAll();
  }

  sfx(s: Sfx, pitch = 1): void {
    this.audio.play(s, pitch);
  }

  // ---------------- 타워 ----------------
  beginPlacing(kind: TowerKind): void {
    if (this.state !== 'playing') return;
    this.audio.unlock();
    this.select(null);
    this.placing = kind;
    if (this.ghostKind !== kind) {
      if (this.ghost) this.scene.remove(this.ghost);
      const model = buildHuman(TOWER_BY_KIND[kind], 0);
      model.root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = (o.material as THREE.MeshStandardMaterial).clone();
          m.transparent = true;
          m.opacity = 0.65;
          o.material = m;
          o.castShadow = false;
        }
      });
      model.root.scale.setScalar(TOWER_VIS);
      this.ghost = model.root;
      this.ghostKind = kind;
      this.scene.add(this.ghost);
    }
    this.ghost!.visible = false;
    this.ui.refreshAll();
  }

  cancelPlacing(): void {
    this.placing = null;
    if (this.ghost) this.ghost.visible = false;
    this.rangeRing.visible = false;
    this.ui?.refreshAll();
  }

  canPlaceAt(kind: TowerKind, x: number, z: number): boolean {
    if (!this.world) return false;
    if (x < FIELD.minX + 0.7 || x > FIELD.maxX - 0.7 || z < FIELD.minZ + 0.7 || z > FIELD.maxZ - 0.7) return false;
    if (this.world.distanceToPath(x, z) < PATH_HALF_WIDTH + 0.6) return false;
    for (const b of this.world.blockers) if (Math.hypot(b.x - x, b.z - z) < b.r + 0.55) return false;
    for (const t of this.towers) if (Math.hypot(t.x - x, t.z - z) < 1.45) return false;
    return this.money >= TOWER_BY_KIND[kind].cost;
  }

  placeTower(kind: TowerKind, x: number, z: number): Tower | null {
    const def = TOWER_BY_KIND[kind];
    if (!this.canPlaceAt(kind, x, z)) return null;
    this.money -= def.cost;
    const model = buildHuman(def, this.uid);
    model.root.position.set(x, 0, z);
    model.root.scale.setScalar(TOWER_VIS);
    this.scene.add(model.root);
    const t: Tower = {
      uid: this.uid++, def, levels: [0, 0], stats: computeStats(def, [0, 0]), x, z, model,
      cd: 0.2, extraCd: 2.5, anim: 0, facing: Math.PI, target: 'first', invested: def.cost, pops: 0,
    };
    model.root.rotation.y = t.facing;
    this.towers.push(t);
    this.effects.ring(x, z, 0xffffff, 0.3, 1.3, 0.35);
    this.effects.burst(x, 0.3, z, 0xd8c8a8, 10, 2.5, 0.08);
    this.sfx('place');
    this.ui.refreshAll();
    return t;
  }

  select(t: Tower | null): void {
    this.selected = t;
    this.ui?.refreshAll();
  }

  upgrade(t: Tower, path: 0 | 1): boolean {
    if (!canUpgrade(t.levels, path)) return false;
    const up = t.def.paths[path][t.levels[path]];
    if (this.money < up.cost) return false;
    this.money -= up.cost;
    t.invested += up.cost;
    t.levels[path]++;
    t.stats = computeStats(t.def, t.levels);
    this.refreshTowerLook(t);
    this.effects.ring(t.x, t.z, 0xffd447, 0.3, 1.6, 0.45);
    this.effects.burst(t.x, 1.4, t.z, 0xffd447, 18, 3.5, 0.07);
    this.sfx('upgrade');
    this.ui.refreshAll();
    return true;
  }

  sellValue(t: Tower): number {
    return Math.floor(t.invested * 0.7);
  }

  sell(t: Tower): void {
    this.money += this.sellValue(t);
    this.scene.remove(t.model.root);
    this.towers = this.towers.filter((q) => q !== t);
    this.effects.burst(t.x, 0.8, t.z, 0xffd447, 14, 3, 0.07);
    this.sfx('coin');
    this.select(null);
  }

  cycleTarget(t: Tower): void {
    t.target = TARGET_ORDER[(TARGET_ORDER.indexOf(t.target) + 1) % TARGET_ORDER.length];
    this.ui.refreshAll();
  }

  private refreshTowerLook(t: Tower): void {
    const { ring, pips, body } = t.model;
    const total = t.levels[0] + t.levels[1];
    ring.visible = total >= 2;
    const top = Math.max(t.levels[0], t.levels[1]);
    if (top >= 3) {
      ring.material = new THREE.MeshStandardMaterial({ color: 0xffd447, emissive: 0xffb300, emissiveIntensity: 1.2 });
      ring.scale.setScalar(1.08);
    }
    body.scale.setScalar(1 + total * 0.035);
    pips.clear();
    const geo = new THREE.OctahedronGeometry(0.07, 0);
    let i = 0;
    const n = total;
    for (let p = 0; p < 2; p++) {
      for (let k = 0; k < t.levels[p]; k++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: p === 0 ? 0xff9a3c : 0x4fd1ff }));
        m.position.x = (i - (n - 1) / 2) * 0.17;
        pips.add(m);
        i++;
      }
    }
  }

  // ---------------- 슬라임 ----------------
  private spawnSlime(id: SlimeId, dist: number, pathIdx: number, inheritSlow?: Slime): Slime {
    const def = SLIMES[id];
    const hp = def.hp > 1 ? Math.round(def.hp * this.map.hpMul) : def.hp;
    let pooled = this.slimePool.get(id)?.pop();
    if (!pooled) {
      const b = buildSlime(id);
      const ice = new THREE.Mesh(ICE_GEO, ICE_MAT);
      ice.scale.setScalar(def.radius * SLIME_VIS * 1.25);
      ice.position.y = def.radius * SLIME_VIS * 0.62;
      b.root.add(ice);
      pooled = { ...b, ice };
    }
    pooled.ice.visible = false;
    this.scene.add(pooled.root);
    const s: Slime = {
      uid: this.uid++, id, def, hp, maxHp: hp, dist, pathIdx, x: 0, z: 0, frozen: 0,
      slowT: inheritSlow?.slowT ?? 0, slowMul: inheritSlow?.slowMul ?? 1, slowAfter: 0,
      phase: Math.random() * 6, flash: 0, alive: true, root: pooled.root, body: pooled.body, ice: pooled.ice,
    };
    if (def.boss) {
      const group = new THREE.Group();
      const w = def.radius * SLIME_VIS * 2;
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, 0.22), new THREE.MeshBasicMaterial({ color: 0x1a1a22, depthTest: false }));
      const fgGeo = new THREE.PlaneGeometry(w, 0.14);
      fgGeo.translate(w / 2, 0, 0.001);
      const fg = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: 0xff4d5a, depthTest: false }));
      fg.position.x = -w / 2;
      bg.renderOrder = 10;
      fg.renderOrder = 11;
      group.add(bg, fg);
      group.position.y = def.radius * SLIME_VIS * 2.3;
      s.root.add(group);
      s.bar = { group, fg };
    }
    this.placeSlime(s);
    this.slimes.push(s);
    return s;
  }

  private releaseSlime(s: Slime): void {
    s.alive = false;
    this.scene.remove(s.root);
    if (s.bar) {
      s.root.remove(s.bar.group);
      s.bar = undefined;
    }
    s.body.scale.setScalar(s.def.radius);
    let list = this.slimePool.get(s.id);
    if (!list) this.slimePool.set(s.id, (list = []));
    if (list.length < 120) list.push({ root: s.root, body: s.body, ice: s.ice });
  }

  private placeSlime(s: Slime): void {
    this.world!.paths[s.pathIdx].sample(s.dist, tmpSample);
    s.x = tmpSample.x;
    s.z = tmpSample.z;
    s.root.position.set(s.x, 0, s.z);
    s.root.rotation.y = tmpSample.angle;
  }

  /** 피해 처리. 면역이면 false */
  damage(s: Slime, dmg: number, type: DamageType, bossMult: number, tower: Tower | null, hits?: Set<number>): boolean {
    if (!s.alive) return false;
    if (s.def.immune.includes(type)) {
      this.effects.burst(s.x, s.def.radius, s.z, 0xbfc7d5, 3, 1.5, 0.05);
      return false;
    }
    let amount = dmg * (s.def.boss ? bossMult : 1) - (tower?.stats.armorPierce ? 0 : s.def.armor ?? 0);
    if (amount <= 0) {
      // 갑옷에 튕김
      this.effects.burst(s.x, s.def.radius, s.z, 0xd9a63a, 2, 1.2, 0.05);
      return false;
    }
    while (amount > 0 && s.alive) {
      s.hp -= amount;
      if (s.hp > 0) {
        s.flash = 0.1;
        return true;
      }
      const leftover = -s.hp;
      this.pop(s, tower);
      const kids: Slime[] = [];
      let k = 0;
      for (const c of s.def.children) {
        for (let i = 0; i < c.count; i++) {
          const child = this.spawnSlime(c.id, Math.max(0, s.dist - k * 0.35), s.pathIdx, s);
          hits?.add(child.uid);
          kids.push(child);
          k++;
        }
      }
      if (leftover <= 0 || kids.length === 0) return true;
      // 남은 피해는 자식들에게 이어서 적용
      for (let i = 1; i < kids.length; i++) this.damage(kids[i], leftover, type, 1, tower, hits);
      s = kids[0];
      amount = leftover;
    }
    return true;
  }

  private pop(s: Slime, tower: Tower | null): void {
    this.releaseSlime(s);
    this.money += s.def.bounty;
    this.totalPops++;
    if (tower) tower.pops++;
    const color = s.def.color2 && Math.random() < 0.5 ? s.def.color2 : s.def.color;
    const y = s.def.radius * 0.6;
    if (s.def.boss) {
      this.effects.burst(s.x, y, s.z, s.def.color, 60, 9, 0.22);
      this.effects.burst(s.x, y, s.z, 0xffd447, 30, 7, 0.12);
      this.effects.ring(s.x, s.z, 0xffffff, 0.5, 5, 0.6);
      this.effects.shake = 0.6;
      this.sfx('boom');
    } else {
      this.effects.burst(s.x, y, s.z, color, s.id === 'rock' ? 16 : 9, 3.8, s.id === 'rock' ? 0.12 : 0.085);
      this.sfx('pop', 0.8 + Math.random() * 0.5);
    }
  }

  private leakValue(s: Slime): number {
    let v = Math.max(1, Math.ceil(s.hp));
    for (const c of s.def.children) v += slimeRBE(c.id) * c.count;
    return v;
  }

  // ---------------- 시뮬레이션 ----------------
  private readonly update = (dt: number) => {
    this.frame++;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc > 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    const running = this.state === 'playing' && !this.paused;
    if (running) {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= SIM_DT && steps < 12) {
        this.step(SIM_DT);
        this.acc -= SIM_DT;
        steps++;
      }
      if (steps === 12) this.acc = 0;
    }
    this.animate(dt, running);
    this.updateCamera(dt);
    this.updateGhost();
    this.ui.tick();
  };

  private step(dt: number): void {
    // 스폰
    if (this.waveActive) {
      for (const sp of this.spawners) {
        if (sp.n >= sp.g.count) continue;
        sp.t += dt;
        while (sp.t >= 0 && sp.n < sp.g.count) {
          this.spawnSlime(sp.g.id, 0, (sp.n + sp.lane) % this.world!.paths.length);
          sp.n++;
          sp.t -= sp.g.spacing;
        }
      }
    }

    // 이동
    for (let i = this.slimes.length - 1; i >= 0; i--) {
      const s = this.slimes[i];
      if (!s.alive) continue;
      if (s.frozen > 0) {
        s.frozen -= dt;
        if (s.frozen <= 0 && s.slowAfter > 0) {
          s.slowT = s.slowAfter;
          s.slowMul = 0.5;
        }
        continue;
      }
      let mul = 1;
      if (s.slowT > 0) {
        s.slowT -= dt;
        mul = s.slowMul;
      }
      s.dist += BASE_SPEED * this.map.speedMul * s.def.speed * mul * dt;
      if (s.dist >= this.world!.paths[s.pathIdx].length) {
        const loss = this.leakValue(s);
        this.leaks[s.id] = (this.leaks[s.id] ?? 0) + 1;
        this.lives -= loss;
        this.releaseSlime(s);
        this.sfx('leak');
        this.ui.flashLives();
        if (this.lives <= 0) {
          this.lose();
          return;
        }
        continue;
      }
      this.placeSlime(s);
    }
    this.slimes = this.slimes.filter((s) => s.alive);

    // 타워
    for (const t of this.towers) this.updateTower(t, dt);

    // 투사체
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!this.updateProjectile(p, dt)) {
        this.releaseProj(p);
        this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
        this.projectiles.pop();
      }
    }

    // 지연 폭발
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.explode(b.x, b.z, b.r, b.dmg, b.max, b.type, b.bossMult, b.tower, 0.7);
        this.blasts.splice(i, 1);
      }
    }
    this.slimes = this.slimes.filter((s) => s.alive);

    if (this.waveActive && this.slimes.length === 0 && this.spawners.every((sp) => sp.n >= sp.g.count) && this.blasts.length === 0) {
      this.endWave();
    }
  }

  private findTarget(t: Tower, range: number): Slime | null {
    let best: Slime | null = null;
    let score = -Infinity;
    for (const s of this.slimes) {
      if (!s.alive) continue;
      const dx = s.x - t.x;
      const dz = s.z - t.z;
      const d2 = dx * dx + dz * dz;
      const r = range + s.def.radius;
      if (d2 > r * r) continue;
      let v: number;
      switch (t.target) {
        case 'first': v = s.dist; break;
        case 'last': v = -s.dist; break;
        case 'strong': v = slimeRBE(s.id) * 1000 + s.dist; break;
        case 'close': v = -d2; break;
      }
      if (v > score) {
        score = v;
        best = s;
      }
    }
    return best;
  }

  private slimesInRange(x: number, z: number, r: number, max: number, out: Slime[]): Slime[] {
    out.length = 0;
    for (const s of this.slimes) {
      if (!s.alive) continue;
      const rr = r + s.def.radius * 0.6;
      if ((s.x - x) ** 2 + (s.z - z) ** 2 <= rr * rr) {
        out.push(s);
        if (out.length >= max) break;
      }
    }
    return out;
  }

  private readonly scratch: Slime[] = [];

  private updateTower(t: Tower, dt: number): void {
    const st = t.stats;
    if (t.def.kind === 'merchant') return;
    t.cd -= dt;
    t.extraCd -= dt;

    if (t.def.kind === 'freeze') {
      if (t.cd > 0) return;
      const list = this.slimesInRange(t.x, t.z, st.range, st.pierce, this.scratch).slice();
      const any = list.some((s) => s.frozen <= 0 && (!s.def.immune.includes('ice') || st.freezeDamage > 0 || s.def.boss));
      if (!any) return;
      t.cd = st.cooldown;
      t.anim = 1;
      this.effects.ring(t.x, t.z, 0x9fe4ff, 0.2, st.range, 0.45);
      this.effects.burst(t.x, 0.8, t.z, 0xd8f4ff, 14, 4, 0.07, 2);
      this.sfx('freeze');
      for (const s of list) {
        if (!s.alive) continue;
        if (s.def.boss) {
          if (st.bossSlow > 0) {
            s.slowT = 2.5;
            s.slowMul = Math.min(s.slowMul, 1 - st.bossSlow);
          }
          if (st.freezeDamage > 0) this.damage(s, st.freezeDamage, 'normal', 1, t);
          continue;
        }
        const iceImmune = s.def.immune.includes('ice');
        if (st.freezeDamage > 0) {
          this.damage(s, st.freezeDamage, 'normal', 1, t);
          if (!s.alive) continue;
        }
        if (!iceImmune) {
          s.frozen = st.freezeTime;
          s.slowAfter = st.slowAfter;
        }
      }
      return;
    }

    // 마법사 특수: 화염 방사 / 화염구
    if (t.def.kind === 'mage' && st.flame) {
      const target = this.findTarget(t, st.range * 0.75);
      if (target) {
        this.aim(t, target, dt);
        const dx = Math.sin(t.facing);
        const dz = Math.cos(t.facing);
        if (this.frame % 2 === 0) this.effects.flame(t.x + dx * 0.6, t.z + dz * 0.6, dx, dz);
        if (t.extraCd <= -0.0) {
          // 0.12초마다 원뿔 피해
          t.extraCd = 0.12;
          let n = 0;
          for (const s of this.slimes) {
            if (!s.alive || n >= 6) continue;
            const vx = s.x - t.x;
            const vz = s.z - t.z;
            const d = Math.hypot(vx, vz);
            if (d > st.range * 0.75 + s.def.radius) continue;
            if ((vx * dx + vz * dz) / (d || 1) < 0.82) continue;
            this.damage(s, 1, 'fire', 1, t);
            n++;
          }
        }
      }
    }
    if (t.def.kind === 'mage' && st.fireball && t.extraCd <= 0 && !st.flame) {
      const target = this.findTarget(t, st.range);
      if (target) {
        t.extraCd = 2.5;
        this.launch(t, 'fireball', target, 0, { damage: 1, pierce: 1, splash: 1.6, type: 'fire', speed: 16 });
      }
    }

    if (t.cd > 0) {
      // 조준만 계속
      const target = this.findTarget(t, st.range);
      if (target) this.aim(t, target, dt);
      return;
    }

    if (t.def.kind === 'tack') {
      const target = this.findTarget(t, st.range);
      if (!target) return;
      t.cd = st.cooldown;
      t.anim = 1;
      if (st.fireRing) {
        const list = this.slimesInRange(t.x, t.z, st.range, st.pierce, this.scratch).slice();
        for (const s of list) this.damage(s, 1, 'fire', 1, t);
        this.effects.ring(t.x, t.z, 0xff7a1a, 0.6, st.range, 0.3, 0.5);
        this.effects.ring(t.x, t.z, 0xffd23a, 0.4, st.range * 0.8, 0.25, 0.6);
        this.sfx('boom', 1.5);
        return;
      }
      for (let i = 0; i < st.projectiles; i++) {
        const a = (i / st.projectiles) * Math.PI * 2 + t.facing;
        this.launchDir(t, 'tack', Math.sin(a), Math.cos(a), st.range / st.projSpeed);
      }
      this.sfx('throw', 1.2);
      return;
    }

    const target = this.findTarget(t, st.range);
    if (!target) return;
    this.aim(t, target, 1);
    t.cd = st.cooldown;
    t.anim = 1;

    switch (t.def.kind) {
      case 'dart':
        for (let i = 0; i < st.projectiles; i++) {
          const off = (i - (st.projectiles - 1) / 2) * st.spread;
          this.launch(t, 'dart', target, off);
        }
        this.sfx('throw');
        break;
      case 'boomerang':
        for (let i = 0; i < st.projectiles; i++) this.launchBoomerang(t, target, i % 2 === 0 ? 1 : -1);
        this.sfx('throw', 0.8);
        break;
      case 'bomb':
        this.launch(t, 'bomb', target, 0);
        this.sfx('throw', 0.6);
        break;
      case 'mage':
        this.launch(t, 'magic', target, 0);
        if (st.chain > 0) this.chainLightning(t, target, st.chain);
        this.sfx('zap');
        break;
      case 'sniper': {
        this.damage(target, st.damage, st.dmgType, st.bossMult, t);
        const from = new THREE.Vector3(t.x + Math.sin(t.facing) * 0.7, 1.0, t.z + Math.cos(t.facing) * 0.7);
        this.effects.bolt([from, new THREE.Vector3(target.x, target.def.radius * 0.6, target.z)], 0xfff1b0, 0.08, 0);
        this.effects.burst(from.x, from.y, from.z, 0xffd27a, 4, 2, 0.06, 0);
        this.sfx('shot');
        break;
      }
    }
  }

  private aim(t: Tower, s: Slime, k: number): void {
    const want = Math.atan2(s.x - t.x, s.z - t.z);
    let d = want - t.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    t.facing += d * Math.min(1, k >= 1 ? 1 : k * 14);
  }

  private chainLightning(t: Tower, first: Slime, count: number): void {
    const pts = [new THREE.Vector3(t.x, 1.6, t.z)];
    const hit = new Set<number>();
    let cur: Slime | null = first;
    for (let i = 0; i < count && cur; i++) {
      hit.add(cur.uid);
      pts.push(new THREE.Vector3(cur.x, cur.def.radius * 0.7, cur.z));
      const cx = cur.x;
      const cz = cur.z;
      this.damage(cur, 1, 'magic', 1, t);
      let next: Slime | null = null;
      let bd = 3.5 * 3.5;
      for (const s of this.slimes) {
        if (!s.alive || hit.has(s.uid)) continue;
        const d2 = (s.x - cx) ** 2 + (s.z - cz) ** 2;
        if (d2 < bd) {
          bd = d2;
          next = s;
        }
      }
      cur = next;
    }
    this.effects.bolt(pts, 0xbfe6ff, 0.16, 0.35);
  }

  // ---------------- 투사체 ----------------
  private getProjObj(kind: ProjKind): THREE.Object3D {
    const list = this.projPool.get(kind);
    const o = list?.pop() ?? makeProjMesh(kind);
    o.visible = true;
    this.scene.add(o);
    return o;
  }

  private releaseProj(p: Projectile): void {
    this.scene.remove(p.obj);
    let list = this.projPool.get(p.kind);
    if (!list) this.projPool.set(p.kind, (list = []));
    list.push(p.obj);
  }

  private newProj(t: Tower, kind: ProjKind, dx: number, dz: number, life: number, o: ProjOpts = {}): Projectile {
    const st = t.stats;
    const speed = o.speed ?? st.projSpeed;
    const obj = this.getProjObj(kind);
    const p: Projectile = {
      kind, obj, x: t.x + dx * 0.5, y: 1.1, z: t.z + dz * 0.5, vx: dx * speed, vz: dz * speed, life,
      pierce: o.pierce ?? st.pierce, damage: o.damage ?? st.damage, type: o.type ?? st.dmgType, bossMult: st.bossMult,
      hits: new Set(), radius: kind === 'fireball' ? 0.35 : kind === 'bomb' ? 0.25 : 0.18, splash: o.splash ?? st.splash, tower: t,
      ox: 0, oz: 0, dirx: dx, dirz: dz, L: 0, W: 0, t: 0, dur: 0, travel: 0,
    };
    obj.position.set(p.x, p.y, p.z);
    obj.rotation.set(0, Math.atan2(dx, dz), 0);
    obj.scale.setScalar(kind === 'dart' && st.damage >= 3 ? 1.6 : 1);
    this.projectiles.push(p);
    return p;
  }

  private launch(t: Tower, kind: ProjKind, target: Slime, angleOff: number, o: ProjOpts = {}): void {
    const speed = o.speed ?? t.stats.projSpeed;
    // 간단한 선행 조준
    const dx0 = target.x - t.x;
    const dz0 = target.z - t.z;
    const travel = Math.hypot(dx0, dz0) / speed;
    this.world!.paths[target.pathIdx].sample(target.dist + BASE_SPEED * this.map.speedMul * target.def.speed * (target.frozen > 0 ? 0 : 1) * travel * 0.9, tmpSample);
    let a = Math.atan2(tmpSample.x - t.x, tmpSample.z - t.z) + angleOff;
    if (!Number.isFinite(a)) a = 0;
    const p = this.newProj(t, kind, Math.sin(a), Math.cos(a), kind === 'bomb' || kind === 'fireball' ? 3 : (t.stats.range * 1.5) / speed, o);
    if (kind === 'bomb' || kind === 'fireball') p.travel = Math.hypot(tmpSample.x - t.x, tmpSample.z - t.z);
  }

  private launchDir(t: Tower, kind: ProjKind, dx: number, dz: number, life: number, o: ProjOpts = {}): Projectile {
    return this.newProj(t, kind, dx, dz, life, o);
  }

  private launchBoomerang(t: Tower, target: Slime, side: number): void {
    const a = Math.atan2(target.x - t.x, target.z - t.z);
    const p = this.newProj(t, 'boomerang', Math.sin(a), Math.cos(a), 10);
    p.ox = t.x;
    p.oz = t.z;
    p.L = Math.max(2.5, Math.min(t.stats.range, Math.hypot(target.x - t.x, target.z - t.z) + 1));
    p.W = p.L * 0.55 * side;
    p.dur = (Math.PI * p.L) / t.stats.projSpeed + 0.2;
    p.t = 0;
  }

  /** false를 반환하면 제거 */
  private updateProjectile(p: Projectile, dt: number): boolean {
    p.life -= dt;
    if (p.kind === 'boomerang') {
      p.t += dt / p.dur;
      if (p.t >= 1) return false;
      const f = p.L * Math.sin(Math.PI * p.t);
      const sd = p.W * Math.sin(Math.PI * 2 * p.t) * 0.5 + p.W * 0.5 * Math.sin(Math.PI * p.t);
      p.x = p.ox + p.dirx * f + p.dirz * sd;
      p.z = p.oz + p.dirz * f - p.dirx * sd;
      p.obj.rotation.y += dt * 22;
    } else {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.kind === 'bomb' || p.kind === 'fireball') {
        const speed = Math.hypot(p.vx, p.vz);
        p.travel -= speed * dt;
        p.y = 0.6 + Math.max(0, p.travel) * 0.08;
        p.obj.rotation.x += dt * 10;
        if (p.kind === 'fireball' && this.frame % 3 === 0) this.effects.burst(p.x, p.y, p.z, 0xff9a2a, 1, 0.5, 0.12, -1);
        if (p.travel <= 0) {
          this.detonate(p);
          return false;
        }
      }
    }
    p.obj.position.set(p.x, p.y, p.z);
    if (p.life <= 0) {
      if (p.kind === 'bomb' || p.kind === 'fireball') this.detonate(p);
      return false;
    }
    if (p.x < FIELD.minX - 2 || p.x > FIELD.maxX + 2 || p.z < FIELD.minZ - 2 || p.z > FIELD.maxZ + 2) return false;

    for (const s of this.slimes) {
      if (!s.alive || p.hits.has(s.uid)) continue;
      const r = p.radius + s.def.radius;
      if ((s.x - p.x) ** 2 + (s.z - p.z) ** 2 > r * r) continue;
      if (p.kind === 'bomb' || p.kind === 'fireball') {
        this.detonate(p);
        return false;
      }
      p.hits.add(s.uid);
      if (p.tower.stats.explodeOnHit && p.kind === 'boomerang') {
        this.explode(s.x, s.z, 0.9, 1, 6, 'normal', 1, p.tower, 0.5);
      } else {
        this.damage(s, p.damage, p.type, p.bossMult, p.tower, p.hits);
      }
      p.pierce--;
      if (p.pierce <= 0) return false;
    }
    return true;
  }

  private detonate(p: Projectile): void {
    const st = p.tower.stats;
    if (p.kind === 'fireball') {
      this.explode(p.x, p.z, p.splash, p.damage, 12, 'fire', 1, p.tower, 1, 0xff7a1a);
      return;
    }
    this.explode(p.x, p.z, p.splash, p.damage, p.pierce, p.type, p.bossMult, p.tower, 1);
    if (st.frags > 0) {
      for (let i = 0; i < st.frags; i++) {
        const a = (i / st.frags) * Math.PI * 2;
        const f = this.newProj(p.tower, 'frag', Math.sin(a), Math.cos(a), 0.22, { damage: 1, pierce: 1, type: 'sharp', speed: 14, splash: 0 });
        f.x = p.x;
        f.z = p.z;
        f.y = 0.5;
      }
    }
    if (st.cluster) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.random();
        const r = 1.2 + Math.random() * 0.8;
        this.blasts.push({ t: 0.12 + i * 0.05, x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r, r: p.splash * 0.65, dmg: p.damage, max: 8, type: 'explosive', bossMult: p.bossMult, tower: p.tower });
      }
    }
  }

  private explode(x: number, z: number, r: number, dmg: number, max: number, type: DamageType, bossMult: number, tower: Tower | null, scale: number, color = 0xffa53a): void {
    const list = this.slimesInRange(x, z, r, max, this.scratch).slice();
    for (const s of list) this.damage(s, dmg, type, bossMult, tower);
    this.effects.ring(x, z, color, 0.2, r, 0.3, 0.3);
    this.effects.burst(x, 0.4, z, color, Math.round(14 * scale), 5 * scale, 0.13 * scale, 6);
    this.effects.burst(x, 0.4, z, 0x4a4040, Math.round(6 * scale), 3 * scale, 0.16 * scale, 2);
    this.effects.shake = Math.max(this.effects.shake, 0.08 * scale);
    this.sfx('boom', 1 + Math.random() * 0.3);
  }

  // ---------------- 연출 ----------------
  private animate(dt: number, running: boolean): void {
    const k = running ? dt * this.speed : 0;
    for (const s of this.slimes) {
      if (!s.alive) continue;
      const frozen = s.frozen > 0;
      s.ice.visible = frozen;
      if (!frozen) s.phase += k * (5 + s.def.speed * 3);
      const r = s.def.radius * SLIME_VIS;
      const sq = Math.sin(s.phase);
      const hop = Math.max(0, Math.sin(s.phase)) * r * 0.18;
      const flash = s.flash > 0 ? 1.15 : 1;
      s.flash -= dt;
      s.body.scale.set(r * (1 - sq * 0.08) * flash, r * (1 + sq * 0.12) * flash, r * (1 - sq * 0.08) * flash);
      s.body.position.y = r * 0.62 + hop;
      if (s.bar) {
        s.bar.fg.scale.x = Math.max(0, s.hp / s.maxHp);
        s.bar.group.quaternion.copy(s.root.quaternion).invert().multiply(this.camera.quaternion);
      }
    }
    for (const t of this.towers) {
      t.anim = Math.max(0, t.anim - dt * 4.5);
      const a = t.anim;
      const root = t.model.root;
      let d = t.facing - root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      root.rotation.y += d * Math.min(1, dt * 18);
      if (t.def.kind === 'sniper') {
        t.model.armR.rotation.x = -1.45 + a * 0.35;
      } else if (t.def.kind === 'mage') {
        t.model.armR.rotation.x = -0.4 - Math.sin(a * Math.PI) * 1.2;
      } else if (t.def.kind === 'merchant') {
        t.model.armR.rotation.x = -0.3 + Math.sin(performance.now() / 300 + t.uid) * 0.25;
      } else {
        t.model.armR.rotation.x = a > 0 ? -2.6 * Math.sin(a * Math.PI) + (1 - a) * 0.4 * a : 0;
      }
      t.model.body.position.y = Math.sin(performance.now() / 420 + t.uid) * 0.02 - a * 0.04;
    }
    this.effects.update(running ? dt * this.speed : dt * 0.5);
  }

  private updateCamera(_dt: number): void {
    const resized = resizeRenderer(this.renderer, this.camera, 2);
    if (resized || this.camBase.lengthSq() === 0) this.fitCamera();
    const sh = this.effects.shake;
    this.camera.position.copy(this.camBase);
    if (sh > 0) {
      this.camera.position.x += (Math.random() - 0.5) * sh;
      this.camera.position.y += (Math.random() - 0.5) * sh;
    }
    this.camera.lookAt(this.camTarget);
  }

  private fitCamera(): void {
    const aspect = this.camera.aspect;
    const tilt = THREE.MathUtils.degToRad(60);
    const half = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const depth = 28;
    const width = 43;
    const d = Math.max((depth * Math.sin(tilt)) / (2 * Math.tan(half)), width / (2 * Math.tan(half) * aspect)) * 1.04;
    this.camBase.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d).add(this.camTarget);
  }

  private readonly render = () => {
    this.renderer.render(this.scene, this.camera);
  };

  // ---------------- 입력 ----------------
  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => this.onPointer(e));
    c.addEventListener('pointerleave', () => { this.pointerInside = false; });
    c.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      this.onPointer(e);
      if (e.button === 2) { this.cancelPlacing(); this.select(null); return; }
    });
    c.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
      this.onPointer(e);
      this.click();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private onPointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, tmpV);
    this.pointerInside = !!hit;
    if (hit) this.pointerGround.copy(hit);
  }

  private click(): void {
    if (this.state !== 'playing' || this.paused) return;
    const { x, z } = this.pointerGround;
    if (this.placing) {
      const kind = this.placing;
      if (this.placeTower(kind, x, z)) {
        if (!this.shiftHeld || this.money < TOWER_BY_KIND[kind].cost) this.cancelPlacing();
      } else {
        this.ui.toast(this.money < TOWER_BY_KIND[kind].cost ? '돈이 부족해요' : '여기에는 배치할 수 없어요');
      }
      return;
    }
    // 타워 선택: 모델 레이캐스트 우선
    const roots = this.towers.map((t) => t.model.root);
    const hits = this.raycaster.intersectObjects(roots, true);
    let picked: Tower | null = null;
    if (hits.length) {
      let o: THREE.Object3D | null = hits[0].object;
      while (o && !roots.includes(o as THREE.Group)) o = o.parent;
      picked = this.towers.find((t) => t.model.root === o) ?? null;
    }
    if (!picked) {
      let bd = 1.1;
      for (const t of this.towers) {
        const d = Math.hypot(t.x - x, t.z - z);
        if (d < bd) { bd = d; picked = t; }
      }
    }
    this.select(picked);
    if (picked) this.sfx('click');
  }

  private shiftHeld = false;
  private onKey(e: KeyboardEvent): void {
    this.shiftHeld = e.shiftKey;
    if (this.state !== 'playing') return;
    const k = e.key;
    if (k === 'Escape') {
      if (this.placing || this.selected) { this.cancelPlacing(); this.select(null); }
      else this.setPaused(!this.paused);
      return;
    }
    if (this.paused) return;
    const def = TOWERS.find((t) => t.hotkey === k);
    if (def) { this.beginPlacing(def.kind); return; }
    if (k === ' ') { e.preventDefault(); if (!this.waveActive) this.startWave(); else this.cycleSpeed(); return; }
    if (k === 'f' || k === 'F') { this.cycleSpeed(); return; }
    if (k === 'p' || k === 'P') { this.setPaused(true); return; }
    const t = this.selected;
    if (!t) return;
    if (k === 'z' || k === 'Z' || k === ',') this.upgrade(t, 0);
    else if (k === 'x' || k === 'X' || k === '.') this.upgrade(t, 1);
    else if (k === 'Tab') { e.preventDefault(); this.cycleTarget(t); }
    else if (k === 'Delete' || k === 'Backspace') this.sell(t);
  }

  private updateGhost(): void {
    const ring = this.rangeRing;
    if (this.placing && this.ghost) {
      const { x, z } = this.pointerGround;
      const visible = this.pointerInside && Math.abs(x) < FIELD.maxX + 1 && Math.abs(z) < FIELD.maxZ + 1;
      this.ghost.visible = visible;
      ring.visible = visible;
      if (!visible) return;
      this.ghost.position.set(x, 0, z);
      this.ghostValid = this.canPlaceAt(this.placing, x, z);
      const st = computeStats(TOWER_BY_KIND[this.placing], [0, 0]);
      ring.position.set(x, 0.06, z);
      ring.scale.setScalar(st.range > 50 ? 1.2 : Math.max(st.range, 1.2));
      const col = this.ghostValid ? 0xffffff : 0xff3b3b;
      (ring.material as THREE.MeshBasicMaterial).color.setHex(col);
      ((ring.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(col);
      return;
    }
    const t = this.selected;
    if (t && t.stats.range > 0 && t.stats.range < 50) {
      ring.visible = true;
      ring.position.set(t.x, 0.06, t.z);
      ring.scale.setScalar(t.stats.range);
      (ring.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
      ((ring.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
    } else {
      ring.visible = false;
    }
  }

  worldToScreen(x: number, y: number, z: number): { x: number; y: number } {
    tmpV.set(x, y, z).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + (tmpV.x * 0.5 + 0.5) * rect.width, y: rect.top + (-tmpV.y * 0.5 + 0.5) * rect.height };
  }

  // ---------------- 테스트 훅 ----------------
  private exposeHooks(): void {
    const w = window as unknown as Record<string, unknown>;
    w.__TD__ = {
      startMap: (i: number) => this.startMap(i),
      place: (kind: TowerKind, x: number, z: number) => !!this.placeTower(kind, x, z),
      startWave: () => this.startWave(),
      setSpeed: (s: number) => { this.speed = s; },
      setAuto: (a: boolean) => { this.autoStart = a; },
      addMoney: (m: number) => { this.money += m; },
      upgradeFirst: (path: 0 | 1) => (this.towers[0] ? this.upgrade(this.towers[0], path) : false),
      selectFirst: () => this.select(this.towers[0] ?? null),
      skipTo: (wave: number) => { this.wave = Math.max(0, Math.min(this.map.waves - 1, wave)); },
      worldToScreen: (x: number, z: number) => this.worldToScreen(x, 0, z),
      /** 렌더 없이 시뮬레이션만 빠르게 진행 (밸런스 테스트용) */
      simulate: (sec: number) => {
        const n = Math.floor(sec / SIM_DT);
        for (let i = 0; i < n && this.state === 'playing'; i++) this.step(SIM_DT);
        return this.state;
      },
      canPlace: (kind: TowerKind, x: number, z: number) => this.canPlaceAt(kind, x, z),
      pathPoints: () => this.map.paths,
      towerList: () => this.towers.map((t) => ({ kind: t.def.kind, x: t.x, z: t.z, levels: [...t.levels], pops: t.pops })),
      upgradeAt: (i: number, path: 0 | 1) => (this.towers[i] ? this.upgrade(this.towers[i], path) : false),
    };
    Object.defineProperty(w, '__THREE_GAME_DIAGNOSTICS__', {
      configurable: true,
      get: () => ({
        frame: this.frame,
        state: this.state,
        paused: this.paused,
        map: this.map.id,
        wave: this.wave,
        waveActive: this.waveActive,
        money: this.money,
        lives: this.lives,
        pops: this.totalPops,
        leaks: this.leaks,
        slimes: this.slimes.length,
        towers: this.towers.length,
        projectiles: this.projectiles.length,
        fps: this.fps,
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        textures: this.renderer.info.memory.textures,
        geometries: this.renderer.info.memory.geometries,
      }),
    });
  }
}

const ICE_GEO = new THREE.IcosahedronGeometry(1, 1);
const ICE_MAT = new THREE.MeshStandardMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, flatShading: true, depthWrite: false });

function makeProjMesh(kind: ProjKind): THREE.Object3D {
  const g = new THREE.Group();
  switch (kind) {
    case 'dart':
    case 'frag': {
      const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.05, kind === 'frag' ? 0.22 : 0.42, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.7, roughness: 0.3 }));
      g.add(shaft);
      if (kind === 'dart') {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.1), new THREE.MeshStandardMaterial({ color: 0xff5a4a }));
        fin.position.z = -0.18;
        g.add(fin);
      }
      break;
    }
    case 'tack':
      g.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc8ced6, metalness: 0.8, roughness: 0.25 })));
      break;
    case 'bomb': {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0x1d1d24, roughness: 0.4 })));
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffc24a }));
      spark.position.y = 0.24;
      g.add(spark);
      break;
    }
    case 'boomerang': {
      const m = new THREE.MeshStandardMaterial({ color: 0xc28a46, roughness: 0.6 });
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.12), m);
      a.position.x = 0.18;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.5), m);
      b.position.z = 0.18;
      g.add(a, b);
      break;
    }
    case 'magic': {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd9b8ff })));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9b5cff, transparent: true, opacity: 0.35, depthWrite: false }));
      g.add(halo);
      break;
    }
    case 'fireball': {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd04a })));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.45, depthWrite: false })));
      break;
    }
  }
  g.traverse((o) => { o.castShadow = kind !== 'magic' && kind !== 'fireball'; });
  return g;
}

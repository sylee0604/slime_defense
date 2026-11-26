import type { DamageType } from './slimes';

export type TowerKind = 'dart' | 'tack' | 'bomb' | 'freeze' | 'sniper' | 'boomerang' | 'mage' | 'merchant';

export interface TowerStats {
  range: number;
  cooldown: number;
  pierce: number;
  damage: number;
  dmgType: DamageType;
  projectiles: number;
  spread: number; // 라디안
  projSpeed: number;
  splash: number;
  // 특수 능력
  fireRing: boolean;
  frags: number;
  cluster: boolean;
  freezeTime: number;
  slowAfter: number;
  freezeDamage: number;
  bossSlow: number;
  fireball: boolean;
  flame: boolean;
  chain: number;
  income: number;
  livesPerWave: number;
  bossMult: number;
  explodeOnHit: boolean;
  camo: boolean;
  armorPierce: boolean; // 갑옷 무시
}

export interface Upgrade {
  name: string;
  desc: string;
  cost: number;
  apply: (s: TowerStats) => void;
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  role: string;
  cost: number;
  color: number; // 옷 색
  accent: number;
  stats: Partial<TowerStats>;
  paths: [Upgrade[], Upgrade[]];
  hotkey: string;
}

export const BASE_STATS: TowerStats = {
  range: 6,
  cooldown: 1,
  pierce: 1,
  damage: 1,
  dmgType: 'sharp',
  projectiles: 1,
  spread: 0,
  projSpeed: 26,
  splash: 0,
  fireRing: false,
  frags: 0,
  cluster: false,
  freezeTime: 0,
  slowAfter: 0,
  freezeDamage: 0,
  bossSlow: 0,
  fireball: false,
  flame: false,
  chain: 0,
  income: 0,
  livesPerWave: 0,
  bossMult: 1,
  explodeOnHit: false,
  camo: false,
  armorPierce: false,
};

export const TOWERS: TowerDef[] = [
  {
    kind: 'dart', name: '다트 투수', role: '싸고 믿음직한 기본 유닛', cost: 200, color: 0x3b7dd8, accent: 0xf2c14e, hotkey: '1',
    stats: { range: 6, cooldown: 0.8, pierce: 2, damage: 1, projSpeed: 28 },
    paths: [
      [
        { name: '날카로운 다트', desc: '관통 +1', cost: 140, apply: (s) => { s.pierce += 1; } },
        { name: '강철 다트', desc: '관통 +2, 사거리 +1, 갑옷 무시', cost: 240, apply: (s) => { s.pierce += 2; s.range += 1; s.armorPierce = true; } },
        { name: '투창 명수', desc: '피해 3, 관통 +4, 강철 슬라임도 관통', cost: 650, apply: (s) => { s.damage = 3; s.pierce += 4; s.dmgType = 'normal'; s.projSpeed = 34; } },
      ],
      [
        { name: '빠른 손놀림', desc: '공격 속도 +25%', cost: 110, apply: (s) => { s.cooldown *= 0.8; } },
        { name: '연속 투척', desc: '공격 속도 +40%', cost: 220, apply: (s) => { s.cooldown *= 0.7; } },
        { name: '트리플 다트', desc: '다트를 3개씩 부채꼴로 던짐, 관통 +1', cost: 480, apply: (s) => { s.projectiles = 3; s.spread = 0.2; s.pierce += 1; } },
      ],
    ],
  },
  {
    kind: 'tack', name: '못 발사꾼', role: '사방으로 못을 뿌리는 근거리 유닛', cost: 280, color: 0xe0703a, accent: 0x5a3b2a, hotkey: '2',
    stats: { range: 3.8, cooldown: 1.1, pierce: 1, damage: 1, projectiles: 8, projSpeed: 18 },
    paths: [
      [
        { name: '빠른 장전', desc: '공격 속도 +33%', cost: 150, apply: (s) => { s.cooldown *= 0.75; } },
        { name: '고속 장전', desc: '공격 속도 +40%', cost: 300, apply: (s) => { s.cooldown *= 0.7; } },
        { name: '화염 고리', desc: '범위 안 모든 슬라임에 화염 피해 (강철도 녹임)', cost: 1300, apply: (s) => { s.fireRing = true; s.dmgType = 'fire'; s.cooldown = 0.45; s.pierce = 30; } },
      ],
      [
        { name: '긴 못', desc: '사거리 +1', cost: 100, apply: (s) => { s.range += 1; } },
        { name: '12방향 발사', desc: '못 12개 발사', cost: 260, apply: (s) => { s.projectiles = 12; } },
        { name: '칼날 폭풍', desc: '칼날 16개, 관통 +3, 갑옷 무시', cost: 700, apply: (s) => { s.projectiles = 16; s.pierce += 3; s.projSpeed = 22; s.armorPierce = true; } },
      ],
    ],
  },
  {
    kind: 'bomb', name: '폭탄병', role: '광역 폭발, 강철 슬라임 담당 (그림자에는 무효)', cost: 520, color: 0x4a5a3a, accent: 0x2a2a2a, hotkey: '3',
    stats: { range: 6.2, cooldown: 1.35, pierce: 16, damage: 1, dmgType: 'explosive', splash: 1.5, projSpeed: 16 },
    paths: [
      [
        { name: '큰 폭탄', desc: '폭발 범위 +40%, 최대 22마리', cost: 350, apply: (s) => { s.splash *= 1.4; s.pierce = 22; } },
        { name: '고폭탄', desc: '피해 2, 보스 피해 x2, 갑옷 무시', cost: 700, apply: (s) => { s.damage = 2; s.bossMult = 2; s.armorPierce = true; } },
        { name: '유도 미사일', desc: '피해 4, 사거리 +1.5, 공격 속도 +60%', cost: 1600, apply: (s) => { s.damage = 4; s.range += 1.5; s.cooldown *= 0.62; s.projSpeed = 26; } },
      ],
      [
        { name: '빠른 장전', desc: '공격 속도 +33%', cost: 250, apply: (s) => { s.cooldown *= 0.75; } },
        { name: '파편 폭탄', desc: '폭발 시 파편 8개 (그림자도 맞힘)', cost: 400, apply: (s) => { s.frags = 8; } },
        { name: '집속탄', desc: '폭발 후 작은 폭탄 6개가 연쇄 폭발', cost: 950, apply: (s) => { s.cluster = true; } },
      ],
    ],
  },
  {
    kind: 'freeze', name: '냉동 기술자', role: '주변 슬라임을 얼려 멈춤 (서리에는 무효)', cost: 420, color: 0x9fd6f2, accent: 0x2f6c9a, hotkey: '4',
    stats: { range: 3.0, cooldown: 2.3, pierce: 40, damage: 0, dmgType: 'ice', freezeTime: 1.1 },
    paths: [
      [
        { name: '서리 잔상', desc: '녹은 뒤 2초간 50% 감속', cost: 160, apply: (s) => { s.slowAfter = 2; } },
        { name: '긴 빙결', desc: '빙결 시간 2초', cost: 260, apply: (s) => { s.freezeTime = 2; } },
        { name: '빙결 파쇄', desc: '얼릴 때 피해 1, 강철·갑옷도 깨뜨림', cost: 600, apply: (s) => { s.freezeDamage = 1; s.dmgType = 'normal'; s.armorPierce = true; } },
      ],
      [
        { name: '넓은 냉기', desc: '사거리 +1', cost: 200, apply: (s) => { s.range += 1; } },
        { name: '빙하 감옥', desc: '보스도 40% 감속', cost: 500, apply: (s) => { s.bossSlow = 0.4; } },
        { name: '절대영도', desc: '공격 속도 +65%', cost: 1200, apply: (s) => { s.cooldown *= 0.6; s.range += 0.5; } },
      ],
    ],
  },
  {
    kind: 'sniper', name: '저격수', role: '맵 전체 사거리, 한 발 한 발이 강력', cost: 350, color: 0x55613f, accent: 0x1f2418, hotkey: '5',
    stats: { range: 999, cooldown: 2.0, pierce: 1, damage: 2 },
    paths: [
      [
        { name: '대구경 탄', desc: '피해 4, 갑옷 무시', cost: 350, apply: (s) => { s.damage = 4; s.armorPierce = true; } },
        { name: '철갑탄', desc: '피해 7, 강철 슬라임 관통', cost: 1100, apply: (s) => { s.damage = 7; s.dmgType = 'normal'; } },
        { name: '대물 저격', desc: '피해 18, 보스 피해 x2', cost: 3000, apply: (s) => { s.damage = 18; s.bossMult = 2; } },
      ],
      [
        { name: '빠른 볼트액션', desc: '공격 속도 +40%', cost: 300, apply: (s) => { s.cooldown *= 0.7; } },
        { name: '반자동 소총', desc: '공격 속도 +100%', cost: 900, apply: (s) => { s.cooldown *= 0.5; } },
        { name: '자동 소총', desc: '공격 속도 +170%', cost: 2800, apply: (s) => { s.cooldown *= 0.37; } },
      ],
    ],
  },
  {
    kind: 'boomerang', name: '부메랑 투수', role: '곡선으로 날아가 여러 마리를 베는 유닛', cost: 325, color: 0x8e4fc9, accent: 0xf7e27a, hotkey: '6',
    stats: { range: 5.2, cooldown: 1.25, pierce: 4, damage: 1, projSpeed: 14 },
    paths: [
      [
        { name: '여러 번 베기', desc: '관통 +3', cost: 200, apply: (s) => { s.pierce += 3; } },
        { name: '글레이브', desc: '관통 +5, 피해 2, 갑옷 무시', cost: 340, apply: (s) => { s.pierce += 5; s.damage = 2; s.armorPierce = true; } },
        { name: '회전 칼날', desc: '관통 +8, 공격 속도 +60%', cost: 1100, apply: (s) => { s.pierce += 8; s.cooldown *= 0.62; } },
      ],
      [
        { name: '빠른 손목', desc: '공격 속도 +33%', cost: 175, apply: (s) => { s.cooldown *= 0.75; } },
        { name: '쌍부메랑', desc: '부메랑 2개', cost: 450, apply: (s) => { s.projectiles = 2; s.spread = 0.5; } },
        { name: '폭발 부메랑', desc: '맞을 때마다 작은 폭발 (강철도 깨뜨림)', cost: 950, apply: (s) => { s.explodeOnHit = true; } },
      ],
    ],
  },
  {
    kind: 'mage', name: '마법사', role: '마법탄은 모든 슬라임에 통함', cost: 400, color: 0x5b3fb8, accent: 0xffd166, hotkey: '7',
    stats: { range: 5.8, cooldown: 1.1, pierce: 2, damage: 1, dmgType: 'magic', projSpeed: 20 },
    paths: [
      [
        { name: '강한 마력', desc: '관통 +2, 피해 2, 갑옷 무시', cost: 320, apply: (s) => { s.pierce += 2; s.damage = 2; s.armorPierce = true; } },
        { name: '화염구', desc: '2.5초마다 화염구 폭발 추가', cost: 650, apply: (s) => { s.fireball = true; } },
        { name: '용의 숨결', desc: '쉬지 않는 화염 방사', cost: 2400, apply: (s) => { s.flame = true; } },
      ],
      [
        { name: '먼 시야', desc: '사거리 +1.5', cost: 200, apply: (s) => { s.range += 1.5; } },
        { name: '연쇄 번개', desc: '번개가 6마리를 연달아 타격', cost: 750, apply: (s) => { s.chain = 6; } },
        { name: '대마법사', desc: '공격 속도 +100%, 번개 10연쇄', cost: 2000, apply: (s) => { s.cooldown *= 0.5; s.chain = Math.max(s.chain, 10); } },
      ],
    ],
  },
  {
    kind: 'merchant', name: '상인', role: '웨이브마다 돈을 벌어옴', cost: 550, color: 0xc98f2e, accent: 0x7a4a1a, hotkey: '8',
    stats: { range: 0, cooldown: 999, income: 90 },
    paths: [
      [
        { name: '좋은 거래', desc: '웨이브당 수입 +45', cost: 300, apply: (s) => { s.income += 45; } },
        { name: '시장 개척', desc: '웨이브당 수입 +100', cost: 650, apply: (s) => { s.income += 100; } },
        { name: '은행가', desc: '웨이브당 수입 +260', cost: 1800, apply: (s) => { s.income += 260; } },
      ],
      [
        { name: '구급 상자', desc: '웨이브마다 생명 +1', cost: 250, apply: (s) => { s.livesPerWave += 1; } },
        { name: '진료소', desc: '웨이브마다 생명 +3', cost: 550, apply: (s) => { s.livesPerWave += 2; } },
        { name: '종합 병원', desc: '웨이브마다 생명 +8, 수입 +50', cost: 1400, apply: (s) => { s.livesPerWave += 5; s.income += 50; } },
      ],
    ],
  },
];

export const TOWER_BY_KIND = Object.fromEntries(TOWERS.map((t) => [t.kind, t])) as Record<TowerKind, TowerDef>;

export function computeStats(def: TowerDef, levels: [number, number]): TowerStats {
  const s: TowerStats = { ...BASE_STATS, ...def.stats };
  for (let p = 0; p < 2; p++) {
    for (let i = 0; i < levels[p]; i++) def.paths[p][i].apply(s);
  }
  return s;
}

/** 한 경로만 3단계까지, 다른 경로는 최대 2단계 */
export function canUpgrade(levels: [number, number], path: 0 | 1): boolean {
  const other = levels[path === 0 ? 1 : 0];
  const cur = levels[path];
  if (cur >= 3) return false;
  if (cur + 1 === 3 && other >= 3) return false;
  if (cur + 1 > 2 && other > 2) return false;
  return true;
}

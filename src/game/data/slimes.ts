// 슬라임(적) 정의. 원작의 "껍질" 구조를 슬라임이 쪼개지는 방식으로 재해석했다.
export type DamageType = 'sharp' | 'explosive' | 'ice' | 'magic' | 'normal' | 'fire';

export type SlimeId =
  | 'red' | 'blue' | 'green' | 'yellow' | 'pink'
  | 'black' | 'white' | 'purple' | 'storm' | 'steel' | 'zebra' | 'rainbow'
  | 'armored' | 'rock'
  | 'knight' | 'king' | 'emperor' | 'titan' | 'overlord';

export type SlimeGear = 'helm' | 'crown' | 'bigcrown' | 'horns' | 'band';

export interface SlimeDef {
  id: SlimeId;
  name: string;
  hp: number;
  speed: number; // 기본 속도 배수
  radius: number;
  color: number;
  color2?: number;
  children: { id: SlimeId; count: number }[];
  immune: DamageType[];
  armor?: number; // 한 번 맞을 때 깎이는 피해량
  boss?: boolean;
  gear?: SlimeGear;
  bounty: number; // 터질 때 얻는 돈
  desc: string;
}

export const SLIMES: Record<SlimeId, SlimeDef> = {
  red: { id: 'red', name: '빨강 슬라임', hp: 1, speed: 1.0, radius: 0.42, color: 0xe8413c, children: [], immune: [], bounty: 1, desc: '가장 약한 슬라임' },
  blue: { id: 'blue', name: '파랑 슬라임', hp: 1, speed: 1.4, radius: 0.46, color: 0x3d8bf0, children: [{ id: 'red', count: 1 }], immune: [], bounty: 1, desc: '맞으면 빨강으로' },
  green: { id: 'green', name: '초록 슬라임', hp: 1, speed: 1.8, radius: 0.5, color: 0x4cc94a, children: [{ id: 'blue', count: 1 }], immune: [], bounty: 1, desc: '맞으면 파랑으로' },
  yellow: { id: 'yellow', name: '노랑 슬라임', hp: 1, speed: 2.8, radius: 0.53, color: 0xf6d02f, children: [{ id: 'green', count: 1 }], immune: [], bounty: 1, desc: '빠르다' },
  pink: { id: 'pink', name: '분홍 슬라임', hp: 1, speed: 3.1, radius: 0.55, color: 0xff7ac4, children: [{ id: 'yellow', count: 1 }], immune: [], bounty: 1, desc: '매우 빠르다' },
  black: { id: 'black', name: '그림자 슬라임', hp: 1, speed: 1.8, radius: 0.4, color: 0x26222e, children: [{ id: 'pink', count: 2 }], immune: ['explosive'], bounty: 1, desc: '폭발 면역' },
  white: { id: 'white', name: '서리 슬라임', hp: 1, speed: 2.0, radius: 0.4, color: 0xf2f6ff, children: [{ id: 'pink', count: 2 }], immune: ['ice'], bounty: 1, desc: '냉기 면역' },
  purple: { id: 'purple', name: '보라 슬라임', hp: 1, speed: 2.6, radius: 0.48, color: 0x8e44ff, children: [{ id: 'pink', count: 2 }], immune: ['magic', 'fire'], bounty: 1, desc: '마법·화염 면역' },
  storm: { id: 'storm', name: '번개 슬라임', hp: 1, speed: 4.2, radius: 0.44, color: 0x37e6ff, color2: 0xfff27a, children: [{ id: 'yellow', count: 2 }], immune: ['ice'], bounty: 1, desc: '엄청 빠르고 얼지 않음' },
  steel: { id: 'steel', name: '강철 슬라임', hp: 1, speed: 1.0, radius: 0.5, color: 0x8d97a6, children: [{ id: 'black', count: 2 }], immune: ['sharp'], bounty: 1, desc: '날붙이 면역' },
  zebra: { id: 'zebra', name: '얼룩 슬라임', hp: 1, speed: 1.8, radius: 0.55, color: 0xf2f6ff, color2: 0x26222e, children: [{ id: 'black', count: 1 }, { id: 'white', count: 1 }], immune: ['explosive', 'ice'], bounty: 1, desc: '폭발·냉기 면역' },
  rainbow: { id: 'rainbow', name: '무지개 슬라임', hp: 1, speed: 2.0, radius: 0.6, color: 0xff9f2e, color2: 0x9b5cff, children: [{ id: 'zebra', count: 2 }], immune: [], bounty: 1, desc: '얼룩 2마리로 분열' },
  armored: { id: 'armored', name: '갑옷 슬라임', hp: 4, speed: 1.3, radius: 0.6, color: 0x5b5f6b, color2: 0xd9a63a, children: [{ id: 'black', count: 2 }], immune: [], armor: 1, gear: 'band', bounty: 3, desc: '갑옷 1: 피해 1짜리 공격 무시' },
  rock: { id: 'rock', name: '바위 슬라임', hp: 8, speed: 2.2, radius: 0.66, color: 0xa86b3c, children: [{ id: 'rainbow', count: 2 }], immune: [], bounty: 2, desc: '무지개 2마리로 분열' },
  knight: { id: 'knight', name: '기사 슬라임', hp: 60, speed: 1.2, radius: 0.78, color: 0x9aa3b5, color2: 0xc8323c, children: [{ id: 'rock', count: 2 }], immune: [], boss: true, gear: 'helm', bounty: 25, desc: '중간 보스' },
  king: { id: 'king', name: '킹 슬라임', hp: 200, speed: 0.85, radius: 0.92, color: 0x3aa0ff, color2: 0xffd447, children: [{ id: 'rock', count: 3 }], immune: [], boss: true, gear: 'crown', bounty: 60, desc: '보스' },
  emperor: { id: 'emperor', name: '황제 슬라임', hp: 700, speed: 0.32, radius: 1.08, color: 0xd6303a, color2: 0xffd447, children: [{ id: 'king', count: 3 }], immune: [], boss: true, gear: 'bigcrown', bounty: 150, desc: '상위 보스' },
  titan: { id: 'titan', name: '타이탄 슬라임', hp: 2400, speed: 0.22, radius: 1.22, color: 0x2f8f5a, color2: 0xe8e0c8, children: [{ id: 'emperor', count: 2 }], immune: [], armor: 1, boss: true, gear: 'horns', bounty: 400, desc: '최상위 보스, 갑옷 1' },
  overlord: { id: 'overlord', name: '마왕 슬라임', hp: 6000, speed: 0.16, radius: 1.36, color: 0x2a1638, color2: 0xff3b3b, children: [{ id: 'titan', count: 2 }], immune: [], armor: 2, boss: true, gear: 'horns', bounty: 1000, desc: '최종 보스, 갑옷 2' },
};

const rbeCache = new Map<SlimeId, number>();
/** 해당 슬라임이 완전히 끝까지 새어나갔을 때 잃는 생명 수 */
export function slimeRBE(id: SlimeId): number {
  const cached = rbeCache.get(id);
  if (cached !== undefined) return cached;
  const def = SLIMES[id];
  let total = def.hp;
  for (const c of def.children) total += slimeRBE(c.id) * c.count;
  rbeCache.set(id, total);
  return total;
}

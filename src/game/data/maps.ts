export type Theme = 'meadow' | 'desert' | 'snow' | 'volcano' | 'swamp' | 'ruins' | 'crystal' | 'castle';

export interface MapDef {
  id: string;
  name: string;
  difficulty: string;
  tier: number; // 0 쉬움 ~ 4 지옥
  desc: string;
  theme: Theme;
  lives: number;
  money: number;
  waves: number;
  hpMul: number; // 체력이 여러 칸인 적(바위·갑옷·보스)의 체력 배수
  speedMul: number;
  crowd: number; // 일반 슬라임 수 배수
  paths: [number, number][][]; // XZ 웨이포인트, 여러 갈래 가능
  ponds: { x: number; z: number; r: number }[]; // 배치 불가 장애물(물·용암·유적 등)
  propCount: number;
  seed: number;
}

// 맵 영역: x -20..20, z -12.5..12.5
export const MAPS: MapDef[] = [
  {
    id: 'meadow', name: '초록 들판', difficulty: '쉬움', tier: 0, theme: 'meadow',
    desc: '길고 구불구불한 시골길. 처음 하기 좋은 맵',
    lives: 150, money: 650, waves: 30, hpMul: 1, speedMul: 1, crowd: 1,
    paths: [[[-22, -8], [-12, -8], [-12, 6], [-4, 6], [-4, -9], [5, -9], [5, 8], [13, 8], [13, -4], [22, -4]]],
    ponds: [{ x: 16.5, z: 4, r: 1.8 }],
    propCount: 26, seed: 11,
  },
  {
    id: 'desert', name: '모래 협곡', difficulty: '쉬움', tier: 0, theme: 'desert',
    desc: '오아시스를 끼고 도는 협곡. 배치 공간이 좁다',
    lives: 100, money: 650, waves: 30, hpMul: 1.1, speedMul: 1.05, crowd: 1.15,
    paths: [[[-22, 0], [-13, 0], [-13, -9], [-3, -9], [-3, 8], [7, 8], [7, -6], [14, -6], [14, 14]]],
    ponds: [{ x: 2, z: -1.5, r: 2.4 }, { x: -17, z: 7.5, r: 1.6 }],
    propCount: 30, seed: 27,
  },
  {
    id: 'snow', name: '눈꽃 마을', difficulty: '보통', tier: 1, theme: 'snow',
    desc: '짧은 길, 한가운데 얼어붙은 호수',
    lives: 80, money: 650, waves: 30, hpMul: 1.3, speedMul: 1.1, crowd: 1.3,
    paths: [[[-22, 6], [-8, 6], [-8, -6], [8, -6], [8, 6], [22, 6]]],
    ponds: [{ x: 0, z: 0.5, r: 3.0 }],
    propCount: 30, seed: 53,
  },
  {
    id: 'volcano', name: '용암 화산', difficulty: '어려움', tier: 2, theme: 'volcano',
    desc: '용암 웅덩이가 명당을 막는다. 짧은 길에 적이 많고 빠르다',
    lives: 70, money: 650, waves: 40, hpMul: 1.35, speedMul: 1.15, crowd: 1.3,
    paths: [[[-22, -9], [-8, -9], [-8, 7], [8, 7], [8, -9], [22, -9]]],
    ponds: [{ x: 0, z: -2, r: 2.6 }, { x: 0, z: -10, r: 1.6 }, { x: -15, z: 1, r: 2.1 }, { x: 15, z: 0, r: 2.1 }, { x: -13, z: 10.5, r: 1.6 }],
    propCount: 26, seed: 71,
  },
  {
    id: 'swamp', name: '갈림길 늪', difficulty: '매우 어려움', tier: 3, theme: 'swamp',
    desc: '두 갈래 길이 중간에서 합쳐진다. 양쪽을 모두 지켜야 한다',
    lives: 60, money: 700, waves: 40, hpMul: 1.35, speedMul: 1.12, crowd: 1.25,
    paths: [
      [[-22, -8], [-8, -8], [-8, 1], [6, 1], [6, -7], [22, -7]],
      [[-16, 14], [-16, 6], [0, 6], [0, 1], [6, 1], [6, -7], [22, -7]],
    ],
    ponds: [{ x: 12, z: 4.5, r: 2.3 }, { x: -13.5, z: -2.5, r: 1.8 }, { x: 0, z: -4.5, r: 2.0 }],
    propCount: 30, seed: 89,
  },
  {
    id: 'ruins', name: '정글 유적', difficulty: '매우 어려움', tier: 3, theme: 'ruins',
    desc: '무너진 석상들 사이로 짧게 꺾이는 길. 적이 빠르다',
    lives: 50, money: 700, waves: 40, hpMul: 1.35, speedMul: 1.2, crowd: 1.1,
    paths: [[[-10, -14], [-10, 6], [0, 6], [0, -6], [10, -6], [10, 14]]],
    ponds: [{ x: 5, z: 0, r: 2.0 }, { x: -5, z: 0, r: 2.0 }, { x: -15.5, z: -5, r: 2.0 }, { x: 15.5, z: 5, r: 2.0 }],
    propCount: 30, seed: 97,
  },
  {
    id: 'crystal', name: '수정 동굴', difficulty: '지옥', tier: 4, theme: 'crystal',
    desc: '서로 교차하는 두 길, 각자 다른 출구로 빠져나간다',
    lives: 50, money: 900, waves: 40, hpMul: 1.3, speedMul: 1.12, crowd: 1,
    paths: [
      [[-22, -9], [-4, -9], [-4, 9], [22, 9]],
      [[-22, 4], [9, 4], [9, -9], [22, -9]],
    ],
    ponds: [{ x: 3, z: -3, r: 2.2 }, { x: -13, z: -2.5, r: 2.0 }, { x: 15.5, z: 0, r: 2.0 }],
    propCount: 26, seed: 113,
  },
  {
    id: 'castle', name: '마왕성', difficulty: '지옥', tier: 4, theme: 'castle',
    desc: '위아래에서 몰려와 성문 앞에서 합류. 길이 아주 짧다',
    lives: 40, money: 950, waves: 40, hpMul: 1.4, speedMul: 1.15, crowd: 1,
    paths: [
      [[-12, -14], [-12, -6], [4, -6], [4, 0], [15, 0]],
      [[-12, 14], [-12, 6], [4, 6], [4, 0], [15, 0]],
    ],
    ponds: [{ x: -4, z: 0, r: 2.6 }, { x: -18, z: 0, r: 1.8 }],
    propCount: 26, seed: 131,
  },
];

export const FIELD = { minX: -20, maxX: 20, minZ: -12.5, maxZ: 12.5 };
export const PATH_HALF_WIDTH = 1.15;

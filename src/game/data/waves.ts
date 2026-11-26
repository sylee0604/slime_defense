import type { SlimeId } from './slimes';

export interface SpawnGroup {
  id: SlimeId;
  count: number;
  spacing: number; // 초
  delay: number; // 웨이브 시작 후 첫 스폰까지 초
}

type G = [SlimeId, number, number, number?];
const w = (...groups: G[]): SpawnGroup[] =>
  groups.map(([id, count, spacing, delay = 0]) => ({ id, count, spacing, delay }));

// 맵마다 웨이브 수가 다르다(30 또는 40). 앞에서부터 필요한 만큼 사용.
export const WAVES: SpawnGroup[][] = [
  w(['red', 20, 0.85]),
  w(['red', 32, 0.6]),
  w(['red', 22, 0.55], ['blue', 8, 0.85, 6]),
  w(['red', 30, 0.42], ['blue', 18, 0.65, 4]),
  w(['blue', 28, 0.55], ['red', 12, 0.45, 10]),
  w(['blue', 22, 0.5], ['green', 8, 0.9, 5]),
  w(['blue', 32, 0.42], ['green', 14, 0.75, 6]),
  w(['green', 28, 0.55], ['blue', 22, 0.32, 8]),
  w(['green', 32, 0.42], ['yellow', 6, 1.3, 10]),
  w(['blue', 100, 0.15]),
  w(['yellow', 16, 0.65], ['green', 26, 0.38, 3]),
  w(['black', 10, 0.9], ['green', 32, 0.32, 2]),
  w(['white', 10, 0.9], ['yellow', 22, 0.45, 3], ['storm', 3, 1.5, 9]),
  w(['pink', 18, 0.55], ['black', 8, 0.7, 6], ['white', 8, 0.7, 10]),
  w(['steel', 10, 1.0], ['yellow', 26, 0.32, 4]),
  w(['pink', 40, 0.28], ['steel', 8, 0.9, 6], ['purple', 5, 1.0, 10]),
  w(['zebra', 10, 0.9], ['black', 16, 0.45, 4]),
  w(['zebra', 14, 0.65], ['white', 14, 0.42, 3], ['storm', 10, 0.5, 8]),
  w(['rainbow', 8, 1.0], ['pink', 40, 0.24, 4]),
  w(['rainbow', 16, 0.55], ['steel', 12, 0.55, 5], ['purple', 10, 0.6, 9]),
  w(['rock', 5, 1.3], ['zebra', 18, 0.42, 3]),
  w(['rock', 7, 1.1], ['rainbow', 14, 0.45, 4], ['knight', 1, 1, 12]),
  w(['steel', 28, 0.32], ['rock', 7, 0.9, 6], ['armored', 6, 1.2, 10]),
  w(['rainbow', 22, 0.32], ['rock', 9, 0.85, 6], ['storm', 18, 0.3, 12]),
  w(['king', 1, 1], ['rock', 12, 0.75, 4]),
  w(['rock', 14, 0.62], ['rainbow', 20, 0.32, 3], ['purple', 14, 0.35, 8]),
  w(['king', 2, 6], ['steel', 30, 0.3, 2], ['knight', 2, 4, 10]),
  w(['rock', 28, 0.38], ['king', 2, 5, 8]),
  w(['king', 4, 3.5], ['rock', 22, 0.42, 2], ['armored', 12, 0.6, 6]),
  w(['emperor', 1, 1], ['king', 2, 7, 10], ['rock', 22, 0.38, 4]),
  // ---- 31~40: 어려운 맵 전용 ----
  w(['knight', 8, 2.2], ['rock', 24, 0.38, 3], ['storm', 34, 0.18, 6]),
  w(['armored', 32, 0.32], ['rainbow', 32, 0.22, 2], ['purple', 24, 0.25, 6]),
  w(['emperor', 2, 9], ['king', 4, 4, 3]),
  w(['rock', 50, 0.24], ['knight', 6, 2.5, 4], ['purple', 30, 0.2, 8]),
  w(['titan', 1, 1], ['rock', 24, 0.35, 6]),
  w(['emperor', 3, 7], ['armored', 32, 0.3, 2], ['knight', 10, 1.4, 6]),
  w(['king', 10, 2.2], ['rock', 42, 0.24, 3]),
  w(['titan', 2, 12], ['emperor', 2, 9, 6]),
  w(['titan', 3, 9], ['king', 8, 2.5, 4], ['rock', 40, 0.22, 2]),
  w(['overlord', 1, 1], ['titan', 1, 1, 20], ['emperor', 2, 8, 8], ['knight', 12, 1.2, 4]),
];

export const MAX_WAVES = WAVES.length;

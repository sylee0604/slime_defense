import { expect, test } from '@playwright/test';

type Diag = { frame: number; state: string; wave: number; pops: number; towers: number; lives: number };
const diag = (page: import('@playwright/test').Page) => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__ as unknown as Diag);

test('메뉴 → 맵 시작 → 유닛 배치 → 웨이브 진행', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
  await expect(page.locator('#screen-menu')).toBeVisible();

  await page.click('.map-card[data-map="0"]');
  expect((await diag(page)).state).toBe('playing');

  // 실제 입력으로 배치: 상점 클릭 → 캔버스 클릭
  const spot = await page.evaluate(() => {
    const T = window.__TD__ as unknown as { canPlace: (k: string, x: number, z: number) => boolean; worldToScreen: (x: number, z: number) => { x: number; y: number } };
    for (let x = -12; x < 12; x += 0.5) for (let z = -8; z < 8; z += 0.5) if (T.canPlace('dart', x, z)) return T.worldToScreen(x, z);
    return null;
  });
  expect(spot).not.toBeNull();
  await page.click('.shop-item[data-kind="dart"]');
  await page.mouse.move(spot!.x, spot!.y);
  await page.mouse.click(spot!.x, spot!.y);
  expect((await diag(page)).towers).toBe(1);

  await page.keyboard.press('Space');
  await page.evaluate(() => (window.__TD__ as unknown as { simulate: (s: number) => void }).simulate(60));
  const d = await diag(page);
  expect(d.wave).toBe(1);
  expect(d.pops).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

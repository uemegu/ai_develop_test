import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173/';

const PINNED_KEY = 'AI_DEV_PINNED_QUOTES_V1';
const CUSTOM_KEY = 'AI_DEV_CUSTOM_QUOTES_V1';

async function clearLocalStorage(page) {
  await page.goto(APP_URL);
  await page.evaluate(() => {
    localStorage.clear();
  });
}

test.describe('格言表示アプリ E2E', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('1-1: 今日の格言画面で名言・発言者・背景画像が表示される', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator('.today-card__quote')).toBeVisible();
    await expect(page.locator('.today-card__author')).toBeVisible();
    await expect(page.locator('.today-card__bg')).toBeVisible();
  });

  test('1-2: 「別の格言」ボタンで名言・背景画像が変化する', async ({ page }) => {
    await page.goto(APP_URL);
    const beforeText = await page.locator('.today-card__quote').textContent();
    await page.getByRole('button', { name: /別の格言/ }).click();
    const afterText = await page.locator('.today-card__quote').textContent();
    expect(beforeText).not.toBe(afterText);
  });

  test('1-3: 「ピン留め」ボタンでお気に入り追加・localStorage保存', async ({ page }) => {
    await page.goto(APP_URL);
    const quoteText = await page.locator('.today-card__quote').textContent();
    await page.getByRole('button', { name: /ピン留めする/ }).click();
    const pinned = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), PINNED_KEY);
    expect(pinned.some((q) => q.text === quoteText)).toBeTruthy();
    await page.getByRole('button', { name: /お気に入り/ }).click();
    await expect(page.locator('.favorite-card__quote', { hasText: quoteText })).toBeVisible();
  });

  test('2-1: お気に入り画面でピン留め名言がカード表示', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /ピン留めする/ }).click();
    await page.getByRole('button', { name: /お気に入り/ }).click();
    await expect(page.locator('.favorite-card')).toHaveCount(1);
    await expect(page.locator('.favorite-card__quote')).toBeVisible();
    await expect(page.locator('.favorite-card__author')).toBeVisible();
  });

  test('2-2: お気に入り編集（正常系）', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /ピン留めする/ }).click();
    await page.getByRole('button', { name: /お気に入り/ }).click();
    await page.getByRole('button', { name: /編集/ }).click();
    await page.fill('textarea', '編集後の格言');
    await page.fill('input', '編集後の発言者');
    await page.getByRole('button', { name: /保存する/ }).click();
    await expect(page.locator('.favorite-card__quote', { hasText: '編集後の格言' })).toBeVisible();
    await expect(page.locator('.favorite-card__author', { hasText: '編集後の発言者' })).toBeVisible();
    const pinned = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), PINNED_KEY);
    expect(pinned.some((q) => q.text === '編集後の格言' && q.author === '編集後の発言者')).toBeTruthy();
  });

  test('2-3: お気に入り削除', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /ピン留めする/ }).click();
    await page.getByRole('button', { name: /お気に入り/ }).click();
    await page.getByRole('button', { name: /削除/ }).click();
    await expect(page.locator('.favorite-card')).toHaveCount(0);
    const pinned = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), PINNED_KEY);
    expect(pinned.length).toBe(0);
  });

  test('2-4: 編集時に格言を空欄で保存しようとするとエラー', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /ピン留めする/ }).click();
    await page.getByRole('button', { name: /お気に入り/ }).click();
    await page.getByRole('button', { name: /編集/ }).click();
    await page.fill('textarea', '');
    await page.getByRole('button', { name: /保存する/ }).click();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('3-1: 名言を登録（正常系）', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /名言を登録/ }).click();
    await page.fill('textarea', '新しい格言');
    await page.fill('input', '新しい発言者');
    await page.getByRole('button', { name: /登録してピン留め/ }).click();
    await expect(page.locator('.favorite-card__quote', { hasText: '新しい格言' })).toBeVisible();
    await expect(page.locator('.favorite-card__author', { hasText: '新しい発言者' })).toBeVisible();
    const custom = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), CUSTOM_KEY);
    expect(custom.some((q) => q.text === '新しい格言' && q.author === '新しい発言者')).toBeTruthy();
  });

  test('3-2: 発言者未入力時はAnonymousで登録', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /名言を登録/ }).click();
    await page.fill('textarea', '匿名格言');
    await page.fill('input', '');
    await page.getByRole('button', { name: /登録してピン留め/ }).click();
    await expect(page.locator('.favorite-card__author', { hasText: 'Anonymous' })).toBeVisible();
  });

  test('3-3: 格言が空欄だと登録できずエラー表示', async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /名言を登録/ }).click();
    await page.fill('textarea', '');
    await page.getByRole('button', { name: /登録してピン留め/ }).click();
    await expect(page.locator('.helper-text')).toHaveText(/格言は必須/);
  });

  test('4-1: フッターナビゲーションで画面遷移', async ({ page }) => {
    await page.goto(APP_URL);
    // 事前にピン留め
    await page.getByRole('button', { name: 'ピン留めする' }).click();

    // 「お気に入り」ボタンで遷移
    await page.getByRole('button', { name: 'お気に入り' }).click();
    await expect(page.locator('.section-title', { hasText: 'お気に入りの格言' })).toBeVisible();

    // 「名言を登録」ボタンで遷移
    await page.getByRole('button', { name: '名言を登録' }).click();
    await expect(page.locator('.section-title', { hasText: '名言を登録' })).toBeVisible();

    // 「今日の格言」ボタンで遷移
    await page.getByRole('button', { name: '今日の格言' }).click();
    await expect(page.locator('.today-card')).toBeVisible();
  });

  test('5-1: localStorageのデータ永続化と復元', async ({ page, context }) => {
    await page.goto(APP_URL);
    await page.getByRole('button', { name: /名言を登録/ }).click();
    await page.fill('textarea', '永続格言');
    await page.fill('input', '永続発言者');
    await page.getByRole('button', { name: /登録してピン留め/ }).click();
    await page.reload();
    await page.getByRole('button', { name: /お気に入り/ }).click();
    await expect(page.locator('.favorite-card__quote', { hasText: '永続格言' })).toBeVisible();
    await expect(page.locator('.favorite-card__author', { hasText: '永続発言者' })).toBeVisible();
  });

  test('6-1: quotes.json取得失敗時にエラーバナー表示', async ({ page }) => {
    await page.route('**/quotes.json', route => route.abort());
    await page.goto(APP_URL);
    await expect(page.locator('.error-banner')).toHaveText(/名言の読み込みに失敗/);
  });
});

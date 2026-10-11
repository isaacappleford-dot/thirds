import { expect, test } from '@playwright/test';

test('onboarding → camera → capture → looks → save → gallery', async ({ page }) => {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data')) foreign.push(r.url());
  });
  const model = page.waitForResponse((r) => r.url().includes('/models/efficientdet_lite0.tflite') && r.ok(), { timeout: 30_000 });

  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Turn on camera' }).click();
  await page.getByRole('button', { name: 'Start shooting' }).click();

  // The fake camera streams; the shutter becomes enabled once it's live.
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(shutter).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('video')).toHaveJSProperty('paused', false);
  await model; // detection model is self-hosted and lazy-loaded after the first frame

  // Composition scan shows a score card.
  await page.getByRole('button', { name: 'Scan composition' }).click();
  await expect(page.getByRole('dialog', { name: /Composition score/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Got it' }).click();

  await shutter.click();
  await expect(page).toHaveURL(/#\/edit\//, { timeout: 20_000 });

  // Looks strip renders on the photo; apply one and a frame.
  await page.getByRole('radio', { name: /^Neon/ }).click();
  await expect(page.getByRole('radio', { name: /^Neon/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('img', { name: /Neon look/ })).toBeVisible();
  await expect(page.getByText(/ERROR|failed/i)).toHaveCount(0);
  await page.getByRole('tab', { name: 'frames' }).click();
  await page.getByRole('radio', { name: 'Paper' }).click();
  await page.locator('label', { hasText: 'Date stamp' }).click();
  await expect(page.getByRole('switch', { name: /Date stamp/ })).toBeChecked();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Open gallery' }).click();
  await expect(page.getByRole('list', { name: /1 photo/ })).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
  // Photos never leave the device: no request to any other origin.
  expect(foreign).toEqual([]);
});

test('demo camera and sample photos work without a camera', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('thirds:settings', JSON.stringify({ onboarded: true, demoCamera: true }));
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Demo camera · Exit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: 'More ways to add a photo' }).click();
  await page.getByRole('button', { name: 'Night street' }).click();
  await expect(page).toHaveURL(/#\/edit\//, { timeout: 20_000 });
  await expect(page.getByRole('radio', { name: /^Ink/ })).toBeVisible();
});

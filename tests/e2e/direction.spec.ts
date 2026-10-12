import { expect, test } from '@playwright/test';

/**
 * End-to-end direction check with a synthetic camera: a bright square sits
 * left of the left thirds line. To bring it right onto the line the frame must
 * slide right over the scene's content, i.e. the phone must move LEFT.
 */
test('rear camera: subject left of its third → "Move phone left"', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('thirds:settings', JSON.stringify({ onboarded: true }));
    const fake = async () => {
      const c = document.createElement('canvas');
      c.width = 720;
      c.height = 960;
      const ctx = c.getContext('2d')!;
      const draw = () => {
        ctx.fillStyle = '#202020';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = '#f5f5f5';
        // x 0.14–0.26, y 0.60–0.72 → centre ≈ (0.20, 0.66); nearest third (1/3, 2/3)
        ctx.fillRect(0.14 * c.width, 0.6 * c.height, 0.12 * c.width, 0.12 * c.height);
        requestAnimationFrame(draw);
      };
      draw();
      const s = c.captureStream(30);
      Object.defineProperty(s.getVideoTracks()[0], 'getSettings', { value: () => ({ facingMode: 'environment', width: 720, height: 960 }) });
      return s;
    };
    navigator.mediaDevices.getUserMedia = fake;
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: /Move phone/ }).first()).toHaveText('Move phone left', { timeout: 20_000 });
});

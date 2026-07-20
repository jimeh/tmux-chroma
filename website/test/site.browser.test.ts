import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
});

test('persists a theme change across reloads', async ({ page }) => {
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'dark');

  await page
    .getByRole('button', { name: 'Switch to the light background' })
    .click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('chroma-background')))
    .toBe('light');

  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
});

test('supports keyboard selection in the background combobox', async ({
  page,
}) => {
  const background = page.getByRole('combobox', {
    name: '@chroma_background value',
  });
  await background.focus();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(background).toHaveAttribute(
    'aria-activedescendant',
    /-option-1$/
  );
  await page.keyboard.press('Enter');

  await expect(background).toHaveText("'light'");
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('restores dock focus when the preset gallery closes', async ({ page }) => {
  const paletteButton = page.locator('button[data-window="palette"]');
  await paletteButton.focus();
  await expect(paletteButton).toBeFocused();

  await page.keyboard.press('Control+b');
  await page.keyboard.press('w');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('main')
        .evaluate((node) => node instanceof HTMLElement && node.inert)
    )
    .toBe(true);

  await page.keyboard.press('q');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(paletteButton).toBeFocused();
});

test('opens the deterministic README preview from prefix+p', async ({
  page,
}) => {
  await page.keyboard.press('Control+b');
  await page.keyboard.press('p');

  const dialog = page.getByRole('dialog', {
    name: 'Chroma preview across four backgrounds and two styles',
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.preview-theme')).toHaveCount(4);
  await expect(dialog.locator('.preview-bar')).toHaveCount(8);
  await expect(dialog.getByText('solarized light · mauve')).toBeVisible();
});

test('keeps the status dock on one scrollable line at mobile width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();

  await expect(page.locator('.status-dock-scroll')).toHaveCSS(
    'overflow-x',
    'auto'
  );
  await expect(page.locator('.statusbar')).toHaveCSS('height', '28px');
  await expect(page.locator('.status-session')).toBeHidden();
  await expect(page.locator('.status-metrics')).toBeHidden();
});

import { expect, test } from '@playwright/test';

const pages = {
  home: '/',
  article: '/2026/08/23/twenty-ten-on-astro/',
  archives: '/archives/',
};

const viewports = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 820, height: 1000 },
  mobile: { width: 390, height: 844 },
};

for (const [pageName, path] of Object.entries(pages)) {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${pageName} · ${viewportName} · ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
        await page.goto(path);
        await expect(page).toHaveScreenshot(`${pageName}-${viewportName}-${theme}.png`, {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          maxDiffPixelRatio: 0.005,
          scale: 'css',
        });
      });
    }
  }
}

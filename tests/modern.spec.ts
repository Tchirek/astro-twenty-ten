import { expect, test } from '@playwright/test';

const articlePath = '/2026/08/23/twenty-ten-on-astro/';

test('navigation, focus, and responsive layout remain usable', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.site-title')).toHaveText('Twenty Ten Notes');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();

  if (browserName === 'webkit') await page.getByRole('link', { name: 'Skip to content' }).focus();
  else await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).toBeFocused();
  expect(await skipLink.evaluate((link) => getComputedStyle(link).outlineStyle)).toBe('solid');

  await page.evaluate(() => {
    Reflect.set(window, '__navigationMarker', 'kept');
    Reflect.set(window, '__topRevealCount', 0);
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this instanceof HTMLElement && this.classList.contains('page-grid')) {
        Reflect.set(window, '__topRevealCount', Number(Reflect.get(window, '__topRevealCount')) + 1);
      }
      return Reflect.apply(animate, this, args);
    };
  });

  for (const [label, path] of [['Archives', '/archives/'], ['About', '/about/'], ['Home', '/']] as const) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    expect(await page.evaluate(() => Reflect.get(window, '__navigationMarker'))).toBe('kept');
  }
  expect(await page.evaluate(() => Reflect.get(window, '__topRevealCount'))).toBe(0);

  const article = page.locator('.post-summary h2 a').last();
  const articlePath = await article.getAttribute('href');
  if (!articlePath) throw new Error('Expected the article to have an href');
  await article.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(24);
  await article.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(articlePath);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, '__navigationMarker'))).toBe('kept');
  expect(await page.evaluate(() => Reflect.get(window, '__topRevealCount'))).toBe(1);

  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Blog sidebar' })).toBeVisible();
});

test('theme and weighted instant search enhance the static pages', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('searchbox', { name: 'Search this site' })).toBeFocused();

  await page.getByRole('button', { name: /Switch to dark mode/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  expect(await page.getByRole('button', { name: /Switch to light mode/ }).evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe('dotted');

  await page.goto('/search/?q=Astro');
  await expect(page.getByRole('status')).toContainText('result');
  await expect(page.locator('.search-results h2').first()).toContainText('Twenty Ten, Still Quietly Good');
  await page.getByRole('searchbox', { name: 'Search every post' }).fill('systemd');
  await expect(page.locator('.search-results h2').first()).toContainText('Systemd Timers');
  await expect(page.locator('.search-results p').first()).not.toBeEmpty();
});

test('article enhancements are layered over static content', async ({ page }) => {
  await page.goto(articlePath);
  await expect(page.locator('.post-content')).toContainText('Twenty Ten never asked');
  await expect(page.getByRole('navigation', { name: 'Contents' })).toBeVisible();
  await expect(page.locator('h2#what-stayed .heading-link')).toHaveAttribute('href', '#what-stayed');

  const external = page.locator('.post-content a[href="https://astro.build/"]');
  await expect(external).toHaveAttribute('target', '_blank');
  await expect(external).toHaveAttribute('rel', /external/);
  await expect(external.locator('.external-link-mark')).toHaveAttribute('aria-hidden', 'true');

  const copy = page.locator('.copy-code').first();
  await expect(copy).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => sessionStorage.setItem('copied-code', value) },
    });
  });
  const width = await copy.evaluate((button) => button.getBoundingClientRect().width);
  await copy.click();
  await expect(copy).toHaveText('Copy');
  await expect(copy).toHaveAttribute('data-copy-state', 'copied');
  await expect(copy.locator('xpath=following-sibling::*[@role="status"][1]')).toHaveText('Code copied to clipboard.');
  expect(await copy.evaluate((button) => button.getBoundingClientRect().width)).toBe(width);
  expect(await page.evaluate(() => sessionStorage.getItem('copied-code'))).toContain('Markdown');
});

test('core discovery and articles work with JavaScript disabled', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'One real no-JS engine is sufficient; all three engines run the modern suite.');
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 940, height: 900 } });
  const page = await context.newPage();

  for (const path of ['/', articlePath, '/archives/', '/category/programming/', '/tag/astro/']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  }

  await page.goto(articlePath);
  await expect(page.locator('.post-content')).toContainText('Everything else is a link or a stylesheet.');
  await page.goto('/search/');
  await expect(page.getByRole('link', { name: 'Archives', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
  await context.close();
});

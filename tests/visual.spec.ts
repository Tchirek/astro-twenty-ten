import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const commentsOrigin = 'https://comments.sicnu.pics.tchirek.top';
const commentsDist = resolve('services/sicsic-comment-ui/dist');
const hostOrigin = 'http://127.0.0.1:4173';
test.use({ timezoneId: 'Asia/Taipei' });

const commentItems = [
  {
    id: 'comment-1',
    imageId: 'blog:/2026/08/23/twenty-ten-on-astro/',
    rootId: 'comment-1',
    parentId: null,
    nickname: 'Alice',
    content: 'The quiet typography works beautifully.',
    html: '<p>The quiet typography works beautifully.</p>',
    createdAt: Date.UTC(2026, 7, 23, 12),
    likeCount: 2,
    likedByMe: false,
  },
  {
    id: 'comment-2',
    imageId: 'blog:/2026/08/23/twenty-ten-on-astro/',
    rootId: 'comment-1',
    parentId: 'comment-1',
    nickname: 'Bob',
    content: 'Agreed — especially the spacing.',
    html: '<p>Agreed — especially the spacing.</p>',
    createdAt: Date.UTC(2026, 7, 23, 12, 30),
    likeCount: 0,
    likedByMe: false,
  },
];

async function mockComments(page: Page, items: object[] = commentItems, parentOrigin?: string) {
  await page.route(`${commentsOrigin}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (relative !== 'index.html' && !/^assets\/[\w-]+\.(?:css|js)$/.test(relative)) {
      await route.abort();
      return;
    }
    let body: Buffer | string = await readFile(join(commentsDist, relative));
    if (relative === 'index.html' && parentOrigin) {
      body = body.toString().replace(
        '<head>',
        `<head><script>window.COMMENT_UI_CONFIG=${JSON.stringify({ allowedParentOrigins: [parentOrigin] })}</script>`,
      );
    }
    await route.fulfill({
      body,
      contentType: relative.endsWith('.css') ? 'text/css' : relative.endsWith('.js') ? 'text/javascript' : 'text/html',
    });
  });

  await page.route('https://api.pics.tchirek.top/**', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': route.request().headers().origin || hostOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Viewer-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Content-Type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({
      headers,
      body: JSON.stringify({ items }),
    });
  });
}

async function mountPanelHost(page: Page, theme: 'light' | 'dark', width: number, height: number) {
  await page.goto('/');
  await page.setContent(`<!doctype html>
    <style>body { margin: 0; } iframe { display: block; border: 0; }</style>
    <script>
      addEventListener('message', (event) => {
        const frame = document.querySelector('#panel-frame');
        if (event.source !== frame.contentWindow || event.origin !== ${JSON.stringify(commentsOrigin)}) return;
        if (event.data?.type === 'comment-ui:ready') {
          frame.contentWindow.postMessage(${JSON.stringify({ type: 'normalpics:context', imageId: 'image:panel-visual', viewerId: 'frame-viewer-baseline' })}, ${JSON.stringify(commentsOrigin)});
          frame.contentWindow.postMessage(${JSON.stringify({ type: 'normalpics:theme', theme })}, ${JSON.stringify(commentsOrigin)});
        }
      });
    </script>
    <iframe id="panel-frame" title="Comments" width="${width}" height="${height}" src="${commentsOrigin}/?preset=normalpics"></iframe>`);
}

test('empty comments keep the Twenty Ten form without a comments heading', async ({ page }) => {
  await page.setViewportSize(viewports.desktop);
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await mockComments(page, []);
  await page.goto(pages.article);
  const comments = page.locator('#comments');
  await comments.scrollIntoViewIfNeeded();
  await expect(comments.locator('.comment')).toHaveCount(0);
  await expect(comments.locator('.comment-title')).toBeHidden();
  await expect(comments.locator('.comment-form')).toHaveCSS('height', '278px');
  await expect(comments.locator('.editor-toolbar')).toHaveCSS('height', '52px');
  await expect(comments.locator('.editor-toolbar > button')).toHaveCount(3);
  await expect(comments.locator('.editor-toolbar > button').nth(0)).toHaveAttribute('aria-label', '粗體');
  await expect(comments.locator('.editor-toolbar > button').nth(1)).toHaveAttribute('aria-label', '斜體');
  await expect(comments.locator('.editor-surface')).toHaveCSS('height', '152px');
  await expect(comments.locator('.composer-actions')).toHaveCSS('height', '72px');
  await expect(comments.getByText('匿名', { exact: true })).toHaveCSS('width', '70px');
  await expect(comments.getByText('匿名', { exact: true })).toHaveCSS('height', '40px');
  await expect(comments.getByRole('button', { name: '留言' })).toHaveCSS('width', '70px');
  await expect(comments.getByRole('button', { name: '留言' })).toHaveCSS('height', '40px');
  await expect(comments).toHaveScreenshot('comments-empty-desktop-light.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.005,
    scale: 'css',
  });
});

test('comment account dialog follows the Twenty Ten editor language', async ({ page }) => {
  await page.setViewportSize(viewports.desktop);
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await mockComments(page, []);
  await page.goto(pages.article);
  const comments = page.locator('#comments');
  await comments.scrollIntoViewIfNeeded();
  await expect(comments.locator('.comment-form')).toHaveCSS('height', '278px');
  const initialHeight = await comments.evaluate((element) => getComputedStyle(element).height);
  await comments.getByText('匿名', { exact: true }).click();
  await comments.getByRole('button', { name: '登入或管理帳戶' }).click();
  await expect(comments.getByRole('dialog', { name: '登入SicSic通行證' })).toBeVisible();
  await expect(comments.getByRole('button', { name: '註冊' })).toBeVisible();
  const overlay = comments.locator('.auth-overlay');
  const card = comments.locator('.auth-entry-card');
  await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(overlay).toHaveCSS('backdrop-filter', 'blur(1px)');
  await expect(card).toHaveCSS('border-radius', '0px');
  await expect(card).toHaveCSS('height', '300px');
  const cardHeight = await card.evaluate((element) => element.getBoundingClientRect().height);
  await comments.getByRole('button', { name: '註冊', exact: true }).click();
  expect(await card.evaluate((element) => element.getBoundingClientRect().height)).toBe(cardHeight);
  await comments.locator('.auth-tabs').getByRole('button', { name: '登入', exact: true }).click();
  await comments.getByRole('button', { name: '忘記密碼？' }).click();
  expect(await card.evaluate((element) => element.getBoundingClientRect().height)).toBe(cardHeight);
  await comments.getByRole('button', { name: '返回登入' }).click();
  await expect(comments).toHaveCSS('height', initialHeight);
  await expect(comments).toHaveScreenshot('comments-auth-desktop-light.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.005,
    scale: 'css',
  });
});

test('comment editing opens once, focuses the field, and cancels cleanly', async ({ page }) => {
  await page.setViewportSize(viewports.desktop);
  await mockComments(page, [{ ...commentItems[0], ownedByMe: true, editable: true }]);
  await page.goto(pages.article);
  const comments = page.locator('#comments');
  await comments.scrollIntoViewIfNeeded();
  await comments.getByRole('button', { name: '編輯' }).click();
  const editor = comments.getByLabel('編輯留言');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('The quiet typography works beautifully.');
  await expect(comments.locator('.skeleton-comment')).toHaveCount(0);
  const editingHeight = await comments.evaluate((element) => getComputedStyle(element).height);
  await expect(comments).toHaveCSS('height', editingHeight);
  await comments.getByRole('button', { name: '取消' }).click();
  await expect(editor).toHaveCount(0);
  await expect(comments.locator('.comment .markdown')).toContainText('The quiet typography works beautifully.');
});

for (const [viewportName, dimensions] of Object.entries({
  desktop: { frame: { width: 420, height: 720 }, page: { width: 900, height: 800 } },
  mobile: { frame: { width: 390, height: 844 }, page: { width: 390, height: 844 } },
})) {
  for (const theme of ['light', 'dark'] as const) {
    test(`panel · ${viewportName} · ${theme}`, async ({ page }) => {
      await page.setViewportSize(dimensions.page);
      await mockComments(page, commentItems, hostOrigin);
      await mountPanelHost(page, theme, dimensions.frame.width, dimensions.frame.height);

      const panel = page.frameLocator('#panel-frame');
      await expect(panel.locator('.comment')).toHaveCount(2);
      await expect(panel.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(panel.getByRole('button', { name: '关闭' })).toBeVisible();
      await expect(panel.locator('#app')).toHaveScreenshot(`panel-${viewportName}-${theme}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.005,
        scale: 'css',
      });
    });
  }
}

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
        if (pageName === 'article') await mockComments(page);
        await page.goto(path);
        if (pageName === 'article') {
          const comments = page.locator('#comments');
          await comments.scrollIntoViewIfNeeded();
          await expect(comments.locator('.comment')).toHaveCount(2);
          await expect.poll(async () => Number.parseFloat(await comments.evaluate((element) => getComputedStyle(element).height))).toBeGreaterThan(700);
          await page.evaluate(() => window.scrollTo(0, 0));
        }
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

// Keep comment goldens independent from intentional site copy/color changes.
for (const [viewportName, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark'] as const) {
    test(`comments · ${viewportName} · ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await mockComments(page);
      await page.goto(pages.article);
      const comments = page.locator('#comments');
      await comments.scrollIntoViewIfNeeded();
      await expect(comments.locator('.comment')).toHaveCount(2);
      await expect(comments).toHaveScreenshot(`comments-${viewportName}-${theme}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.005,
        scale: 'css',
      });
    });
  }
}

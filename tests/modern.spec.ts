import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { CommentController } from '../services/sicsic-comment-ui/src/core';
import type { CommentItem } from '../services/sicsic-comment-ui/src/types';

const articlePath = '/2026/08/23/twenty-ten-on-astro/';
const commentsOrigin = 'https://comments.sicnu.pics.tchirek.top';
const commentsDist = resolve('services/sicsic-comment-ui/dist');
const hostOrigin = 'http://127.0.0.1:4173';

async function mockBuiltCommentUi(page: Page, options: {
  apiOrigin?: string;
  items?: object[];
  listGate?: Promise<void>;
  parentOrigin?: string;
} = {}) {
  let posted = false;
  await page.route(`${commentsOrigin}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (relative !== 'index.html' && !/^assets\/[\w-]+\.(?:css|js)$/.test(relative)) return route.abort();
    let body: Buffer | string = await readFile(join(commentsDist, relative));
    if (relative === 'index.html' && options.parentOrigin) {
      body = body.toString().replace(
        '<head>',
        `<head><script>window.COMMENT_UI_CONFIG=${JSON.stringify({ allowedParentOrigins: [options.parentOrigin] })}</script>`,
      );
    }
    await route.fulfill({
      body,
      headers: { 'Access-Control-Allow-Origin': hostOrigin },
      contentType: relative.endsWith('.css') ? 'text/css' : relative.endsWith('.js') ? 'text/javascript' : 'text/html',
    });
  });
  await page.route(`${options.apiOrigin ?? 'https://api.pics.tchirek.top'}/**`, async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': route.request().headers().origin || hostOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Viewer-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Content-Type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().method() === 'POST') {
      posted = true;
      return route.fulfill({ status: 201, headers, body: '{"id":"comment-smoke"}' });
    }
    await options.listGate;
    await route.fulfill({
      headers,
      body: JSON.stringify({
        items: options.items ?? (posted ? [{
          id: 'comment-smoke',
          imageId: `blog:${articlePath}`,
          rootId: 'comment-smoke',
          parentId: null,
          nickname: 'Storage fallback',
          content: 'Anonymous comments still work.',
          html: '<p>Anonymous comments still work.</p>',
          createdAt: Date.UTC(2026, 7, 24, 6),
          likeCount: 0,
          likedByMe: false,
        }] : []),
      }),
    });
  });
}

async function mountFrameHost(
  page: Page,
  preset: 'normalpics' | 'normaldocs',
  subject: string,
  { height = 360, theme = 'light', width = 420 }: { height?: number; theme?: 'light' | 'dark'; width?: number } = {},
) {
  await page.goto('/');
  await page.setContent(`<!doctype html>
    <style>body { min-height: 1600px; margin: 0; } iframe { display: block; border: 0; }</style>
    <script>
      window.__frameMessages = [];
      addEventListener('message', (event) => {
        const frame = document.querySelector('#panel-frame');
        if (event.source !== frame.contentWindow || event.origin !== ${JSON.stringify(commentsOrigin)}) return;
        window.__frameMessages.push(event.data);
        if (event.data?.type === 'comment-ui:ready') {
          frame.contentWindow.postMessage(${JSON.stringify({ type: 'normalpics:context', imageId: subject, viewerId: 'frame-viewer-baseline' })}, ${JSON.stringify(commentsOrigin)});
          frame.contentWindow.postMessage(${JSON.stringify({ type: 'normalpics:theme', theme })}, ${JSON.stringify(commentsOrigin)});
        }
      });
    </script>
    <iframe id="panel-frame" title="Comments" width="${width}" height="${height}" src="${commentsOrigin}/?preset=${preset}"></iframe>`);

  await expect.poll(() => page.evaluate(() => (
    (Reflect.get(window, '__frameMessages') as Array<{ type?: string }>).some((message) => message.type === 'comment-ui:ready')
  ))).toBe(true);
}

test('SicSic reveals the editor while the first comment request is pending', async ({ page }) => {
  let releaseList!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  await mockBuiltCommentUi(page, { listGate });
  await page.goto(articlePath);

  const comments = page.locator('#comments');
  await comments.scrollIntoViewIfNeeded();
  await expect(comments.getByRole('heading', { name: '發表留言' })).toBeVisible();
  await expect(comments.getByLabel('留言內容')).toBeEditable();

  releaseList();
});

test('inline core ignores stale subjects and late responses after destroy', async ({ page }) => {
  await mockBuiltCommentUi(page);
  let releaseFirst!: () => void;
  let releaseLast!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const lastGate = new Promise<void>((resolve) => { releaseLast = resolve; });
  const subjects: string[] = [];
  await page.route('https://api.pics.tchirek.top/api/comment?**', async (route) => {
    const subject = new URL(route.request().url()).searchParams.get('imageId')!;
    subjects.push(subject);
    if (subject === 'first') await firstGate;
    if (subject === 'last') await lastGate;
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': hostOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{
        id: subject, rootId: subject, parentId: null, imageId: subject,
        nickname: 'Fixture', content: subject, html: `<p>${subject}</p>`,
        createdAt: 1, likeCount: 0, likedByMe: false,
      }] }),
    });
  });
  const manifest = JSON.parse(await readFile(join(commentsDist, '.vite/manifest.json'), 'utf8'));
  await page.goto('/');
  await page.evaluate(async (url) => {
    const { init } = await import(url);
    const el = document.createElement('section');
    el.id = 'lifecycle-comments';
    document.body.append(el);
    Reflect.set(window, '__commentsController', init({ el: '#lifecycle-comments', serverURL: 'https://api.pics.tchirek.top', subject: 'first' }));
  }, `${commentsOrigin}/${manifest['src/core.ts'].file}`);
  await expect.poll(() => subjects).toContain('first');
  await page.evaluate(() => (Reflect.get(window, '__commentsController') as CommentController).update({ subject: 'second' }));
  releaseFirst();
  await expect(page.locator('#lifecycle-comments .comment .markdown')).toHaveText('second');
  const lastResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get('imageId') === 'last');
  await page.evaluate(() => (Reflect.get(window, '__commentsController') as CommentController).update({ subject: 'last' }));
  await expect.poll(() => subjects).toContain('last');
  await page.evaluate(() => {
    const comments = Reflect.get(window, '__commentsController') as CommentController;
    comments.destroy();
    comments.destroy();
    comments.update({ subject: 'ignored' });
  });
  releaseLast();
  await (await lastResponse).finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator('#lifecycle-comments')).toBeEmpty();
  expect(subjects).toEqual(['first', 'second', 'last']);
});

test('responsive header keeps downstream layout stable within height bands', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).getPropertyValue('zoom'))).toBe('1');

  const seenHeights = new Set<number>();
  for (let width = 1078; width >= 320; width -= 13) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.locator('.site-shell').evaluate((shell) => {
      const image = shell.querySelector('.header-art')!.getBoundingClientRect();
      const nav = shell.querySelector('.primary-nav')!.getBoundingClientRect();
      const grid = shell.querySelector('.page-grid')!.getBoundingClientRect();
      return { height: image.height, imageToNav: nav.top - image.bottom, navToGrid: grid.top - nav.bottom };
    });
    seenHeights.add(geometry.height);
    expect(Math.abs(geometry.imageToNav)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(geometry.navToGrid)).toBeLessThanOrEqual(0.01);
  }

  for (const [width, expectedHeight] of [[1078, 203], [761, 203], [760, 157], [461, 157], [460, 93], [320, 93]]) {
    await page.setViewportSize({ width, height: 900 });
    const height = await page.locator('.header-art').evaluate((image) => image.getBoundingClientRect().height);
    seenHeights.add(height);
    expect(height).toBe(expectedHeight);
  }
  expect([...seenHeights].sort((a, b) => a - b)).toEqual([93, 157, 203]);
});





test('navigation, focus, and responsive layout remain usable', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.site-title')).toHaveText('Tchirek Afra');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  const license = page.getByRole('link', { name: 'CC BY-NC-SA 4.0 (opens in a new tab)' });
  await expect(license).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
  await expect(license).toHaveAttribute('rel', 'license external noopener');
  await expect(license.locator('.external-link-mark')).toHaveText('↗');
  await expect(license.locator('.external-link-mark')).toHaveAttribute('aria-hidden', 'true');

  if (browserName === 'webkit') await page.getByRole('link', { name: 'Skip to content' }).focus();
  else await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).toBeFocused();
  expect(await skipLink.evaluate((link) => getComputedStyle(link).outlineStyle)).toBe('solid');

  for (const [label, path] of [['Archives', '/archives/'], ['About', '/about/'], ['Home', '/']] as const) {
    await page.evaluate(() => Reflect.set(window, '__navigationMarker', 'old-document'));
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    expect(await page.evaluate(() => Reflect.get(window, '__navigationMarker'))).toBeUndefined();
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  }

  const article = page.locator('.post-summary h2 a').last();
  const articlePath = await article.getAttribute('href');
  if (!articlePath) throw new Error('Expected the article to have an href');
  await article.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(24);
  await article.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(articlePath);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, '__navigationMarker'))).toBeUndefined();

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
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
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
  await expect(external.locator('.screen-reader-text')).toHaveText(' (opens in a new tab)');

  const copy = page.locator('.copy-code').first();
  await expect(copy).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => sessionStorage.setItem('copied-code', value) },
    });
  });
  await copy.scrollIntoViewIfNeeded();
  const width = await copy.evaluate((button) => button.getBoundingClientRect().width);
  const restingShadow = await copy.evaluate((button) => getComputedStyle(button).boxShadow);
  const box = await copy.boundingBox();
  if (!box) throw new Error('Expected the copy button to have a bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(copy).toHaveText('Copy');
  await expect.poll(() => copy.evaluate((button) => getComputedStyle(button).boxShadow)).not.toBe(restingShadow);
  expect(await copy.evaluate((button) => button.getBoundingClientRect().width)).toBe(width);
  await page.mouse.up();
  await expect.poll(() => copy.evaluate((button) => getComputedStyle(button).boxShadow)).toBe(restingShadow);
  await expect(copy.locator('xpath=following-sibling::*[@role="status"][1]')).toHaveText('Code copied to clipboard.');
  expect(await copy.evaluate((button) => button.getBoundingClientRect().width)).toBe(width);
  expect(await page.evaluate(() => sessionStorage.getItem('copied-code'))).toContain('Markdown');
});

test('Blog comments are native, lazy, and anonymous-first until a deliberate action', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('comment_ui_session@https://api.pics.tchirek.top', 'fixture-saved-session'));
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const comment: CommentItem = {
    id: 'reader-comment',
    imageId: 'blog:' + articlePath,
    rootId: 'reader-comment',
    parentId: null,
    nickname: 'Historical signature',
    content: 'A comment is a historical document.',
    html: '<p>A comment is a historical document.</p>',
    createdAt: Date.UTC(2026, 7, 24, 6),
    likeCount: 0,
    likedByMe: false,
    authorId: 'reader-account',
    authorAvatar: '/api/auth/avatar/reader-account?v=1',
    authorBadge: 'cockade',
  };
  await mockBuiltCommentUi(page, { items: [comment] });
  await page.route('https://api.pics.tchirek.top/api/auth/avatar/reader-account?**', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
  }));
  await page.route('https://api.pics.tchirek.top/api/auth/profiles?**', (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': hostOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ profiles: { 'reader-account': {
      username: 'reader', displayName: 'Current profile name', badge: 'none',
      avatar: null, bio: null, website: 'javascript:alert(1)', email: null,
    } } }),
  }));
  await page.route('https://api.pics.tchirek.top/api/comment/reader-comment', (route) => route.fulfill({
    headers: {
      'Access-Control-Allow-Origin': hostOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Viewer-Id',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Content-Type': 'application/json',
    },
    status: route.request().method() === 'OPTIONS' ? 204 : 200,
    body: route.request().method() === 'OPTIONS' ? '' : '{"likedByMe":true,"likeCount":1}',
  }));

  await page.goto(articlePath);
  const comments = page.locator('#comments');
  await expect(comments).toHaveAttribute('data-sicsic-integration', 'inline');
  await expect(comments.locator('iframe')).toHaveCount(0);
  expect(page.frames()).toHaveLength(1);
  expect(requests.some((url) => url.includes('/api/comment'))).toBe(false);
  expect(requests.some((url) => /\/passport[-.]/.test(url))).toBe(false);

  const listRequest = page.waitForRequest((request) => request.url().includes('/api/comment?'));
  await comments.scrollIntoViewIfNeeded();
  await expect(comments.locator('.comment')).toHaveCount(1);
  const request = await listRequest;
  expect(new URL(request.url()).searchParams.get('imageId')).toBe('blog:' + articlePath);
  expect(request.headers()['x-viewer-id']).toBeUndefined();
  expect(request.headers().authorization).toBeUndefined();
  expect(request.headers()['content-type']).toBeUndefined();
  // Public avatar images are not account initialization or profile enrichment.
  expect(requests.some((url) => url.includes('/api/auth/') && !url.includes('/api/auth/avatar/'))).toBe(false);
  expect(requests.some((url) => /\/passport[-.]/.test(url))).toBe(false);
  await expect(comments.locator('.avatar-img')).toHaveAttribute('src', 'https://api.pics.tchirek.top' + comment.authorAvatar);
  await expect(comments.locator('.avatar-badge svg')).toHaveAttribute('aria-label', '三色花结');

  await comments.locator('.composer-options > summary').click();
  expect(requests.some((url) => /\/passport[-.]/.test(url))).toBe(false);
  await comments.getByRole('heading', { name: '發表留言' }).click();
  const author = comments.getByRole('button', { name: '查看 Historical signature 的個人檔案' });
  await author.click();
  await expect(comments.getByRole('dialog', { name: '個人檔案' })).toContainText('Current profile name');
  await expect(comments.locator('.comment-name')).toHaveText('Historical signature');
  expect(requests.some((url) => /\/passport[-.]/.test(url))).toBe(true);
  expect(requests.some((url) => url.includes('/api/auth/me'))).toBe(false);
  await comments.getByRole('link', { name: 'javascript:alert(1)' }).click();
  await expect(comments.getByRole('dialog', { name: '個人檔案' })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(author).toBeFocused();
  expect(await page.evaluate(() => sessionStorage.getItem('sicsic_blog_viewer'))).toBeNull();

  const likeRequest = page.waitForRequest((candidate) => candidate.method() === 'PUT' && candidate.url().endsWith('/reader-comment'));
  await comments.getByRole('button', { name: '喜歡', exact: true }).click();
  const liked = await likeRequest;
  expect(liked.headers().authorization).toBeUndefined();
  const viewer = liked.headers()['x-viewer-id'];
  expect(viewer).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
  expect(await page.evaluate(() => sessionStorage.getItem('sicsic_blog_viewer'))).toBe(viewer);
  expect(await page.evaluate(() => localStorage.getItem('sicsic_blog_viewer'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('sicsic-blog-viewer-id'))).toBeNull();

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(comments).toHaveCSS('color', 'rgb(217, 221, 217)');

  // The same old comment follows updated account visuals on the next fetch.
  comment.authorAvatar = '/api/auth/avatar/reader-account?v=2';
  comment.authorBadge = 'seal';
  const beforeReload = requests.length;
  await page.reload();
  await comments.scrollIntoViewIfNeeded();
  await expect(comments.locator('.avatar-img')).toHaveAttribute('src', 'https://api.pics.tchirek.top' + comment.authorAvatar);
  await expect(comments.locator('.avatar-badge svg')).toHaveAttribute('aria-label', '认证标记');
  await expect(comments.locator('.comment-name')).toHaveText('Historical signature');
  expect(requests.slice(beforeReload).some((url) => /\/passport[-.]|\/api\/auth\/(?:me|profiles)(?:[/?]|$)/.test(url))).toBe(false);
});

test('identity drawer loads login on demand and restores keyboard focus', async ({ page }) => {
  await mockBuiltCommentUi(page);
  await page.goto(articlePath);
  const comments = page.locator('#comments');
  await comments.scrollIntoViewIfNeeded();
  const identity = comments.locator('.composer-options > summary');
  await identity.click();
  await comments.getByRole('button', { name: '登入或管理帳戶' }).click();
  const dialog = comments.getByRole('dialog', { name: '登入SicSic通行證' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder('使用者名稱或電子郵件')).toBeFocused();
  const close = dialog.getByRole('button', { name: '關閉' });
  const last = dialog.getByRole('button', { name: '使用 Google 登入' });
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(identity).toBeFocused();
});

test('failed optional chunks keep the anonymous draft and publication usable', async ({ page }) => {
  await mockBuiltCommentUi(page);
  await page.route(/\/_astro\/(?:passport|markdown)[^/]+\.js$/, (route) => route.abort());
  await page.goto(articlePath);
  const comments = page.locator('#comments');
  await comments.scrollIntoViewIfNeeded();
  const editor = comments.getByLabel('留言內容');
  await editor.fill('The draft must survive failed enhancements.');
  await comments.getByRole('button', { name: '預覽' }).click();
  await expect(comments.locator('.preview')).toHaveText('預覽載入失敗，請重試');
  await comments.getByRole('button', { name: '編輯', exact: true }).click();
  await expect(editor).toHaveValue('The draft must survive failed enhancements.');
  await comments.locator('summary').click();
  await comments.getByRole('button', { name: '登入或管理帳戶' }).click();
  await expect(comments.locator('.status')).toHaveText('帳戶功能載入失敗，請重試');
  await expect(comments.getByRole('dialog')).toHaveCount(0);
  const publication = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/comment'));
  await comments.getByRole('button', { name: '留言', exact: true }).click();
  expect((await publication).postDataJSON().content).toBe('The draft must survive failed enhancements.');
  await expect(editor).toHaveValue('');
});

test('comment preview keeps raw HTML and unsafe URLs inert', async ({ page }) => {
  await mockBuiltCommentUi(page);
  await page.goto(articlePath);
  const comments = page.locator('#comments');
  await comments.scrollIntoViewIfNeeded();
  const editor = comments.getByLabel('留言內容');
  await editor.fill('<img src=x onerror=alert(1)>\n\n[unsafe](javascript:alert(1))');
  await comments.getByRole('button', { name: '預覽' }).click();
  await expect(comments.locator('.preview')).toContainText('<img src=x onerror=alert(1)>');
  await expect(comments.locator('.preview img, .preview script, .preview [href^="javascript:"]')).toHaveCount(0);
  await comments.getByRole('button', { name: '編輯', exact: true }).click();
  await editor.fill('![unsafe image](http://example.test/image.png)');
  await comments.getByRole('button', { name: '預覽' }).click();
  await expect(comments.locator('.preview-error')).toHaveText('圖片只允許安全 HTTPS 位址。');
  await expect(comments.locator('.preview img')).toHaveCount(0);
});

test('normalpics frame keeps close and panel-owned scrolling', async ({ page }) => {
  await mockBuiltCommentUi(page, { parentOrigin: hostOrigin });
  await mountFrameHost(page, 'normalpics', 'image:panel-baseline', { height: 240 });

  const panel = page.frameLocator('#panel-frame');
  await panel.getByRole('button', { name: '关闭' }).click();
  await expect.poll(() => page.evaluate(() => (
    (Reflect.get(window, '__frameMessages') as Array<{ type?: string }>).some((message) => message.type === 'comment-ui:close')
  ))).toBe(true);

  const app = panel.locator('#app');
  const geometry = await app.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    overscrollY: getComputedStyle(element).overscrollBehaviorY,
    scrollHeight: element.scrollHeight,
  }));
  expect(geometry.overflowY).toBe('auto');
  if (geometry.overscrollY) expect(geometry.overscrollY).toBe('none');
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);

  await page.evaluate(() => window.scrollTo(0, 120));
  const parentScroll = await page.evaluate(() => window.scrollY);
  expect(await app.evaluate((element) => {
    element.scrollTop = 120;
    return element.scrollTop;
  })).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(parentScroll);
});

test('normalpics frame preserves the panel pull message sequence', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'One stable synthetic-touch engine covers the frame contract.');
  await mockBuiltCommentUi(page, { parentOrigin: hostOrigin });
  await mountFrameHost(page, 'normalpics', 'image:pull-baseline');

  await page.frameLocator('#panel-frame').locator('#app').evaluate(async (element) => {
    const touch = (y: number) => new Touch({
      identifier: 7,
      target: element,
      clientX: 40,
      clientY: y,
      pageX: 40,
      pageY: y,
      screenX: 40,
      screenY: y,
    });
    const dispatch = (type: string, touches: Touch[], changedTouches: Touch[]) => element.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches,
      targetTouches: touches,
      changedTouches,
    }));

    element.scrollTop = 0;
    dispatch('touchstart', [touch(20)], []);
    dispatch('touchmove', [touch(100)], []);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    dispatch('touchend', [], [touch(100)]);
  });

  await expect.poll(() => page.evaluate(() => (
    (Reflect.get(window, '__frameMessages') as Array<{ phase?: string; type?: string }>)
      .filter((message) => message.type === 'comment-ui:pull')
      .map((message) => message.phase)
  ))).toEqual(['start', 'move', 'end']);
});

test('normaldocs frame sends context to the Docs API', async ({ page }) => {
  const subject = 'docs:frame-baseline';
  await mockBuiltCommentUi(page, {
    apiOrigin: 'https://api.docs.tchirek.top',
    items: [{
      id: 'docs-comment',
      imageId: subject,
      rootId: 'docs-comment',
      parentId: null,
      nickname: 'Docs reader',
      content: 'The shared frame stays boring.',
      html: '<p>The shared frame stays boring.</p>',
      createdAt: Date.UTC(2026, 7, 27, 3),
      likeCount: 0,
      likedByMe: false,
    }],
    parentOrigin: hostOrigin,
  });
  const requestPromise = page.waitForRequest((request) => (
    request.url().startsWith('https://api.docs.tchirek.top/api/comment?') && request.method() === 'GET'
  ));

  await mountFrameHost(page, 'normaldocs', subject);
  const request = await requestPromise;
  expect(new URL(request.url()).searchParams.get('imageId')).toBe(subject);
  await expect(page.frameLocator('#panel-frame').locator('.comment')).toHaveCount(1);
  await expect.poll(() => page.evaluate((imageId) => (
    (Reflect.get(window, '__frameMessages') as Array<{ imageId?: string; type?: string }>)
      .some((message) => message.type === 'comment-ui:loaded' && message.imageId === imageId)
  ), subject)).toBe(true);
});

test('SicSic keeps anonymous comments available when storage is blocked', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Storage-policy fallback only needs one real engine.');
  await page.addInitScript((origin) => {
    const { getItem, setItem, removeItem } = Storage.prototype;
    const blocked = () => location.origin === origin;
    Storage.prototype.getItem = function (key) {
      if (blocked()) throw new DOMException('Blocked by storage policy', 'SecurityError');
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (blocked()) throw new DOMException('Blocked by storage policy', 'SecurityError');
      return setItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (blocked()) throw new DOMException('Blocked by storage policy', 'SecurityError');
      return removeItem.call(this, key);
    };
  }, hostOrigin);
  await mockBuiltCommentUi(page);
  await page.goto(articlePath);
  const comments = page.locator('#comments');
  await comments.scrollIntoViewIfNeeded();
  await expect(comments.getByRole('heading', { name: '發表留言' })).toBeVisible();
  await expect(comments.locator('.comment-title')).toBeHidden();
  const request = page.waitForRequest((candidate) => (
    candidate.url() === 'https://api.pics.tchirek.top/api/comment' && candidate.method() === 'POST'
  ));
  const editor = comments.getByLabel('留言內容');
  await expect(comments.getByRole('button', { name: '留言', exact: true })).toBeDisabled();
  await expect(comments.locator('.editor-toolbar > button')).toHaveCount(3);
  await expect(comments.getByRole('button', { name: '項目清單' })).toHaveCount(0);
  await expect(comments.getByRole('button', { name: '連結' })).toHaveCount(0);
  await expect(comments.getByRole('button', { name: '新增區塊' })).toHaveCount(0);
  await editor.fill('粗體文字');
  await comments.getByRole('button', { name: '粗體' }).click();
  await expect(editor).toHaveValue('粗體文字');
  await editor.selectText();
  await comments.getByRole('button', { name: '粗體' }).click();
  await expect(editor).toHaveValue('**粗體文字**');
  await comments.getByRole('button', { name: '粗體' }).click();
  await expect(editor).toHaveValue('粗體文字');
  await comments.getByRole('button', { name: '粗體' }).click();
  await comments.getByRole('button', { name: '斜體' }).click();
  await expect(editor).toHaveValue('**_粗體文字_**');
  await comments.getByRole('button', { name: '斜體' }).click();
  await expect(editor).toHaveValue('**粗體文字**');
  await comments.getByRole('button', { name: '預覽' }).click();
  await expect(comments.locator('.editor-surface > .preview')).toBeVisible();
  await expect(comments.locator('.editor-surface > .preview strong')).toHaveText('粗體文字');
  await comments.getByRole('button', { name: '編輯' }).click();
  await expect(editor).toBeVisible();
  await editor.fill('Anonymous comments still work.');
  const anonymous = comments.getByText('匿名', { exact: true });
  const options = comments.locator('.composer-options');
  await anonymous.click();
  await expect(options).toHaveAttribute('open', '');
  await comments.getByRole('heading', { name: '發表留言' }).click();
  await expect(options).not.toHaveAttribute('open', '');
  await anonymous.click();
  await comments.getByLabel('暱稱').fill('Storage fallback');
  await comments.getByRole('button', { name: '留言', exact: true }).click();
  const published = await request;
  expect(published.postDataJSON()).toMatchObject({
    imageId: `blog:${articlePath}`,
    nickname: 'Storage fallback',
    content: 'Anonymous comments still work.',
  });
  expect(published.headers()['x-viewer-id']).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
  await expect(comments.locator('.comment')).toHaveCount(1);
});

test('SicSic keeps an anonymous viewer only for one browser session', async ({ page, browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'One real engine is sufficient for session storage semantics.');
  await mockBuiltCommentUi(page);
  const initialRead = page.waitForRequest((request) => request.url().includes('/api/comment?'));
  await page.goto(articlePath);
  await page.locator('#comments').scrollIntoViewIfNeeded();
  expect((await initialRead).headers()).not.toHaveProperty('x-viewer-id');

  const publish = async (target: Page, content: string) => {
    const comments = target.locator('#comments');
    await comments.getByLabel('留言內容').fill(content);
    const request = target.waitForRequest((candidate) => candidate.method() === 'POST' && candidate.url().endsWith('/api/comment'));
    await comments.getByRole('button', { name: '留言', exact: true }).click();
    const viewer = (await request).headers()['x-viewer-id'];
    await expect(comments.locator('.comment')).toHaveCount(1);
    return viewer;
  };
  const firstViewer = await publish(page, 'First session comment.');
  expect(firstViewer).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
  expect(await page.evaluate(() => ({
    local: localStorage.getItem('sicsic_blog_viewer'),
    session: sessionStorage.getItem('sicsic_blog_viewer'),
    legacy: sessionStorage.getItem('sicsic.viewerId.v1'),
  }))).toEqual({ local: null, session: firstViewer, legacy: null });

  await page.reload();
  await page.locator('#comments').scrollIntoViewIfNeeded();
  expect(await publish(page, 'Second session comment.')).toBe(firstViewer);

  const freshContext = await browser.newContext();
  try {
    const freshPage = await freshContext.newPage();
    await mockBuiltCommentUi(freshPage);
    const freshRead = freshPage.waitForRequest((request) => request.url().includes('/api/comment?'));
    await freshPage.goto(hostOrigin + articlePath);
    await freshPage.locator('#comments').scrollIntoViewIfNeeded();
    expect((await freshRead).headers()).not.toHaveProperty('x-viewer-id');
    const nextViewer = await publish(freshPage, 'Fresh session comment.');
    expect(nextViewer).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
    expect(nextViewer).not.toBe(firstViewer);
  } finally {
    await freshContext.close();
  }
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
  await expect(page.locator('.post-content')).toContainText('Twenty Ten never asked');
  await expect(page.locator('#comments iframe')).toHaveCount(0);
  await expect(page.locator('.comments-fallback')).toBeVisible();
  await page.goto('/search/');
  await expect(page.getByRole('link', { name: 'Archives', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
  await context.close();
});

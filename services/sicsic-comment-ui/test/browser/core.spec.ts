import { expect, test } from '@playwright/test';
import { setup, mount } from './support';
import { authOrigin, blogOrigin } from './fixtures/passport-broker';

const item = { id: 'one', imageId: 'inline', rootId: 'one', parentId: null, nickname: 'Published name',
  content: '**Safe text**', html: '<img src=x onerror="window.compromised=true">', createdAt: 1, likeCount: 0, likedByMe: false };
const headers = { 'Access-Control-Allow-Origin': blogOrigin, 'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Viewer-Id', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' };

test('body ignores server HTML and external images wait for an explicit click', async ({ context, page }) => {
  await setup(context);
  let imageRequests = 0;
  await context.route('https://tracker.example.test/**', route => { imageRequests++; return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }); });
  await context.route(`${authOrigin}/api/comment?**`, route => route.fulfill({ headers, json: { items: [{ ...item,
    content: '**Safe text** <script>window.compromised=true</script> [bad](javascript:alert(1)) ![external](https://tracker.example.test/pixel.svg)' }] } }));
  const panel = await mount(page, 'blog');
  const body = panel.locator('.comment-main > .markdown');
  await expect(body.locator('strong')).toHaveText('Safe text');
  await expect(body.locator('script, [onerror], a[href^="javascript:"]')).toHaveCount(0);
  await expect(body.locator('img')).toHaveCount(0);
  expect(imageRequests).toBe(0);
  await body.locator('button[data-comment-image]').click();
  await expect(body.locator('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect.poll(() => imageRequests).toBe(1);
  expect(await page.evaluate(() => 'compromised' in window)).toBe(false);
});

test('switching subjects starts the new read immediately and destroy cancels it', async ({ context, page }) => {
  await setup(context);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let slowStarted = false;
  await context.route(`${authOrigin}/api/comment?**`, async route => {
    const subject = new URL(route.request().url()).searchParams.get('imageId');
    if (subject === 'inline' || subject === 'slow') { slowStarted = true; await gate; }
    await route.fulfill({ headers, json: { items: [{ ...item, content: subject }] } }).catch(() => {});
  });
  const panel = await mount(page, 'blog');
  await expect.poll(() => slowStarted).toBe(true);
  await page.evaluate(() => (window as any).controller.update({ subject: 'new' }));
  await expect(panel.locator('.comment-main > .markdown')).toHaveText('new');
  await page.evaluate(() => (window as any).controller.update({ subject: '' }));
  await expect(panel.locator('.comment')).toHaveCount(0);
  slowStarted = false;
  await page.evaluate(() => (window as any).controller.update({ subject: 'slow' }));
  await expect.poll(() => slowStarted).toBe(true);
  await page.evaluate(() => (window as any).controller.destroy());
  release();
  await expect(panel).toBeEmpty();
});

test('failed writes restore likes and preserve the draft without exposing the hidden inline status', async ({ context, page }) => {
  await setup(context);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await context.route(url => url.origin === authOrigin && url.pathname.startsWith('/api/comment'), async route => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (method === 'GET') return route.fulfill({ headers, json: { items: [item] } });
    if (method === 'PUT') await gate;
    return route.fulfill({ status: 500, headers, json: { error: 'failed' } });
  });
  const panel = await mount(page, 'blog');
  const like = panel.locator('.like-button');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  release();
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await panel.locator('textarea').fill('Keep my draft');
  await panel.locator('.submit').click();
  await expect(panel.locator('.submit')).toBeEnabled();
  await expect(panel.locator('textarea')).toHaveValue('Keep my draft');
  await expect(panel.locator('.status')).toBeHidden();
  await expect(panel.locator('.status')).toHaveAttribute('aria-hidden', 'true');
});

test('clicking a public avatar preserves the historical handle without activating identity', async ({ context, page }) => {
  const { broker } = await setup(context);
  await context.route(`${authOrigin}/api/comment?**`, route => route.fulfill({ headers, json: { items: [{ ...item, verified: true, authorId: 'reader', authorBadge: 'none' }] } }));
  await context.route(`${authOrigin}/api/auth/profiles?**`, route => route.fulfill({ headers, json: { profiles: { reader: {
    username: 'reader', displayName: 'Current name', badge: 'none', avatar: null, bio: null, website: null, email: null
  } } } }));
  const panel = await mount(page, 'blog');
  await panel.locator('.comment-avatar').click();
  await expect(panel.locator('.profile-card .auth-id > .auth-muted')).toHaveText('@reader');
  expect(broker.calls).toEqual([]);
  await expect(panel.locator('.comment-name')).toHaveText('Published name');
});

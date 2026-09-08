import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { setup, mount, openIdentity, login } from './support';
import { account, authOrigin, blogOrigin, commentsOrigin, googleOrigin, sessionKey } from './fixtures/passport-broker';
test('one password login continues on Pics, Blog and Docs without any popup; logout revokes all copies', async ({ context, page }) => {
  const { broker, publications } = await setup(context);
  const first = await mount(page, 'blog');
  expect(broker.calls).toEqual([]);
  let popups = 0;
  page.on('popup', () => popups++);
  await login(first, context, broker.setCookies);
  const token = broker.token();
  expect(await first.evaluate((_el, key) => localStorage.getItem(key), sessionKey)).toBeNull();
  for (const kind of ['normalpics', 'normaldocs', 'blog'] as const) {
    await page.goto('about:blank');
    const comments = await mount(page, kind);
    await comments.evaluate((_el, key) => localStorage.removeItem(key), sessionKey);
    await openIdentity(comments);
    await expect(comments.locator('.account')).toHaveClass(/signed-in/);
    await expect(comments.locator('.account-label')).toHaveText(account.displayName);
    expect(broker.calls.some(call => call.path === '/api/auth/sso/session' && call.hasCookie)).toBe(true);
    await page.keyboard.press('Escape');
    await comments.locator('textarea').fill(`Signed in on ${kind}`);
    await comments.locator('.submit').click();
    await expect.poll(() => publications.some(item => item.content === `Signed in on ${kind}` && item.authorization === `Bearer ${token}`)).toBe(true);
  }
  const comments = page.locator('#comments');
  await openIdentity(comments);
  await comments.locator('.auth-foot .danger').click();
  await expect(comments.locator('.account')).not.toHaveClass(/signed-in/);
  await expect(comments.locator('.account-label')).toHaveText('登录');
  expect(broker.authorized(token)).toBe(false);
  const panel = await mount(page, 'normalpics');
  await panel.evaluate((_el, data) => localStorage.setItem(data.key, data.token), { key: sessionKey, token });
  await openIdentity(panel);
  await expect(page.frameLocator('#panel-frame').locator('.auth-entry-card')).toBeVisible();
  await expect(panel.locator('.account')).not.toHaveClass(/signed-in/);
  expect(broker.loginCount()).toBe(1);
  expect(popups).toBe(0);
});

test('Google opens directly and PKCE polling works with no WindowProxy or opener', async ({ context, page }) => {
  const { broker, requests } = await setup(context);
  await context.addInitScript(() => {
    const open = window.open.bind(window);
    window.open = (...args) => { open(...args); return null; };
  });
  const comments = await mount(page, 'normalpics');
  await openIdentity(comments);
  const dialog = page.frameLocator('#panel-frame').locator('.auth-entry-card');
  const google = dialog.getByRole('button', { name: '使用 Google 登录' });
  await expect(google).toBeEnabled();
  const opened = context.waitForEvent('page');
  await google.click();
  const popup = await opened;
  await expect(popup.getByRole('heading', { name: 'Fixture Google sign-in' })).toBeVisible();
  expect(new URL(popup.url()).origin).toBe(googleOrigin);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  expect(context.pages()).toHaveLength(2);
  const callback = popup.waitForResponse(response => response.url().includes('/callback/google'));
  await popup.getByRole('link', { name: 'Complete Google sign-in' }).click();
  expect((await callback).status()).toBe(200);
  await expect(comments.locator('.account')).toHaveClass(/signed-in/);
  const start = broker.calls.find(call => call.path === '/api/auth/google/start')!;
  const poll = broker.calls.find(call => call.path === '/api/auth/google/result')!;
  expect(createHash('sha256').update(poll.body.codeVerifier).digest('base64url')).toBe(start.body.codeChallenge);
  expect(requests.some(url => url.includes(poll.body.codeVerifier) || url.includes(broker.token()))).toBe(false);
  await popup.close();
  const blog = await mount(page, 'blog');
  await openIdentity(blog);
  await expect(blog.locator('.account')).toHaveClass(/signed-in/);
  expect(broker.loginCount()).toBe(0);
});

test('failed password and unavailable continuity keep the login form usable without popups', async ({ context, page }) => {
  const { broker } = await setup(context);
  broker.failSession();
  const comments = await mount(page, 'normalpics');
  let popups = 0;
  page.on('popup', () => popups++);
  await openIdentity(comments);
  const dialog = page.frameLocator('#panel-frame').locator('.auth-entry-card');
  await dialog.locator('[autocomplete="username"]').fill('wrong');
  await dialog.locator('[autocomplete="current-password"]').fill('wrong');
  await dialog.locator('.auth-submit').click();
  await expect(dialog.locator('.auth-error')).toContainText('用户名或密码错误');
  await expect(dialog.locator('.auth-error')).not.toContainText('弹窗');
  expect(popups).toBe(0);
});

test('slow continuity shows a complete login form first and never replaces a draft', async ({ context, page }) => {
  const { broker, requests } = await setup(context);
  await login(await mount(page, 'blog'), context, broker.setCookies);
  const panel = await mount(page, 'normalpics');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await context.route(`${authOrigin}/api/auth/sso/session`, async route => {
    await gate;
    await route.fallback();
  });
  const before = broker.calls.length;
  await panel.locator('.account').hover();
  await expect.poll(() => requests.some(url => url.startsWith(commentsOrigin) && /\/passport[-.]/.test(url))).toBe(true);
  expect(broker.calls).toHaveLength(before);
  await panel.evaluate(() => {
    const observer = new MutationObserver(() => {
      const dialog = document.querySelector('.auth-card');
      if (!dialog) return;
      document.documentElement.dataset.firstAccountDialog = dialog.querySelector('[autocomplete="username"]') ? 'login' : 'placeholder';
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  await openIdentity(panel);
  const frame = page.frameLocator('#panel-frame');
  await expect(frame.getByRole('dialog')).toBeVisible({ timeout: 1000 });
  await expect(frame.locator('html')).toHaveAttribute('data-first-account-dialog', 'login');
  const draft = frame.locator('[autocomplete="username"]');
  await expect(draft).toBeVisible({ timeout: 1000 });
  await draft.fill('my unfinished login');
  const restored = page.waitForResponse(`${authOrigin}/api/auth/sso/session`);
  release();
  await restored;
  await expect(draft).toHaveValue('my unfinished login');
  await expect(panel.locator('.account')).not.toHaveClass(/signed-in/);
  await page.keyboard.press('Escape');
  await expect(frame.getByRole('dialog')).toHaveCount(0);
  await openIdentity(panel);
  await expect(panel.locator('.account')).toHaveClass(/signed-in/);
});

test('the frame attribution links to the public SicSic repository', async ({ context, page }) => {
  await setup(context);
  const comments = await mount(page, 'normaldocs');
  await expect(comments.locator('.source-link')).toHaveAttribute('href', 'https://github.com/Tchirek/SicSic');
});

test('rapid likes stay optimistic, coalesce writes, and keep the reply label still', async ({ context, page }) => {
  await setup(context);
  const items = [0, 1].map(index => ({
    id: `like-${index}`, imageId: 'sso:normalpics', rootId: `like-${index}`, parentId: null,
    nickname: `Reader ${index}`, content: 'A comment', html: '<p>A comment</p>',
    createdAt: index + 1, likeCount: 0, likedByMe: false
  }));
  const writes: Array<{ liked: boolean; release: () => void }> = [];
  await context.route(url => url.origin === authOrigin && url.pathname.startsWith('/api/comment'), async route => {
    const req = route.request();
    const headers = { 'Access-Control-Allow-Origin': commentsOrigin, 'Access-Control-Allow-Headers': 'Content-Type,X-Viewer-Id', 'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (req.method() === 'GET') return route.fulfill({ headers, json: { items } });
    const liked = req.postDataJSON().liked as boolean;
    await new Promise<void>(release => { writes.push({ liked, release }); });
    return route.fulfill({ headers, json: { likedByMe: liked, likeCount: Number(liked) } });
  });
  const panel = await mount(page, 'normalpics');
  const comment = panel.locator('[data-id="like-0"]');
  const like = comment.locator('.like-button');
  const reply = comment.getByRole('button', { name: '回复', exact: true });
  const before = await reply.boundingBox();
  for (const pressed of [true, false, true, false]) {
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', String(pressed));
    expect(await reply.boundingBox()).toEqual(before);
  }
  await expect.poll(() => writes.length).toBe(1);
  writes[0].release();
  await expect.poll(() => writes.length).toBe(2);
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  writes[1].release();
  expect(writes.map(write => write.liked)).toEqual([true, false]);
  await expect(like.locator('span')).toHaveText('');
  expect(await reply.boundingBox()).toEqual(before);
});

test('the account handle keeps its historical position beside the editable nickname', async ({ context, page }) => {
  const { broker } = await setup(context);
  await login(await mount(page, 'blog'), context, broker.setCookies);
  const panel = await mount(page, 'normalpics');
  await openIdentity(panel);
  const frame = page.frameLocator('#panel-frame');
  const handle = frame.locator('.auth-name-row > .auth-handle');
  await expect(handle).toHaveText(`@${account.username}`);
  await expect(handle).toBeVisible();
  await frame.locator('.auth-name').click();
  await frame.getByPlaceholder('昵称（留空恢复默认）').fill('A very long nickname for editing');
  await frame.locator('.auth-name-editor').getByRole('button', { name: '取消', exact: true }).click();
  await expect(handle).toHaveText(`@${account.username}`);
  await expect(handle).toBeInViewport();
});

test('blocked local storage still permits cookie-based continuity', async ({ context, page }) => {
  const { broker } = await setup(context);
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  const comments = await mount(page, 'blog');
  await login(comments, context, broker.setCookies);
  const panel = await mount(page, 'normaldocs');
  await openIdentity(panel);
  await expect(panel.locator('.account')).toHaveClass(/signed-in/);
  expect(broker.calls.some(call => call.path === '/api/auth/sso/session' && call.hasCookie)).toBe(true);
});

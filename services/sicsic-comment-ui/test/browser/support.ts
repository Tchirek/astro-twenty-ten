import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {
  account, authOrigin, blogOrigin, commentsOrigin, docsOrigin, googleOrigin, mockPassportBroker, picsOrigin, sessionKey,
} from './fixtures/passport-broker';

const articlePath = '/2026/08/23/twenty-ten-on-astro/';
const docsApi = 'https://api.docs.tchirek.top';
const contentTypes: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
};

async function serveBuild(context: BrowserContext, origin: string, directory: string) {
  const root = resolve(directory);
  await context.route((url) => url.origin === origin, async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    const target = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    if (!target.startsWith(root + sep)) return route.abort();
    try {
      await route.fulfill({ body: await readFile(target), contentType: contentTypes[extname(target)] || 'application/octet-stream',
        headers: origin === commentsOrigin ? {
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src https: data:; connect-src ${authOrigin} ${docsApi}; frame-ancestors ${picsOrigin} ${docsOrigin}; base-uri 'none'; form-action 'none'; object-src 'none'`,
        } : {},
      });
    } catch {
      await route.fulfill({ status: 404, body: 'Not found' });
    }
  });
}

export async function setup(context: BrowserContext) {
  // Every production-looking origin in this test is fulfilled locally, including popup navigation.
  await context.route('**/*', (route) => route.abort());
  const broker = await mockPassportBroker(context);
  const requests: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  await serveBuild(context, blogOrigin, 'dist');
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
  await context.route(blogOrigin + articlePath, route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><link rel="stylesheet" href="/' + manifest['index.html'].css[0] + '"></head><body><div id="comments"></div><script type="module">' +
    'import { init } from "/' + manifest['src/core.ts'].file + '"; window.controller = init({ el: "#comments", serverURL: "' + authOrigin + '", subject: "inline", integration: "inline", sessionBroker: true });' +
    '</script></body></html>' }));
  await serveBuild(context, commentsOrigin, 'dist');
  for (const [origin, preset] of [[picsOrigin, 'normalpics'], [docsOrigin, 'normaldocs']]) {
    await context.route((url) => url.origin === origin, (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><script>
        addEventListener('message', event => {
          const frame = document.querySelector('iframe');
          if (event.origin !== ${JSON.stringify(commentsOrigin)} || event.source !== frame.contentWindow) return;
          if (event.data?.type === 'comment-ui:ready') frame.contentWindow.postMessage(
            ${JSON.stringify({ type: 'normalpics:context', imageId: `sso:${preset}` })}, ${JSON.stringify(commentsOrigin)});
        });
      </script><iframe id="panel-frame" title="Comments" width="420" height="720"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        src="${commentsOrigin}/?preset=${preset}"></iframe></body></html>`,
    }));
  }
  const publications: Array<{ origin: string; content: string; authorization?: string; viewer?: string }> = [];
  await context.route((url) => [authOrigin, docsApi].includes(url.origin) && url.pathname === '/api/comment', async (route) => {
    const request = route.request();
    const headers = await request.allHeaders();
    const responseHeaders = {
      'Access-Control-Allow-Origin': headers.origin || blogOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Viewer-Id',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: responseHeaders });
    if (request.method() === 'POST') {
      if (headers.authorization && !broker.authorized(headers.authorization.replace(/^Bearer /, ''))) {
        return route.fulfill({ status: 401, headers: responseHeaders, body: '{"error":"unauthorized"}' });
      }
      const payload = request.postDataJSON() as { content: string };
      publications.push({ origin: new URL(request.url()).origin, content: payload.content, authorization: headers.authorization, viewer: headers['x-viewer-id'] });
      return route.fulfill({ status: 201, headers: responseHeaders, body: '{"id":"sso-comment"}' });
    }
    return route.fulfill({ headers: responseHeaders, body: '{"items":[]}' });
  });
  return { broker, publications, requests };
}

export async function mount(page: Page, kind: 'blog' | 'normalpics' | 'normaldocs') {
  await page.goto(kind === 'blog' ? blogOrigin + articlePath : kind === 'normalpics' ? picsOrigin : docsOrigin);
  const comments = kind === 'blog' ? page.locator('#comments') : page.frameLocator('#panel-frame').locator('#app');
  await comments.scrollIntoViewIfNeeded();
  await expect(comments.locator('textarea')).toBeVisible();
  return comments;
}

export async function openIdentity(comments: Locator) {
  const drawer = comments.locator('.composer-options');
  if (await drawer.count() && await drawer.getAttribute('open') === null) await drawer.locator('summary').click();
  await comments.locator('.account').click();
}

async function expectPrivateCookie(context: BrowserContext, setCookies: string[], name: string) {
  const cookie = (await context.cookies(authOrigin)).find((cookie) => cookie.name === name);
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, path: '/' });
  // Windows WebKit reports SameSite=None even for a fulfilled Lax response; check the sent header.
  expect(setCookies.find((header) => header.startsWith(`${name}=`))).toMatch(/;\s*SameSite=Lax(?:;|$)/i);
}

export async function login(comments: Locator, context: BrowserContext, setCookies: string[]) {
  await openIdentity(comments);
  const dialog = comments.locator('.auth-entry-card');
  await expect(dialog).toBeVisible();
  await dialog.locator('[autocomplete="username"]').fill(account.username!);
  await dialog.locator('[autocomplete="current-password"]').fill('test-only-password');
  await dialog.locator('.auth-submit').click();
  await expect(comments.locator('.account')).toHaveClass(/signed-in/);
  await expect.poll(async () => (await context.cookies(authOrigin)).some((cookie) => cookie.name === '__Host-sicsic-session')).toBe(true);
  await expectPrivateCookie(context, setCookies, '__Host-sicsic-session');
}

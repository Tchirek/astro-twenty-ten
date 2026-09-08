import { createHash, randomBytes } from 'node:crypto';
import type { BrowserContext, Route } from '@playwright/test';
import type { AccountUser } from '../../../src/types';

export const authOrigin = 'https://api.pics.tchirek.top';
export const blogOrigin = 'https://blog.tchirek.top';
export const commentsOrigin = 'https://comments.sicnu.pics.tchirek.top';
export const picsOrigin = 'https://sicnu.pics.tchirek.top';
export const docsOrigin = 'https://sicnu.docs.tchirek.top';
export const googleOrigin = 'https://accounts.google.com';
export const sessionKey = `comment_ui_session@${authOrigin}`;
const cookieName = '__Host-sicsic-session';
const allowed = [authOrigin, blogOrigin, commentsOrigin, 'http://127.0.0.1:4173'];
const random = () => randomBytes(32).toString('base64url');
const challenge = (value: string) => createHash('sha256').update(value).digest('base64url');
export const account: AccountUser = {
  id: 'cross-origin-reader', username: 'sso-reader', displayName: 'Shared Reader',
  email: 'reader@example.test', emailVerified: true, badge: 'cockade', hasPassword: true,
  googleLinked: false, avatar: null, bio: null, showBio: false, website: null,
  publicEmailMode: 'none', publicEmail: null,
};

async function install(context: BrowserContext, emptyOnly = false) {
  const sessions = new Map<string, AccountUser>();
  const flows = new Map<string, { origin: string; challenge: string; nonce: string; token?: string }>();
  const calls: Array<{ path: string; origin: string; hasCookie: boolean; body: Record<string, string> }> = [];
  const setCookies: string[] = [];
  let lastToken = '';
  let loginCount = 0;
  let failSession = false;
  const cookie = (name: string, value: string) => {
    const result = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value ? 600 : 0}`;
    setCookies.push(result);
    return result;
  };
  async function handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const headers = await request.allHeaders();
    const origin = headers.origin || '';
    // Only actual request headers count. Never manufacture Cookie from a test jar.
    const cookies = new Map((headers.cookie || '').split(';').map(part => {
      const [key, value = ''] = part.trim().split('=');
      return [key, decodeURIComponent(value)];
    }));
    const saved = headers.authorization?.replace(/^Bearer /, '') || '';
    const central = cookies.get(cookieName) || '';
    const body = request.postData() ? request.postDataJSON() as Record<string, string> : {};
    const responseHeaders = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Cache-Control': 'no-store', Vary: 'Origin',
    };
    const json = (status: number, data: unknown, extra = {}) => route.fulfill({
      status, contentType: 'application/json', headers: { ...responseHeaders, ...extra }, body: JSON.stringify(data),
    });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: responseHeaders });
    calls.push({ path: url.pathname, origin, hasCookie: Boolean(central), body });
    if (url.pathname === '/api/auth/callback/google') {
      const state = url.searchParams.get('state') || '';
      const flow = flows.get(state);
      if (!flow || flow.token || cookies.get(`__Host-sicsic-oauth-${state}`) !== flow.nonce) return json(400, { error: 'invalid_state' });
      lastToken = `reader:${random()}`;
      sessions.set(lastToken, { ...account, googleLinked: true });
      flow.token = lastToken;
      return route.fulfill({ contentType: 'text/html', headers: { 'Set-Cookie': cookie(cookieName, lastToken) },
        body: '<!doctype html><h1>Signed in</h1>' });
    }
    if (!allowed.includes(origin)) return json(403, { error: 'invalid_origin' });
    if (url.pathname === '/api/auth/sso/session') {
      if (failSession) return json(503, { error: 'sso_unavailable' });
      const token = sessions.has(central) ? central : sessions.has(saved) ? saved : '';
      return json(200, { token, user: sessions.get(token) || null }, token && token !== central
        ? { 'Set-Cookie': cookie(cookieName, token) } : {});
    }
    if (url.pathname === '/api/auth/login') {
      if (body.identifier !== account.username || body.password !== 'test-only-password') return json(401, { error: 'invalid_credentials' });
      loginCount++;
      lastToken = `reader:${random()}`;
      sessions.set(lastToken, account);
      return json(200, { token: lastToken, user: account }, { 'Set-Cookie': cookie(cookieName, lastToken) });
    }
    if (url.pathname === '/api/auth/logout') {
      sessions.delete(saved);
      return json(200, { ok: true }, central === saved ? { 'Set-Cookie': cookie(cookieName, '') } : {});
    }
    if (url.pathname === '/api/auth/google/start') {
      if (origin !== body.origin || !/^[\w-]{43}$/.test(body.state) || !/^[\w-]{43}$/.test(body.codeChallenge)) return json(403, { error: 'invalid_origin' });
      const nonce = random();
      flows.set(body.state, { origin, challenge: body.codeChallenge, nonce });
      return json(200, { url: `${googleOrigin}/o/oauth2/v2/auth?state=${body.state}` },
        { 'Set-Cookie': cookie(`__Host-sicsic-oauth-${body.state}`, nonce) });
    }
    if (url.pathname === '/api/auth/google/result') {
      const flow = flows.get(body.state);
      if (!flow || origin !== flow.origin || challenge(body.codeVerifier) !== flow.challenge) return json(400, { error: 'invalid_grant' });
      if (!flow.token) return json(202, { pending: true });
      flows.delete(body.state);
      return json(200, { token: flow.token, user: sessions.get(flow.token) });
    }
    return json(404, { error: 'not_found' });
  }
  await context.route(url => url.origin === authOrigin && (emptyOnly
    ? ['/api/auth/sso/session', '/api/auth/google/start'].includes(url.pathname)
    : /^\/api\/auth\/(sso\/session|login|logout|google\/(start|result)|callback\/google)$/.test(url.pathname)), handle);
  await context.route(url => url.origin === googleOrigin, route => {
    const state = new URL(route.request().url()).searchParams.get('state') || '';
    return route.fulfill({ contentType: 'text/html', headers: { 'Cross-Origin-Opener-Policy': 'same-origin' },
      body: `<!doctype html><script>window.opener=null;</script><h1>Fixture Google sign-in</h1>
        <a href="${authOrigin}/api/auth/callback/google?state=${state}">Complete Google sign-in</a>` });
  });
  return { calls, setCookies, token: () => lastToken, loginCount: () => loginCount,
    authorized: (token: string) => sessions.has(token), failSession: () => { failSession = true; } };
}

export const mockPassportBroker = (context: BrowserContext) => install(context);
export async function mockEmptySessionBroker(context: BrowserContext): Promise<void> { await install(context, true); }

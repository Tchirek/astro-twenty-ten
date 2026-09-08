import { readResponse, record, requireShape } from './response';
import type { PassportConfig } from './config';
import type { AccountUser, BadgeKind, PublicProfile } from './types';

function joinUrl(origin: string, path: string): string {
  return origin ? `${origin}${path}` : path;
}

function validateUser(value: unknown): void {
  requireShape(record(value));
  for (const key of ['id', 'displayName']) requireShape(typeof value[key] === 'string' && Boolean(value[key]));
  for (const key of ['username', 'email', 'avatar', 'bio', 'website', 'publicEmail']) requireShape(value[key] === null || typeof value[key] === 'string');
  for (const key of ['emailVerified', 'hasPassword', 'googleLinked', 'showBio']) requireShape(typeof value[key] === 'boolean');
  requireShape(['none', 'cockade', 'seal'].includes(String(value.badge)));
  requireShape(['none', 'login', 'custom'].includes(String(value.publicEmailMode)));
}

function validateSession(body: Record<string, unknown>, allowAnonymous = false): void {
  requireShape(typeof body.token === 'string');
  if (allowAnonymous && body.user === null) { requireShape(body.token === ''); return; }
  requireShape(Boolean(body.token));
  validateUser(body.user);
}

export function createPassportApi(config: PassportConfig) {
  const authHeaders = (token: string): HeadersInit => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  });

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(joinUrl(config.authOrigin, path), { ...init, signal: init.signal || AbortSignal.timeout(15000) });
    const body = await readResponse(response);
    if (path === '/api/auth/sso/session') validateSession(body, true);
    else if (['/api/auth/login', '/api/auth/register/verify', '/api/auth/reset/verify'].includes(path)) validateSession(body);
    else if (['/api/auth/me', '/api/auth/profile', '/api/auth/email/verify'].includes(path)) validateUser(body.user);
    else if (path.startsWith('/api/auth/profiles?')) {
      requireShape(record(body.profiles));
      for (const value of Object.values(body.profiles)) {
        requireShape(record(value) && typeof value.displayName === 'string');
        for (const key of ['username', 'avatar', 'bio', 'website', 'email']) requireShape(value[key] === null || typeof value[key] === 'string');
        requireShape(['none', 'cockade', 'seal'].includes(String(value.badge)));
      }
    }
    return body as T;
  }

  return {
    session(token = ''): Promise<{ token: string; user: AccountUser | null }> {
      return request('/api/auth/sso/session', {
        method: 'POST', headers: token ? authHeaders(token) : { 'Content-Type': 'application/json' }, body: '{}',
        credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
    },
    registerStart(payload: { email: string; username: string; password: string }): Promise<unknown> {
      return request('/api/auth/register/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    },
    registerVerify(payload: { email: string; code: string }): Promise<{ token: string; user: AccountUser }> {
      return request('/api/auth/register/verify', {
        credentials: config.sessionBroker ? 'include' : 'omit',
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    },
    login(payload: { identifier: string; password: string }): Promise<{ token: string; user: AccountUser }> {
      return request('/api/auth/login', {
        credentials: config.sessionBroker ? 'include' : 'omit',
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    },
    resetStart(email: string): Promise<unknown> {
      return request('/api/auth/reset/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
    },
    resetVerify(payload: { email: string; code: string; password: string }): Promise<{ token: string; user: AccountUser }> {
      return request('/api/auth/reset/verify', {
        credentials: config.sessionBroker ? 'include' : 'omit',
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    },
    me(token: string): Promise<{ user: AccountUser }> {
      return request('/api/auth/me', { headers: authHeaders(token) });
    },
    profiles(ids: string[]): Promise<{ profiles: Record<string, PublicProfile> }> {
      return request(`/api/auth/profiles?ids=${encodeURIComponent(ids.join(','))}`);
    },
    updateProfile(
      token: string,
      patch: {
        displayName?: string;
        bio?: string;
        showBio?: boolean;
        website?: string;
        publicEmailMode?: 'none' | 'login' | 'custom';
        publicEmail?: string;
      }
    ): Promise<{ user: AccountUser }> {
      return request('/api/auth/profile', {
        method: 'POST', headers: authHeaders(token), body: JSON.stringify(patch)
      });
    },
    logout(token: string): Promise<unknown> {
      return request('/api/auth/logout', {
        method: 'POST', headers: authHeaders(token), body: '{}',
        credentials: config.sessionBroker ? 'include' : 'omit', cache: 'no-store',
      });
    },
    setPassword(token: string, payload: { currentPassword?: string; newPassword: string }): Promise<unknown> {
      return request('/api/auth/password', {
        method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload)
      });
    },
    emailStart(token: string, newEmail: string): Promise<unknown> {
      return request('/api/auth/email/start', {
        method: 'POST', headers: authHeaders(token), body: JSON.stringify({ newEmail })
      });
    },
    emailVerify(token: string, code: string): Promise<{ user: AccountUser }> {
      return request('/api/auth/email/verify', {
        method: 'POST', headers: authHeaders(token), body: JSON.stringify({ code })
      });
    },
    setBadge(token: string, badge: BadgeKind): Promise<{ badge: BadgeKind }> {
      return request('/api/auth/badge', {
        method: 'POST', headers: authHeaders(token), body: JSON.stringify({ badge })
      });
    },
    uploadAvatar(token: string, file: Blob): Promise<{ avatar: string }> {
      return request('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/webp', Authorization: `Bearer ${token}` },
        body: file
      });
    },
    removeAvatar(token: string): Promise<unknown> {
      return request('/api/auth/avatar', { method: 'DELETE', headers: authHeaders(token) });
    },
    googleStart(payload: { origin: string; state: string; codeChallenge: string }, signal: AbortSignal): Promise<{ url: string }> {
      return request('/api/auth/google/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        credentials: 'include', cache: 'no-store', signal,
      });
    },
    async googleResult(state: string, codeVerifier: string): Promise<{ pending?: boolean; token?: string; user?: AccountUser; error?: string }> {
      const response = await fetch(joinUrl(config.authOrigin, '/api/auth/google/result'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, codeVerifier }), credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
      const body = await readResponse(response);
      if (response.status === 202) { requireShape(body.pending === true); return { pending: true }; }
      validateSession(body);
      return body as { token: string; user: AccountUser };
    }
  };
}

export type PassportApi = ReturnType<typeof createPassportApi>;

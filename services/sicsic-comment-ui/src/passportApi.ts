import { ApiError } from './api';
import type { PassportConfig } from './config';
import type { AccountUser, BadgeKind, PublicProfile } from './types';

function joinUrl(origin: string, path: string): string {
  return origin ? `${origin}${path}` : path;
}

async function parseJson<T>(response: Response): Promise<T & { error?: string; retryAfterMs?: number }> {
  const text = await response.text();
  if (!text) return {} as T & { error?: string; retryAfterMs?: number };
  try {
    return JSON.parse(text) as T & { error?: string; retryAfterMs?: number };
  } catch {
    return {} as T & { error?: string; retryAfterMs?: number };
  }
}

export function createPassportApi(config: PassportConfig) {
  const authHeaders = (token: string): HeadersInit => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  });

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(joinUrl(config.authOrigin, path), init);
    const body = await parseJson<T>(response);
    if (!response.ok) throw new ApiError(body.error || `request_${response.status}`, body.retryAfterMs);
    return body;
  }

  return {
    registerStart(payload: { email: string; username: string; password: string }): Promise<unknown> {
      return request('/api/auth/register/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    },
    registerVerify(payload: { email: string; code: string }): Promise<{ token: string; user: AccountUser }> {
      return request('/api/auth/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    },
    login(payload: { identifier: string; password: string }): Promise<{ token: string; user: AccountUser }> {
      return request('/api/auth/login', {
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
      return request('/api/auth/logout', { method: 'POST', headers: authHeaders(token), body: '{}' });
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
    async googleResult(state: string): Promise<{ pending?: boolean; token?: string; user?: AccountUser; error?: string }> {
      const response = await fetch(joinUrl(config.authOrigin, `/api/auth/google/result?state=${encodeURIComponent(state)}`));
      const body = await parseJson<{ pending?: boolean; token?: string; user?: AccountUser; error?: string }>(response);
      if (response.status === 202) return body;
      if (!response.ok) throw new ApiError(body.error || `request_${response.status}`, body.retryAfterMs);
      return body;
    },
    googleStartUrl(origin: string, state?: string): string {
      const query = `origin=${encodeURIComponent(origin)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
      return joinUrl(config.authOrigin, `/api/auth/google/start?${query}`);
    }
  };
}

export type PassportApi = ReturnType<typeof createPassportApi>;

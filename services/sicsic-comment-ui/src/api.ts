import type { CommentUiConfig } from './config';
import type { CommentItem } from './types';

export class ApiError extends Error {
  readonly retryAfterMs: number | null;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'ApiError';
    this.retryAfterMs = Number.isFinite(retryAfterMs) ? Number(retryAfterMs) : null;
  }
}

export interface ApiContext {
  peekSessionViewerId: () => string;
  requireSessionViewerId: () => string;
  adminToken: () => string;
  sessionToken: () => string;
}

interface CommentPublishPayload {
  imageId: string;
  nickname: string;
  content: string;
  parentId: string | null;
  /** Opt-in: let the backend attach a coarse OS label from the User-Agent. */
  discloseOs?: boolean;
}

function joinUrl(origin: string, path: string): string {
  if (!origin) return path;
  return `${origin}${path}`;
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

export function createCommentApi(config: CommentUiConfig, context: ApiContext) {
  function readHeaders(viewerId = ''): HeadersInit {
    const result: Record<string, string> = {};
    if (viewerId) result['X-Viewer-Id'] = viewerId;
    const session = context.sessionToken();
    if (session) result.Authorization = `Bearer ${session}`;
    return result;
  }

  /** Session bearer for signed-in writes; anonymous writes carry a viewer id. */
  function writeHeaders(viewerId = ''): HeadersInit {
    return { 'Content-Type': 'application/json', ...readHeaders(viewerId) };
  }

  function adminHeaders(): HeadersInit {
    const result: Record<string, string> = { 'Content-Type': 'application/json' };
    if (context.adminToken()) result.Authorization = `Bearer ${context.adminToken()}`;
    return result;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(joinUrl(config.apiOrigin, path), init);
    const body = await parseJson<T>(response);
    if (!response.ok) throw new ApiError(body.error || `request_${response.status}`, body.retryAfterMs);
    return body;
  }

  return {
    list(imageId: string): Promise<{ items: CommentItem[]; commentedByMe?: boolean }> {
      return request<{ items: CommentItem[]; commentedByMe?: boolean }>(
        `/api/comment?imageId=${encodeURIComponent(imageId)}`,
        { headers: readHeaders(context.peekSessionViewerId()) }
      );
    },

    publish(payload: CommentPublishPayload): Promise<{ id?: string }> {
      return request('/api/comment', {
        method: 'POST',
        headers: writeHeaders(context.sessionToken() ? '' : context.requireSessionViewerId()),
        body: JSON.stringify(payload)
      });
    },

    editContent(commentId: string, content: string): Promise<CommentItem> {
      return request<CommentItem>(`/api/comment/${encodeURIComponent(commentId)}/content`, {
        method: 'PUT',
        headers: writeHeaders(),
        body: JSON.stringify({ content })
      });
    },

    setLike(commentId: string, liked: boolean): Promise<{ likedByMe: boolean; likeCount: number }> {
      return request<{ likedByMe: boolean; likeCount: number }>(`/api/comment/${encodeURIComponent(commentId)}`, {
        method: 'PUT',
        headers: writeHeaders(context.requireSessionViewerId()),
        body: JSON.stringify({ liked })
      });
    },

    deleteOwn(commentId: string): Promise<unknown> {
      return request(`/api/comment/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: writeHeaders()
      });
    },

    delete(commentId: string): Promise<unknown> {
      return request(`/api/comment/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: adminHeaders()
      });
    }
  };
}

import type { CommentUiConfig } from './config';
import type { CommentItem } from './types';

export { ApiError } from './response';
import { readResponse, record, requireShape } from './response';

function validateComment(value: unknown): void {
  requireShape(record(value));
  for (const key of ['id', 'imageId', 'rootId', 'nickname', 'content']) requireShape(typeof value[key] === 'string');
  requireShape(value.parentId === null || typeof value.parentId === 'string');
  requireShape(typeof value.createdAt === 'number' && Number.isFinite(value.createdAt));
  validateLike(value);
  for (const key of ['verified', 'ownedByMe', 'editable']) requireShape(value[key] === undefined || typeof value[key] === 'boolean');
  for (const key of ['authorId', 'authorAvatar', 'osLabel']) requireShape(value[key] == null || typeof value[key] === 'string');
  requireShape(value.authorBadge == null || ['none', 'cockade', 'seal'].includes(String(value.authorBadge)));
}

function validateLike(value: Record<string, unknown>): void {
  requireShape(typeof value.likedByMe === 'boolean' && typeof value.likeCount === 'number' && Number.isSafeInteger(value.likeCount) && value.likeCount >= 0);
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

  async function request<T>(path: string, init: RequestInit = {}, validate?: (body: Record<string, unknown>) => void): Promise<T> {
    const response = await fetch(joinUrl(config.apiOrigin, path), {
      ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
    });
    const body = await readResponse(response);
    validate?.(body);
    return body as T;
  }

  return {
    list(imageId: string, signal?: AbortSignal): Promise<{ items: CommentItem[]; commentedByMe?: boolean }> {
      return request<{ items: CommentItem[]; commentedByMe?: boolean }>(
        `/api/comment?imageId=${encodeURIComponent(imageId)}`,
        { headers: readHeaders(context.peekSessionViewerId()), signal },
        body => {
          requireShape(Array.isArray(body.items));
          body.items.forEach(validateComment);
          requireShape(body.commentedByMe === undefined || typeof body.commentedByMe === 'boolean');
        }
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
      }, validateComment);
    },

    setLike(commentId: string, liked: boolean): Promise<{ likedByMe: boolean; likeCount: number }> {
      return request<{ likedByMe: boolean; likeCount: number }>(`/api/comment/${encodeURIComponent(commentId)}`, {
        method: 'PUT',
        headers: writeHeaders(context.requireSessionViewerId()),
        body: JSON.stringify({ liked })
      }, validateLike);
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

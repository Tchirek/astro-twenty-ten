import type { CommentInitOptions } from './config';

interface RawFrameConfig {
  apiOrigin?: string;
  authOrigin?: string;
  allowedParentOrigins?: string[] | string;
  sourceRepoUrl?: string;
  storageNamespace?: string;
  title?: string;
  anonymousNickname?: string;
  features?: { auth?: boolean };
}

export interface FrameConfig {
  core: Omit<CommentInitOptions, 'el'>;
  allowedParentOrigins: Set<string>;
}

declare global {
  interface Window {
    COMMENT_UI_CONFIG?: RawFrameConfig;
  }
}

const DEFAULT_SOURCE_REPO_URL = '/sicsic-comment-ui-source.tar.gz';
const AUTH_BACKENDS = new Set(['https://api.pics.tchirek.top']);

const PRESETS: Record<string, RawFrameConfig> = {
  normalpics: {
    apiOrigin: 'https://api.pics.tchirek.top',
    allowedParentOrigins: ['https://sicnu.pics.tchirek.top', 'https://photohost-frontend.pages.dev'],
    storageNamespace: 'normalpics_comment',
    title: '评论',
    features: { auth: true }
  },
  normaldocs: {
    apiOrigin: 'https://api.docs.tchirek.top',
    authOrigin: 'https://api.pics.tchirek.top',
    allowedParentOrigins: ['https://sicnu.docs.tchirek.top'],
    storageNamespace: 'normaldocs_comment_ui',
    title: '评论',
    features: { auth: true }
  }
};

function env(): Record<string, string | undefined> {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
}

function splitList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function readFrameConfig(): FrameConfig {
  const runtimeEnv = env();
  const presetName = new URLSearchParams(window.location.search).get('preset') || 'normalpics';
  const raw = { ...(PRESETS[presetName] || PRESETS.normalpics), ...(window.COMMENT_UI_CONFIG ?? {}) };
  const apiOrigin = raw.apiOrigin || runtimeEnv.VITE_COMMENT_API_ORIGIN || '';
  const authOrigin = raw.authOrigin || runtimeEnv.VITE_COMMENT_AUTH_ORIGIN || apiOrigin;
  const configuredOrigins = splitList(raw.allowedParentOrigins);
  const origins = configuredOrigins.length ? configuredOrigins : splitList(runtimeEnv.VITE_ALLOWED_PARENT_ORIGINS);
  const explicitPassport = raw.features?.auth;
  const envPassport = runtimeEnv.VITE_COMMENT_AUTH;
  const passport = explicitPassport ?? (envPassport === undefined ? AUTH_BACKENDS.has(authOrigin) : envPassport === 'true');

  return {
    core: {
      serverURL: apiOrigin,
      authURL: authOrigin,
      locale: 'zh-CN',
      integration: 'frame',
      rootOrder: 'ranked',
      storageNamespace: raw.storageNamespace || runtimeEnv.VITE_STORAGE_NAMESPACE || 'comment_ui',
      sourceRepoUrl: raw.sourceRepoUrl || runtimeEnv.VITE_SOURCE_REPO_URL || DEFAULT_SOURCE_REPO_URL,
      title: raw.title || runtimeEnv.VITE_COMMENT_TITLE || '评论',
      anonymousNickname: raw.anonymousNickname || runtimeEnv.VITE_ANONYMOUS_NICKNAME || 'Anonymous',
      passport
    },
    allowedParentOrigins: new Set(
      origins.map(normalizeOrigin).filter((origin): origin is string => Boolean(origin))
    )
  };
}

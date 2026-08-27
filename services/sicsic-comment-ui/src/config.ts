export type CommentLocale = 'zh-CN' | 'zh-TW';
export type CommentIntegration = 'inline' | 'frame';
export type CommentRootOrder = 'chronological' | 'ranked';

export interface CommentInitOptions {
  el: HTMLElement | string;
  serverURL: string;
  authURL?: string;
  subject?: string;
  locale?: CommentLocale;
  integration?: CommentIntegration;
  rootOrder?: CommentRootOrder;
  storageNamespace?: string;
  viewerStorageKey?: string;
  sourceRepoUrl?: string;
  title?: string;
  anonymousNickname?: string;
  passport?: boolean;
  viewerId?: string;
  adminToken?: string;
}

export interface CommentUpdate {
  subject?: string;
  viewerId?: string;
  adminToken?: string;
}

export interface CommentUiConfig {
  apiOrigin: string;
  authOrigin: string;
  sourceRepoUrl: string;
  nicknameStorageKey: string;
  commentedImagesStorageKey: string;
  viewerStorageKey: string;
  discloseOsStorageKey: string;
  sessionStorageKey: string;
  legacySessionStorageKey: string;
  title: string;
  anonymousNickname: string;
  locale: CommentLocale;
  integration: CommentIntegration;
  rootOrder: CommentRootOrder;
  capabilities: { passport: boolean };
}

export interface PassportConfig {
  apiOrigin: string;
  authOrigin: string;
  sessionStorageKey: string;
  legacySessionStorageKey: string;
  locale: CommentLocale;
}

const DEFAULT_SOURCE_REPO_URL = '/sicsic-comment-ui-source.tar.gz';

export function normalizeApiOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  if (trimmed.startsWith('/')) return trimmed.replace(/\/+$/, '');
  return trimmed.replace(/\/+$/, '');
}

export function resolveConfig(options: CommentInitOptions): CommentUiConfig {
  const storageNamespace = options.storageNamespace || 'comment_ui';
  const apiOrigin = normalizeApiOrigin(options.serverURL);
  const authOrigin = normalizeApiOrigin(options.authURL || '') || apiOrigin;
  const integration = options.integration || 'inline';
  const locale = options.locale || 'zh-CN';

  return {
    apiOrigin,
    authOrigin,
    sourceRepoUrl: options.sourceRepoUrl || DEFAULT_SOURCE_REPO_URL,
    nicknameStorageKey: `${storageNamespace}_nickname`,
    commentedImagesStorageKey: `${storageNamespace}_commented_images`,
    discloseOsStorageKey: `${storageNamespace}_disclose_os`,
    viewerStorageKey: options.viewerStorageKey || `${storageNamespace}_viewer`,
    sessionStorageKey: authOrigin ? `comment_ui_session@${authOrigin}` : `${storageNamespace}_session`,
    legacySessionStorageKey: `${storageNamespace}_session`,
    title: options.title || (locale === 'zh-TW' ? '迴響' : '评论'),
    anonymousNickname: options.anonymousNickname || 'Anonymous',
    locale,
    integration,
    rootOrder: options.rootOrder || 'chronological',
    capabilities: { passport: options.passport !== false }
  };
}

import { ApiError, createCommentApi } from './api';
import type { CommentInitOptions, CommentUpdate } from './config';
import { resolveConfig } from './config';
import { commentNickname, renderComments } from './comments';
import { mountApp } from './dom';
import type { AccountUser, CommentAppState, CommentItem } from './types';

export interface CommentHooks {
  onClose?: () => void;
  onLoaded?: (detail: { subject: string; commentCount: number; commentedByMe: boolean }) => void;
}

export interface CommentController {
  update(next: CommentUpdate): void;
  destroy(): void;
}

function resolveElement(value: HTMLElement | string): HTMLElement {
  const element = typeof value === 'string' ? document.querySelector<HTMLElement>(value) : value;
  if (!element) throw new Error('missing_app_root');
  return element;
}

function createViewerId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) => value.toString(16).padStart(8, '0')).join('-');
}

export function init(options: CommentInitOptions, hooks: CommentHooks = {}): CommentController {
  const config = resolveConfig(options);
  const appRoot = resolveElement(options.el);
  appRoot.dataset.sicsicIntegration = config.integration;
  const elements = mountApp(appRoot, config);
  const validViewerId = (value: string) => /^[A-Za-z0-9_-]{16,80}$/.test(value);

  function peekViewerId(): string {
    try {
      const stored = sessionStorage.getItem(config.viewerStorageKey) || '';
      return validViewerId(stored) ? stored : '';
    } catch {
      return '';
    }
  }

  const state: CommentAppState = {
    imageId: options.subject || '',
    viewerId: options.viewerId && validViewerId(options.viewerId) ? options.viewerId : peekViewerId(),
    adminToken: options.adminToken || '',
    replyTo: null,
    comments: [],
    loadedImageId: '',
    loading: false,
    loadAgain: false,
    loadError: '',
    previewing: false
  };
  const pendingLikes = new Set<string>();
  let editingId = '';
  let destroyed = false;
  let fallbackViewerId = '';
  let publishing = false;
  let memoryCommentedImages = new Set<string>();
  let passport: import('./passport').Passport | null = null;
  let passportPromise: Promise<import('./passport').Passport | null> | null = null;
  let accountRefreshed = false;
  let markdownPromise: Promise<typeof import('./markdown')> | null = null;

  const api = createCommentApi(config, {
    peekSessionViewerId: () => state.viewerId || (state.viewerId = peekViewerId()),
    requireSessionViewerId: requireViewerId,
    adminToken: () => state.adminToken,
    // A public-profile click must not silently activate our saved account.
    sessionToken: () => passport?.account() ? passport.token() : ''
  });

  function requireViewerId(): string {
    if (state.viewerId) return state.viewerId;
    try {
      const created = createViewerId();
      sessionStorage.setItem(config.viewerStorageKey, created);
      return (state.viewerId = created);
    } catch {
      fallbackViewerId ||= createViewerId();
      return (state.viewerId = fallbackViewerId);
    }
  }

  function readCommentedImages(): Set<string> {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(config.commentedImagesStorageKey) || '[]');
      if (Array.isArray(parsed)) {
        memoryCommentedImages = new Set(parsed.filter((item): item is string => typeof item === 'string' && item.length > 0));
      }
    } catch {
      /* retain the current-page hint when storage is blocked */
    }
    return new Set(memoryCommentedImages);
  }

  function hasLocalCommentedImage(imageId: string): boolean {
    return readCommentedImages().has(imageId);
  }

  function markLocalCommentedImage(imageId: string): void {
    const values = readCommentedImages();
    values.add(imageId);
    memoryCommentedImages = new Set(Array.from(values).slice(-500));
    try {
      sessionStorage.setItem(config.commentedImagesStorageKey, JSON.stringify(Array.from(memoryCommentedImages)));
    } catch {
      /* storage is a best-effort continuity hint */
    }
  }

  function formatCooldown(value: number | null): string {
    const milliseconds = Math.max(1_000, value || 0);
    const hours = Math.ceil(milliseconds / 3_600_000);
    if (config.locale === 'zh-TW') return hours >= 24 ? `約 ${Math.ceil(hours / 24)} 天後` : `約 ${hours} 小時後`;
    return hours >= 24 ? `约 ${Math.ceil(hours / 24)} 天后` : `约 ${hours} 小时后`;
  }

  async function updatePreview(): Promise<void> {
    const value = elements.textarea.value;
    try {
      markdownPromise ||= import('./markdown');
      const { renderSafeMarkdown } = await markdownPromise;
      if (!destroyed && state.previewing && value === elements.textarea.value) {
        elements.preview.innerHTML = renderSafeMarkdown(value, config.locale);
      }
    } catch {
      markdownPromise = null;
      if (!destroyed) elements.preview.textContent = config.locale === 'zh-TW' ? '預覽載入失敗，請重試' : '预览加载失败，请重试';
    }
  }

  function setPreview(visible: boolean): void {
    state.previewing = visible;
    elements.preview.hidden = !visible;
    elements.textarea.hidden = visible;
    const traditional = config.locale === 'zh-TW';
    elements.previewToggle.textContent = visible ? (traditional ? '編輯' : '编辑') : (traditional ? '預覽' : '预览');
    if (visible) void updatePreview();
  }

  function setReplyTarget(item: CommentItem | null): void {
    state.replyTo = item;
    elements.replyTarget.hidden = !item;
    if (!item) return;
    const nickname = commentNickname(item.nickname, config.anonymousNickname);
    elements.replyTarget.textContent = config.locale === 'zh-TW'
      ? `回覆 ${nickname} · 點擊取消`
      : `回复 ${nickname} · 点击取消`;
    elements.textarea.focus();
  }

  async function ensurePassport(refreshAccount: boolean): Promise<import('./passport').Passport | null> {
    if (!config.capabilities.passport) return null;
    passportPromise ||= import('./passport').then(({ createPassport }) => {
      if (destroyed) return null;
      passport = createPassport({
        config,
        container: config.integration === 'inline' ? appRoot : document.body,
        anonymousNickname: config.anonymousNickname,
        onChange: onAccountChange
      });
      return passport;
    }).catch(() => {
      passportPromise = null;
      if (!destroyed) elements.status.textContent = config.locale === 'zh-TW' ? '帳戶功能載入失敗，請重試' : '账户功能加载失败，请重试';
      return null;
    });
    const loaded = await passportPromise;
    if (!loaded || destroyed) return null;
    if (refreshAccount && !accountRefreshed) {
      accountRefreshed = true;
      await loaded.refresh();
    }
    return destroyed ? null : loaded;
  }

  function onAccountChange(account: AccountUser | null): void {
    if (destroyed) return;
    const accountLabel = elements.accountButton.querySelector('.account-label');
    const identityLabel = elements.app.querySelector('details > summary');
    if (identityLabel) identityLabel.textContent = account?.displayName || '匿名';
    if (account) {
      elements.nickname.hidden = true;
      elements.composerIdentity.hidden = false;
      elements.composerIdentity.textContent = config.locale === 'zh-TW'
        ? `以 ${account.displayName} 發表`
        : `以 ${account.displayName} 发表`;
      elements.accountButton.classList.add('signed-in');
      if (accountLabel) accountLabel.textContent = account.displayName;
    } else {
      elements.nickname.hidden = false;
      elements.composerIdentity.hidden = true;
      elements.accountButton.classList.remove('signed-in');
      if (accountLabel) accountLabel.textContent = config.locale === 'zh-TW' ? '登入' : '';
    }
    editingId = '';
    render();
    if (state.imageId) void load();
  }

  function render(): void {
    if (destroyed) return;
    const loaded = state.loadedImageId === state.imageId;
    elements.app.classList.toggle('has-comments', loaded && state.comments.length > 0);
    if (config.integration === 'inline') {
      const showTitle = loaded && state.comments.length > 0;
      elements.commentTitle.textContent = config.locale === 'zh-TW'
        ? `${state.comments.length} 則迴響`
        : `${state.comments.length} 条评论`;
      elements.commentTitle.hidden = !showTitle;
      elements.header.hidden = !showTitle;
      elements.header.classList.toggle('no-comment-title', !showTitle);
    }
    renderComments(elements, state, {
      anonymousNickname: config.anonymousNickname,
      adminEnabled: Boolean(state.adminToken),
      accountEnabled: config.capabilities.passport,
      apiOrigin: config.apiOrigin,
      authOrigin: config.authOrigin,
      editingId,
      locale: config.locale,
      rootOrder: config.rootOrder,
      showSkeleton: config.integration === 'frame',
      onShowProfile: (item) => void ensurePassport(false).then((value) => value?.openProfile(item)),
      onReply: setReplyTarget,
      onLike: (item) => void toggleLike(item),
      onDelete: (item) => void deleteComment(item),
      onEdit: (item) => {
        editingId = item.id;
        render();
      },
      onEditCancel: () => {
        editingId = '';
        render();
      },
      onEditSave: (item, content) => void saveEdit(item, content),
      onAvatarEdit: () => void ensurePassport(true).then((value) => value?.open())
    });
  }

  async function load(): Promise<void> {
    if (!state.imageId || destroyed) return;
    if (state.loading) {
      state.loadAgain = true;
      return;
    }
    state.loading = true;
    state.loadError = '';
    const requestedImageId = state.imageId;
    elements.status.textContent = '';
    if (config.integration === 'frame') render();
    try {
      const response = await api.list(requestedImageId);
      if (destroyed || requestedImageId !== state.imageId) return;
      state.comments = response.items;
      state.loadedImageId = requestedImageId;
      hooks.onLoaded?.({
        subject: requestedImageId,
        commentCount: response.items.length,
        commentedByMe: Boolean(response.commentedByMe) || hasLocalCommentedImage(requestedImageId)
      });
    } catch (error) {
      if (requestedImageId === state.imageId) {
        state.loadError = error instanceof Error ? error.message : (config.locale === 'zh-TW' ? '載入失敗' : '加载失败');
        state.loadedImageId = requestedImageId;
      }
      elements.status.textContent = state.loadError;
    } finally {
      state.loading = false;
      render();
      if (state.loadAgain) {
        state.loadAgain = false;
        void load();
      }
    }
  }

  async function saveEdit(item: CommentItem, content: string): Promise<void> {
    const next = content.trim();
    if (!next) return;
    try {
      await api.editContent(item.id, next);
      editingId = '';
      await load();
    } catch (error) {
      elements.status.textContent = error instanceof ApiError && error.message === 'edit_limit'
        ? (config.locale === 'zh-TW' ? '每則留言僅可編輯一次' : '每条评论仅可编辑一次')
        : (config.locale === 'zh-TW' ? '編輯失敗' : '编辑失败');
    }
  }

  function focusComment(commentId: string): void {
    const node = elements.list.querySelector<HTMLElement>(`article[data-id="${CSS.escape(commentId)}"]`);
    if (!node) return;
    node.classList.add('comment-flash');
    window.setTimeout(() => node.classList.remove('comment-flash'), 2_800);
    node.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }

  async function publish(): Promise<void> {
    const account = passport?.account() || null;
    const rawName = account ? '' : elements.nickname.value.replace(/\s+/g, ' ').trim();
    const name = account ? account.displayName : rawName || config.anonymousNickname;
    const content = elements.textarea.value.trim();
    if (!content || !state.imageId || publishing || destroyed) return;
    const subject = state.imageId;
    publishing = true;
    elements.submit.disabled = true;
    elements.status.textContent = '';
    try {
      const created = await api.publish({
        imageId: subject,
        nickname: name,
        content,
        parentId: state.replyTo?.id || null,
        discloseOs: elements.discloseOs.checked
      });
      markLocalCommentedImage(subject);
      if (destroyed || subject !== state.imageId) return;
      if (!account) {
        try {
          if (rawName) localStorage.setItem(config.nicknameStorageKey, rawName);
          else localStorage.removeItem(config.nicknameStorageKey);
        } catch {
          /* remembering a nickname is best-effort */
        }
      }
      elements.textarea.value = '';
      setReplyTarget(null);
      setPreview(false);
      await load();
      if (created.id) focusComment(created.id);
    } catch (error) {
      const traditional = config.locale === 'zh-TW';
      if (error instanceof ApiError && error.message === 'nickname_change_cooldown') {
        elements.status.textContent = traditional
          ? `您的暱稱近期已修改過，${formatCooldown(error.retryAfterMs)}可再次修改`
          : `您的昵称近期已修改过，${formatCooldown(error.retryAfterMs)}可再次修改`;
      } else if (error instanceof Error && error.message === 'rate_limited') {
        elements.status.textContent = traditional ? '傳送太快，請稍後再試' : '发送太快，请稍后再试';
      } else {
        elements.status.textContent = traditional ? '發表失敗' : '发布失败';
      }
    } finally {
      publishing = false;
      syncSubmitState();
    }
  }

  async function toggleLike(item: CommentItem): Promise<void> {
    if (pendingLikes.has(item.id)) return;
    const previous = { likedByMe: item.likedByMe, likeCount: item.likeCount };
    const nextLiked = !item.likedByMe;
    item.likedByMe = nextLiked;
    item.likeCount = Math.max(0, item.likeCount + (nextLiked ? 1 : -1));
    pendingLikes.add(item.id);
    render();
    try {
      const result = await api.setLike(item.id, nextLiked);
      item.likedByMe = result.likedByMe;
      item.likeCount = result.likeCount;
      render();
    } catch {
      item.likedByMe = previous.likedByMe;
      item.likeCount = previous.likeCount;
      render();
      elements.status.textContent = config.locale === 'zh-TW' ? '操作失敗' : '操作失败';
    } finally {
      pendingLikes.delete(item.id);
    }
  }

  async function deleteComment(item: CommentItem): Promise<void> {
    const owner = config.capabilities.passport && Boolean(item.ownedByMe);
    if (!owner && !state.adminToken) return;
    if (!window.confirm(config.locale === 'zh-TW' ? '刪除這則留言？' : '删除这条评论？')) return;
    try {
      if (owner) await api.deleteOwn(item.id);
      else await api.delete(item.id);
      await load();
    } catch {
      if (owner) {
        elements.status.textContent = config.locale === 'zh-TW' ? '刪除失敗' : '删除失败';
      } else {
        state.adminToken = '';
        render();
        elements.status.textContent = config.locale === 'zh-TW' ? '驗證已失效' : '验证已失效';
      }
    }
  }

  function resetForImage(imageId: string): void {
    state.imageId = imageId;
    state.replyTo = null;
    state.comments = [];
    state.loadedImageId = '';
    state.loadError = '';
    elements.replyTarget.hidden = true;
    render();
  }

  function syncSubmitState(): void {
    elements.submit.disabled = publishing || !elements.textarea.value.trim();
  }

  function applyFormat(format: string, start: number, end: number): void {
    if (start === end) return;
    const textarea = elements.textarea;
    const value = textarea.value;
    const selected = value.slice(start, end);
    const marker = format === 'bold' ? '**' : format === 'italic' ? '_' : '';
    if (!marker) return;
    const markedStart = start - marker.length;
    const markedEnd = end + marker.length;
    if (markedStart >= 0 && value.slice(markedStart, start) === marker && value.slice(end, markedEnd) === marker) {
      textarea.setRangeText(selected, markedStart, markedEnd, 'select');
      textarea.setSelectionRange(markedStart, markedStart + selected.length);
    } else {
      textarea.setRangeText(marker + selected + marker, start, end, 'select');
      textarea.setSelectionRange(start + marker.length, end + marker.length);
    }
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const composerOptions = elements.app.querySelector<HTMLDetailsElement>('.composer-options');
  const closeComposerOptions = (event: MouseEvent): void => {
    if (composerOptions?.open && event.target instanceof Node && !composerOptions.contains(event.target)) {
      composerOptions.open = false;
    }
  };
  document.addEventListener('click', closeComposerOptions);
  elements.closeButton.addEventListener('click', () => hooks.onClose?.());
  elements.replyTarget.addEventListener('click', () => setReplyTarget(null));
  elements.previewToggle.addEventListener('click', () => setPreview(!state.previewing));
  elements.submit.addEventListener('click', () => void publish());
  elements.accountButton.addEventListener('click', () => {
    const drawer = elements.accountButton.closest('details');
    drawer?.removeAttribute('open');
    (drawer?.querySelector('summary') ?? elements.accountButton).focus();
    void ensurePassport(true).then((value) => value?.open());
  });

  try {
    elements.discloseOs.checked = localStorage.getItem(config.discloseOsStorageKey) === '1';
  } catch {
    /* keep the unchecked default */
  }
  elements.discloseOs.addEventListener('change', () => {
    try {
      if (elements.discloseOs.checked) localStorage.setItem(config.discloseOsStorageKey, '1');
      else localStorage.removeItem(config.discloseOsStorageKey);
    } catch {
      /* ignore */
    }
  });

  for (const button of elements.app.querySelectorAll<HTMLButtonElement>('.format-button')) {
    let pointerSelection = [0, 0];
    button.addEventListener('pointerdown', () => {
      pointerSelection = [elements.textarea.selectionStart, elements.textarea.selectionEnd];
    });
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', (event) => {
      const selection = event.detail ? pointerSelection : [elements.textarea.selectionStart, elements.textarea.selectionEnd];
      applyFormat(button.dataset.format || '', selection[0], selection[1]);
    });
  }
  elements.textarea.addEventListener('input', () => {
    syncSubmitState();
    if (state.previewing) void updatePreview();
  });
  elements.textarea.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void publish();
  });

  if (!config.capabilities.passport) elements.accountButton.hidden = true;
  syncSubmitState();
  render();
  if (state.imageId) void load();

  return {
    update(next): void {
      if (destroyed) return;
      let reload = false;
      if (next.subject !== undefined && next.subject !== state.imageId) {
        resetForImage(next.subject);
        reload = true;
      }
      if (next.viewerId && !state.viewerId && validViewerId(next.viewerId)) {
        state.viewerId = next.viewerId;
        try {
          sessionStorage.setItem(config.viewerStorageKey, next.viewerId);
        } catch {
          /* state retains the host-provided ID when storage is blocked */
        }
        reload = true;
      }
      if (next.adminToken !== undefined) {
        state.adminToken = next.adminToken;
        render();
      }
      if (reload && state.imageId) void load();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('click', closeComposerOptions);
      passport?.destroy();
      appRoot.replaceChildren();
      delete appRoot.dataset.sicsicIntegration;
    }
  };
}

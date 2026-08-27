import type { CommentElements } from './dom';
import type { CommentLocale, CommentRootOrder } from './config';
import type { CommentAppState, CommentItem } from './types';
import { badgeSvg } from './badges';

interface CommentRenderOptions {
  anonymousNickname: string;
  adminEnabled: boolean;
  accountEnabled: boolean;
  apiOrigin: string;
  /** Avatars are served by the central auth service, not the comment API. */
  authOrigin: string;
  editingId: string;
  locale: CommentLocale;
  rootOrder: CommentRootOrder;
  showSkeleton: boolean;
  onReply: (item: CommentItem) => void;
  onLike: (item: CommentItem) => void;
  onDelete: (item: CommentItem) => void;
  onEdit: (item: CommentItem) => void;
  onEditSave: (item: CommentItem, content: string) => void;
  onEditCancel: () => void;
  onAvatarEdit: (item: CommentItem) => void;
  /** Open the public profile card of another signed-in commenter. */
  onShowProfile: (item: CommentItem) => void;
}

export function commentNickname(value: string, anonymousNickname: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed || anonymousNickname;
}

function nicknameInitial(value: string, anonymousNickname: string): string {
  const trimmed = commentNickname(value, anonymousNickname);
  if ('Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return segmenter.segment(trimmed)[Symbol.iterator]().next().value?.segment || '?';
  }
  return Array.from(trimmed)[0] || '?';
}

function nicknameHue(value: string, anonymousNickname: string): number {
  let hash = 0;
  for (const character of commentNickname(value, anonymousNickname)) {
    hash = ((hash << 5) - hash + character.codePointAt(0)!) | 0;
  }
  return Math.abs(hash) % 360;
}

function formatTime(value: number, locale: CommentLocale): string {
  if (locale === 'zh-TW') {
    const date = new Date(value);
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const time = new Intl.DateTimeFormat('zh-TW', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => time.find((item) => item.type === type)?.value || '';
    return `${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()} 於 ${part('hour')}:${part('minute')} ${part('dayPeriod')}`;
  }
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function commentRank(a: CommentItem, b: CommentItem): number {
  const aHasLikes = a.likeCount > 0;
  const bHasLikes = b.likeCount > 0;
  if (aHasLikes !== bHasLikes) return aHasLikes ? -1 : 1;
  if (aHasLikes && a.likeCount !== b.likeCount) return b.likeCount - a.likeCount;
  return b.createdAt - a.createdAt;
}

function createCommentNode(
  item: CommentItem,
  elements: CommentElements,
  options: CommentRenderOptions,
  reply = false
): HTMLElement {
  const article = document.createElement('article');
  article.className = reply ? 'comment reply' : 'comment';
  article.dataset.id = item.id;
  const displayName = commentNickname(item.nickname, options.anonymousNickname);
  const traditional = options.locale === 'zh-TW';
  const ownerControls = options.accountEnabled && Boolean(item.ownedByMe);
  const interactiveAvatar = options.accountEnabled && (ownerControls || Boolean(item.authorId));

  const avatar = document.createElement(interactiveAvatar ? 'button' : 'div');
  avatar.className = 'comment-avatar';
  if (avatar instanceof HTMLButtonElement) {
    avatar.type = 'button';
    // Safari does not focus pointer-clicked buttons; modal restoration still must.
    avatar.addEventListener('click', () => avatar.focus());
  }
  avatar.style.setProperty('--avatar-hue', String(nicknameHue(displayName, options.anonymousNickname)));
  if (item.authorAvatar) {
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.src = options.authOrigin + item.authorAvatar;
    img.alt = '';
    img.loading = 'lazy';
    avatar.append(img);
  } else {
    const initial = document.createElement('span');
    initial.className = 'avatar-initial';
    initial.textContent = nicknameInitial(displayName, options.anonymousNickname);
    avatar.append(initial);
  }
  if (item.authorBadge && item.authorBadge !== 'none') {
    const badge = document.createElement('span');
    badge.className = 'avatar-badge';
    badge.innerHTML = badgeSvg(item.authorBadge, 14);
    avatar.append(badge);
  }
  if (ownerControls) {
    avatar.classList.add('editable');
    avatar.title = traditional ? '點按修改標記' : '点按修改标记';
    avatar.setAttribute('aria-label', `修改 ${displayName} ${traditional ? '的標記' : '的标记'}`);
    avatar.addEventListener('click', () => options.onAvatarEdit(item));
  } else if (options.accountEnabled && item.authorId) {
    // Public profile data is loaded only after this explicit click.
    avatar.classList.add('has-profile');
    avatar.setAttribute('aria-label', `查看 ${displayName} ${traditional ? '的個人檔案' : '的个人档案'}`);
    avatar.addEventListener('click', () => options.onShowProfile(item));
  } else {
    avatar.setAttribute('aria-hidden', 'true');
  }

  const main = document.createElement('div');
  main.className = 'comment-main';

  const head = document.createElement('div');
  head.className = 'comment-head';
  const name = document.createElement('strong');
  name.className = 'comment-name';
  name.textContent = displayName;
  const time = document.createElement('time');
  time.dateTime = new Date(item.createdAt).toISOString();
  time.textContent = formatTime(item.createdAt, options.locale);
  head.append(name);
  if (traditional) {
    const says = document.createElement('span');
    says.className = 'comment-says';
    says.textContent = ' 說道：';
    head.append(says);
  }
  head.append(time);
  if (item.osLabel) {
    const os = document.createElement('span');
    os.className = `comment-os os-${item.osLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    os.textContent = item.osLabel;
    head.append(os);
  }

  if (options.editingId === item.id) {
    const editor = document.createElement('div');
    editor.className = 'comment-edit';
    const textarea = document.createElement('textarea');
    textarea.maxLength = 2000;
    textarea.value = item.content;
    textarea.setAttribute('aria-label', traditional ? '編輯留言' : '编辑评论');
    const editActions = document.createElement('div');
    editActions.className = 'comment-edit-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = traditional ? '儲存' : '保存';
    save.addEventListener('click', () => options.onEditSave(item, textarea.value));
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => options.onEditCancel());
    editActions.append(save, cancel);
    editor.append(textarea, editActions);
    main.append(head, editor);
    article.append(avatar, main);
    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    return article;
  }

  const body = document.createElement('div');
  body.className = 'markdown';
  // Contract: item.html is the ONLY trusted boundary's output. The backend renders
  // Markdown with raw HTML disabled and rejects non-https image URLs (see the worker's
  // comments route). The client never sanitizes server HTML and must not relax this.
  body.innerHTML = item.html;

  const actions = document.createElement('div');
  actions.className = 'comment-actions';

  const replyButton = document.createElement('button');
  replyButton.type = 'button';
  replyButton.textContent = traditional ? '回覆' : '回复';
  replyButton.addEventListener('click', () => options.onReply(item));

  const likeButton = document.createElement('button');
  likeButton.type = 'button';
  likeButton.className = `like-button${item.likedByMe ? ' liked' : ''}`;
  likeButton.title = traditional ? '喜歡' : '喜欢';
  likeButton.setAttribute('aria-label', traditional ? '喜歡' : '喜欢');
  likeButton.setAttribute('aria-pressed', item.likedByMe ? 'true' : 'false');
  likeButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6z"/></svg>${item.likeCount > 0 ? `<span>${item.likeCount}</span>` : ''}`;
  likeButton.addEventListener('click', () => options.onLike(item));
  actions.append(replyButton, likeButton);

  if (ownerControls) {
    if (item.editable) {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = traditional ? '編輯' : '编辑';
      editButton.addEventListener('click', () => options.onEdit(item));
      actions.append(editButton);
    }
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'danger';
    deleteButton.textContent = traditional ? '刪除' : '删除';
    deleteButton.addEventListener('click', () => options.onDelete(item));
    actions.append(deleteButton);
  } else if (options.adminEnabled) {
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'danger';
    deleteButton.textContent = traditional ? '刪除' : '删除';
    deleteButton.addEventListener('click', () => options.onDelete(item));
    actions.append(deleteButton);
  }

  main.append(head, body, actions);
  article.append(avatar, main);
  return article;
}

function renderSkeleton(list: HTMLElement): void {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 3; index += 1) {
    const article = document.createElement('article');
    article.className = `comment skeleton-comment${index === 1 ? ' reply' : ''}`;
    article.setAttribute('aria-hidden', 'true');

    const avatar = document.createElement('div');
    avatar.className = 'skeleton skeleton-avatar';

    const main = document.createElement('div');
    main.className = 'comment-main';
    const head = document.createElement('div');
    head.className = 'comment-head';
    const name = document.createElement('span');
    name.className = 'skeleton skeleton-name';
    const meta = document.createElement('span');
    meta.className = 'skeleton skeleton-meta';
    head.append(name, meta);

    const lineA = document.createElement('div');
    lineA.className = 'skeleton skeleton-line';
    const lineB = document.createElement('div');
    lineB.className = 'skeleton skeleton-line short';
    main.append(head, lineA, lineB);
    article.append(avatar, main);
    fragment.appendChild(article);
  }
  list.appendChild(fragment);
}

export function renderComments(
  elements: CommentElements,
  state: CommentAppState,
  options: CommentRenderOptions
): void {
  elements.list.replaceChildren();

  const loaded = Boolean(state.imageId) && state.loadedImageId === state.imageId;
  if (!loaded) {
    if (options.showSkeleton) renderSkeleton(elements.list);
    return;
  }

  const roots = state.comments
    .filter((item) => item.parentId === null)
    .sort(options.rootOrder === 'chronological' ? (a, b) => a.createdAt - b.createdAt : commentRank);
  const rootOrder = new Map(roots.map((item, index) => [item.id, index]));

  for (const root of roots) {
    const thread = document.createElement('div');
    thread.className = 'thread';
    thread.appendChild(createCommentNode(root, elements, options));
    const replies = state.comments
      .filter((item) => item.parentId !== null && item.rootId === root.id)
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const reply of replies) thread.appendChild(createCommentNode(reply, elements, options, true));
    elements.list.appendChild(thread);
  }

  const orphans = state.comments.filter((item) => item.parentId !== null && !rootOrder.has(item.rootId));
  for (const item of orphans) {
    elements.list.appendChild(createCommentNode(item, elements, options, true));
  }

  if (state.loadError) {
    const error = document.createElement('p');
    error.className = 'empty load-error';
    error.textContent = state.loadError;
    elements.list.appendChild(error);
  } else if (!state.loading && state.comments.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty no-comments';
    empty.textContent = options.locale === 'zh-TW' ? '目前沒有迴響' : '还没有评论';
    elements.list.appendChild(empty);
  }
}

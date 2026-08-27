import { badgeSvg } from './badges';
import type { CommentLocale } from './config';
import type { Modal } from './modal';
import type { BadgeKind, PublicProfile } from './types';

/**
 * Lightweight profile card + external-link confirmation, shown from the
 * comment list (avatar click / display-name click). Reuses the `.auth-*`
 * overlay styles so it matches the account window. All text lands via
 * `textContent` — profile data is never interpreted as HTML.
 */

function openCard(title: string, modal: Modal, locale: CommentLocale, build: (body: HTMLElement) => void): void {
  const card = document.createElement('div');
  card.className = 'auth-card profile-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', title);

  const head = document.createElement('div');
  head.className = 'auth-head';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'auth-close';
  closeButton.setAttribute('aria-label', locale === 'zh-TW' ? '關閉' : '关闭');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => modal.close());
  head.append(heading, closeButton);

  const body = document.createElement('div');
  body.className = 'auth-body';
  build(body);

  card.append(head, body);
  modal.open(card);
}

/** Confirm before leaving for someone's personal website. */
function confirmVisit(url: string, displayName: string, modal: Modal, locale: CommentLocale): void {
  try {
    const target = new URL(url);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return;
    url = target.href;
  } catch {
    return;
  }
  const traditional = locale === 'zh-TW';
  openCard(traditional ? '前往個人網站' : '前往个人网站', modal, locale, (body) => {
    const hint = document.createElement('p');
    hint.className = 'auth-hint';
    hint.textContent = traditional ? `即將離開目前頁面，前往 ${displayName} 的個人網站：` : `即将离开当前页面，前往 ${displayName} 的个人网站：`;
    const address = document.createElement('p');
    address.className = 'profile-visit-url';
    address.textContent = url;
    const actions = document.createElement('div');
    actions.className = 'profile-visit-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'auth-text';
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => modal.close());
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'auth-submit small';
    go.textContent = '前往';
    go.addEventListener('click', () => {
      window.open(url, '_blank', 'noopener,noreferrer');
      modal.close();
    });
    actions.append(cancel, go);
    body.append(hint, address, actions);
  });
}

/** The public profile card for a signed-in commenter. */
export function showProfileCard(profile: PublicProfile, authOrigin: string, modal: Modal, locale: CommentLocale): void {
  const traditional = locale === 'zh-TW';
  openCard(traditional ? '個人檔案' : '个人档案', modal, locale, (body) => {
    const identity = document.createElement('div');
    identity.className = 'auth-identity';

    const avatar = document.createElement('span');
    avatar.className = 'profile-card-avatar';
    if (profile.avatar) {
      const img = document.createElement('img');
      img.src = authOrigin + profile.avatar;
      img.alt = '';
      avatar.append(img);
    } else {
      avatar.textContent = Array.from(profile.displayName)[0] || '?';
    }

    const idLine = document.createElement('div');
    idLine.className = 'auth-id';
    const nameRow = document.createElement('div');
    nameRow.className = 'profile-card-name';
    const name = document.createElement('strong');
    name.textContent = profile.displayName;
    nameRow.append(name);
    if (profile.badge && profile.badge !== 'none') {
      const badge = document.createElement('span');
      badge.className = 'profile-card-badge';
      badge.innerHTML = badgeSvg(profile.badge as BadgeKind, 14);
      nameRow.append(badge);
    }
    idLine.append(nameRow);
    if (profile.username) {
      const handle = document.createElement('span');
      handle.className = 'auth-muted';
      handle.textContent = `@${profile.username}`;
      idLine.append(handle);
    }
    identity.append(avatar, idLine);
    body.append(identity);

    if (profile.bio) {
      const bio = document.createElement('p');
      bio.className = 'profile-card-bio';
      bio.textContent = profile.bio;
      body.append(bio);
    }

    const rows = document.createElement('div');
    rows.className = 'profile-card-rows';
    const addRow = (label: string, value: HTMLElement): void => {
      const row = document.createElement('div');
      row.className = 'profile-card-row';
      const key = document.createElement('span');
      key.className = 'auth-label';
      key.textContent = label;
      row.append(key, value);
      rows.append(row);
    };
    if (profile.website) {
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = profile.website.replace(/^https?:\/\//, '');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        confirmVisit(profile.website!, profile.displayName, modal, locale);
      });
      addRow(traditional ? '網站' : '网站', link);
    }
    if (profile.email) {
      const mail = document.createElement('a');
      mail.href = `mailto:${profile.email}`;
      mail.textContent = profile.email;
      addRow(traditional ? '電子郵件' : '邮箱', mail);
    }
    if (rows.childElementCount > 0) body.append(rows);

    if (!profile.bio && rows.childElementCount === 0) {
      const empty = document.createElement('p');
      empty.className = 'auth-hint';
      empty.textContent = traditional ? 'TA 還沒有公開更多資訊。' : 'TA 还没有公开更多信息。';
      body.append(empty);
    }
  });
}

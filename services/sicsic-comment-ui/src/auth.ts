import type { PassportConfig } from './config';
import { ApiError } from './api';
import type { PassportApi } from './passportApi';
import type { Modal } from './modal';
import type { AccountUser, BadgeKind } from './types';
import { badgeSvg } from './badges';

interface AuthOptions {
  config: PassportConfig;
  api: PassportApi;
  modal: Modal;
  onChange: () => void;
}

const BADGES: BadgeKind[] = ['none', 'cockade', 'seal'];
const BADGE_LABEL: Record<BadgeKind, [string, string]> = { none: ['不标注', '不標註'], cockade: ['三色花结', '三色花結'], seal: ['认证标记', '認證標記'] };

const ERROR_TEXT: Record<string, [string, string]> = {
  invalid_credentials: ['用户名或密码错误', '使用者名稱或密碼錯誤'],
  email_taken: ['该邮箱已注册，请直接登录', '此電子郵件已註冊，請直接登入'],
  username_taken: ['用户名已被占用', '使用者名稱已被使用'],
  invalid_email: ['邮箱格式不正确', '電子郵件格式不正確'],
  invalid_username: ['用户名需 3–20 位，仅限字母、数字和下划线', '使用者名稱需 3–20 位，僅限字母、數字和底線'],
  invalid_password: ['密码至少 8 位', '密碼至少 8 位'],
  invalid_code: ['验证码不正确', '驗證碼不正確'],
  code_expired: ['验证码已过期，请重新获取', '驗證碼已過期，請重新取得'],
  same_email: ['与当前邮箱相同', '與目前電子郵件相同'],
  email_send_failed: ['验证邮件发送失败，请稍后再试', '驗證郵件傳送失敗，請稍後再試'],
  rate_limited: ['操作过于频繁，请稍后再试', '操作過於頻繁，請稍後再試'],
  oauth_failed: ['Google 登录失败，请重试', 'Google 登入失敗，請重試'],
  unauthorized: ['登录已失效，请重新登录', '登入已失效，請重新登入'],
  invalid_display_name: ['用户名最多 32 个字符', '使用者名稱最多 32 個字元'],
  invalid_bio: ['简介最多 50 个字符', '簡介最多 50 個字元'],
  invalid_website: ['网址需以 http(s):// 开头', '網址需以 http(s):// 開頭'],
  invalid_public_email: ['公开邮箱格式不正确', '公開電子郵件格式不正確']
};

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<Node | string> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

/** Decode, downscale to a square-ish max edge, and re-encode (WebP, JPEG fallback). */
async function compressImage(file: Blob, max = 256, quality = 0.85): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('canvas_unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (webp) return webp;
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', quality)
  );
}

export function createAuth({ config, api, modal, onChange }: AuthOptions) {
  const text = (simplified: string, traditional: string): string => config.locale === 'zh-TW' ? traditional : simplified;
  const errors = Object.fromEntries(Object.entries(ERROR_TEXT).map(([key, value]) => [key, text(...value)]));
  function messageFor(error: unknown): string {
    return (error instanceof ApiError && errors[error.message]) || text('操作失败，请重试', '操作失敗，請重試');
  }
  const copy = config.locale === 'zh-TW' ? {
    login: '登入', register: '註冊', account: '帳號', password: '密碼',
    identifier: '使用者名稱或電子郵件', forgot: '忘記密碼？', email: '電子郵件',
    username: '使用者名稱', sendCode: '傳送驗證碼', code: '驗證碼',
    verify: '驗證並登入', back: '返回修改', backLogin: '返回登入',
    reset: '重設並登入', newPassword: '新密碼（至少 8 位）', or: '或',
    google: '使用 Google 登入', close: '關閉', profile: '我的帳戶', logout: '登出'
  } : {
    login: '登录', register: '注册', account: '账号', password: '密码',
    identifier: '用户名或邮箱', forgot: '忘记密码？', email: '邮箱',
    username: '用户名', sendCode: '发送验证码', code: '验证码',
    verify: '验证并登录', back: '返回修改', backLogin: '返回登录',
    reset: '重置并登录', newPassword: '新密码（至少 8 位）', or: '或',
    google: '使用 Google 登录', close: '关闭', profile: '我的账户', logout: '退出登录'
  };
  const codeSent = (email: string): string => config.locale === 'zh-TW'
    ? `驗證碼已傳送至 ${email}，10 分鐘內有效。`
    : `验证码已发送至 ${email}，10 分钟内有效。`;

  function storedValue(key: string): string {
    try {
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  }

  let token = storedValue(config.sessionStorageKey);
  // One-time migration from the old per-preset key, so logins from before the
  // shared same-origin session key survive the upgrade. Browser origins stay isolated.
  if (!token && config.legacySessionStorageKey && config.legacySessionStorageKey !== config.sessionStorageKey) {
    const legacy = storedValue(config.legacySessionStorageKey);
    if (legacy) {
      token = legacy;
      try {
        localStorage.setItem(config.sessionStorageKey, legacy);
        localStorage.removeItem(config.legacySessionStorageKey);
      } catch {
        /* storage full/blocked — keep the in-memory token */
      }
    }
  }
  let account: AccountUser | null = null;
  let googlePopup: Window | null = null;
  let googlePoll = 0;
  let authError: ((message: string) => void) | null = null;

  function persist(next: string): void {
    token = next;
    try {
      if (next) localStorage.setItem(config.sessionStorageKey, next);
      else localStorage.removeItem(config.sessionStorageKey);
    } catch {
      /* storage full/blocked (e.g. private mode) — the in-memory token still
       * drives this session; it just won't persist across reloads. */
    }
  }

  function applySession(nextToken: string, user: AccountUser): void {
    persist(nextToken);
    account = user;
    closeOverlay();
    onChange();
  }

  async function refresh(): Promise<void> {
    if (!token) {
      account = null;
      return;
    }
    try {
      const { user } = await api.me(token);
      account = user;
    } catch (error) {
      if (error instanceof ApiError && error.message === 'unauthorized') persist('');
      account = null;
    }
  }

  function closeOverlay(): void {
    modal.close();
  }

  function openOverlay(card: HTMLElement): void {
    modal.open(card);
  }

  function card(titleText: string): { root: HTMLElement; body: HTMLElement } {
    const body = h('div', { class: 'auth-body' });
    const close = h('button', { class: 'auth-close', type: 'button', 'aria-label': copy.close }, ['×']);
    close.addEventListener('click', closeOverlay);
    const root = h('div', { class: 'auth-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': titleText }, [
      h('div', { class: 'auth-head' }, [h('strong', {}, [titleText]), close]),
      body
    ]);
    return { root, body };
  }

  function field(label: string, input: HTMLInputElement): HTMLElement {
    return h('label', { class: 'auth-field' }, [h('span', {}, [label]), input]);
  }

  function sectionSummary(text: string): HTMLElement {
    return h('summary', {}, [h('span', { class: 'auth-section-title' }, [text])]);
  }

  function input(type: string, placeholder: string, attrs: Record<string, string> = {}): HTMLInputElement {
    return h('input', { type, placeholder, ...attrs });
  }

  function googleIcon(): HTMLElement {
    return h('span', { class: 'auth-google-mark', 'aria-hidden': 'true', html: [
      '<svg viewBox="0 0 18 18">',
      '<path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62Z"/>',
      '<path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.58-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"/>',
      '<path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l2.99-2.33Z"/>',
      '<path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.16 6.65 3.58 9 3.58Z"/>',
      '</svg>'
    ].join('') });
  }

  function googleButton(): HTMLButtonElement {
    const btn = h('button', { class: 'auth-google', type: 'button' }, [googleIcon(), h('span', {}, [copy.google])]);
    btn.addEventListener('click', () => void openGoogle());
    return btn;
  }

  function stopGooglePoll(): void {
    if (googlePoll) window.clearInterval(googlePoll);
    googlePoll = 0;
  }

  function finishGoogle(data: { token?: string; user?: AccountUser; error?: string }): void {
    stopGooglePoll();
    googlePopup?.close();
    googlePopup = null;
    if (data.error) {
      authError?.(errors[data.error] || errors.oauth_failed);
      return;
    }
    if (data.token && data.user) {
      applySession(data.token, data.user);
      return;
    }
    if (data.token) {
      persist(data.token);
      void refresh().then(() => {
        if (account) {
          closeOverlay();
          onChange();
        } else {
          authError?.(text('登录已创建，请稍后重试', '登入已建立，請稍後重試'));
        }
      });
    }
  }

  function pollGoogle(state: string): void {
    stopGooglePoll();
    let attempts = 0;
    googlePoll = window.setInterval(() => {
      attempts += 1;
      if (attempts > 75) {
        stopGooglePoll();
        authError?.(text('Google 登录超时，请重试', 'Google 登入逾時，請重試'));
        return;
      }
      void api.googleResult(state).then((data) => {
        if (!data.pending) finishGoogle(data);
      }).catch(() => undefined);
    }, 1200);
  }

  function openGoogle(): void {
    const width = 460;
    const height = 620;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const state = crypto.randomUUID();
    stopGooglePoll();
    // window.open can return null (opener severed by COOP / sandbox / cross-origin)
    // even when the popup actually opens. So we never treat null as failure: the
    // /api/auth/google/result poll is the source of truth and reports a timeout if
    // nothing comes back. (Hard-failing on null here previously skipped the poll, so
    // a successful Google login was never collected.)
    googlePopup = window.open(
      api.googleStartUrl(window.location.origin, state),
      'sicsic-google',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    pollGoogle(state);
  }

  function onMessage(event: MessageEvent): void {
    if (!googlePoll || !googlePopup || event.source !== googlePopup || event.origin !== new URL(config.authOrigin, location.href).origin) return;
    const data = event.data as { type?: string; token?: string; user?: AccountUser; error?: string };
    if (!data || (data.type !== 'sicsic-auth' && data.type !== 'sodesu-auth')) return;
    finishGoogle(data);
  }

  window.addEventListener('message', onMessage);

  // ---- Login / register modal ----------------------------------------------

  function showLogin(): void {
    const { root, body } = card(config.locale === 'zh-TW' ? '登入SicSic通行證' : copy.login);
    root.classList.add('auth-entry-card');
    const error = h('p', { class: 'auth-error', role: 'alert' });
    const tabs = h('div', { class: 'auth-tabs' });
    const loginTab = h('button', { class: 'auth-tab active', type: 'button' }, [copy.login]);
    const registerTab = h('button', { class: 'auth-tab', type: 'button' }, [copy.register]);
    tabs.append(loginTab, registerTab);

    const pane = h('div', { class: 'auth-pane' });
    body.append(tabs, error, pane);

    const showError = (message: string): void => {
      error.textContent = message;
    };
    authError = showError;

    const renderLogin = (): void => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      showError('');
      const identifier = input('text', copy.identifier, { autocomplete: 'username' });
      const password = input('password', copy.password, { autocomplete: 'current-password' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, [copy.login]);
      const reset = h('button', { class: 'auth-text auth-reset', type: 'button' }, [copy.forgot]);
      reset.addEventListener('click', renderResetStart);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          const { token: t, user } = await api.login({ identifier: identifier.value.trim(), password: password.value });
          applySession(t, user);
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(
        field(copy.account, identifier),
        field(copy.password, password),
        h('div', { class: 'auth-row' }, [reset]),
        h('div', { class: 'auth-methods' }, [submit, divider(), googleButton()])
      );
    };

    const renderRegister = (): void => {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      showError('');
      const email = input('email', 'you@example.com', { autocomplete: 'email' });
      const username = input('text', text('3–20 位字母 / 数字 / _', '3–20 位字母 / 數字 / _'), { autocomplete: 'username' });
      const password = input('password', '至少 8 位', { autocomplete: 'new-password' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, [copy.sendCode]);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          await api.registerStart({
            email: email.value.trim(),
            username: username.value.trim(),
            password: password.value
          });
          renderVerify(email.value.trim());
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(field(copy.email, email), field(copy.username, username), field(copy.password, password), submit);
    };

    const renderVerify = (email: string): void => {
      showError('');
      const hint = h('p', { class: 'auth-hint' }, [codeSent(email)]);
      const code = input('text', `6 位${copy.code}`, { inputmode: 'numeric', maxlength: '6', class: 'auth-code' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, [copy.verify]);
      const back = h('button', { class: 'auth-text', type: 'button' }, [copy.back]);
      back.addEventListener('click', renderRegister);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          const { token: t, user } = await api.registerVerify({ email, code: code.value.trim() });
          applySession(t, user);
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(hint, field(copy.code, code), submit, back);
      code.focus();
    };

    const renderResetStart = (): void => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      showError('');
      const email = input('email', 'you@example.com', { autocomplete: 'email' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, [copy.sendCode]);
      const back = h('button', { class: 'auth-text', type: 'button' }, [copy.backLogin]);
      back.addEventListener('click', renderLogin);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          await api.resetStart(email.value.trim());
          renderResetVerify(email.value.trim());
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      const resetHint = config.locale === 'zh-TW'
        ? '輸入註冊電子郵件，驗證碼將傳送到該信箱。'
        : '输入注册邮箱，验证码将发送到该邮箱。';
      pane.replaceChildren(h('p', { class: 'auth-hint' }, [resetHint]), field(copy.email, email), submit, back);
    };

    const renderResetVerify = (email: string): void => {
      showError('');
      const hint = h('p', { class: 'auth-hint' }, [codeSent(email)]);
      const code = input('text', `6 位${copy.code}`, { inputmode: 'numeric', maxlength: '6', class: 'auth-code' });
      const password = input('password', copy.newPassword, { autocomplete: 'new-password' });
      const submit = h('button', { class: 'auth-submit', type: 'button' }, [copy.reset]);
      const back = h('button', { class: 'auth-text', type: 'button' }, [copy.back]);
      back.addEventListener('click', renderResetStart);
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        showError('');
        try {
          const { token: t, user } = await api.resetVerify({ email, code: code.value.trim(), password: password.value });
          applySession(t, user);
        } catch (err) {
          showError(messageFor(err));
        } finally {
          submit.disabled = false;
        }
      });
      pane.replaceChildren(hint, field(copy.code, code), field(copy.newPassword, password), submit, back);
      code.focus();
    };

    loginTab.addEventListener('click', renderLogin);
    registerTab.addEventListener('click', renderRegister);
    renderLogin();
    openOverlay(root);
  }

  function divider(): HTMLElement {
    return h('div', { class: 'auth-divider' }, [h('span', {}, [copy.or])]);
  }

  // ---- Profile -------------------------------------------------------------

  function showProfile(): void {
    if (!account) return;
    const { root, body } = card(copy.profile);
    const error = h('p', { class: 'auth-error', role: 'alert' });
    const showError = (m: string): void => {
      error.textContent = m;
    };

    const idLine = h('div', { class: 'auth-id' });
    const emailSpan = (): HTMLElement =>
      account!.email ? h('span', {}, [account!.email]) : h('span', { class: 'auth-muted' }, [text('未绑定邮箱', '未綁定電子郵件')]);
    const defaultName = (): string =>
      account!.username || (account!.email ? account!.email.split('@')[0] : '') || 'User';
    // Name — click to rename the current profile; historical comments keep
    // their published text byline. Both the static row and
    // the editor row live inside a fixed-height .auth-name-row so the email
    // line below never shifts while editing.
    const renderIdLine = (): void => {
      const name = h(
        'strong',
        { class: 'auth-name', role: 'button', tabindex: '0', title: text('点击修改用户名', '點按修改使用者名稱') },
        [account!.displayName]
      );
      const row = h('div', { class: 'auth-name-row' }, [name]);
      if (account!.username) {
        row.append(h('span', { class: 'auth-handle' }, [`@${account!.username}`]));
      }
      const startEdit = (): void => {
        const nameInput = input('text', text('用户名（留空恢复默认）', '使用者名稱（留空恢復預設）'), { maxlength: '32' });
        nameInput.value = account!.displayName;
        const save = h('button', { class: 'auth-submit small', type: 'button' }, [text('保存', '儲存')]);
        const cancel = h('button', { class: 'auth-text', type: 'button' }, ['取消']);
        // Optimistic: reflect the new name instantly, reconcile in the
        // background, revert only on failure.
        const commit = (): void => {
          const requested = nameInput.value.replace(/\s+/g, ' ').trim();
          const previous = account!.displayName;
          const optimistic = requested || defaultName();
          if (optimistic === previous) {
            renderIdLine();
            return;
          }
          showError('');
          account!.displayName = optimistic;
          renderIdLine();
          renderAvatar(); // fallback initial follows the name
          onChange();
          void api
            .updateProfile(token, { displayName: requested })
            .then(({ user }) => {
              account = user;
              renderIdLine();
              renderAvatar();
              onChange();
            })
            .catch((err) => {
              account!.displayName = previous;
              renderIdLine();
              renderAvatar();
              onChange();
              showError(messageFor(err));
            });
        };
        save.addEventListener('click', commit);
        cancel.addEventListener('click', renderIdLine);
        nameInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            renderIdLine();
          }
        });
        const editor = h('div', { class: 'auth-name-row auth-name-editor' }, [nameInput, save, cancel]);
        idLine.replaceChildren(editor, emailSpan());
        nameInput.focus();
        nameInput.select();
      };
      name.addEventListener('click', startEdit);
      name.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          startEdit();
        }
      });
      idLine.replaceChildren(row, emailSpan());
    };
    renderIdLine();

    // Avatar — sits left of the name/email; click to upload, hover shows "编辑".
    // The image is downscaled + re-encoded in the browser, so almost any image is accepted.
    const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'auth-file' }) as HTMLInputElement;
    const avatarMedia = h('span', { class: 'auth-avatar-media' });
    const renderAvatar = (): void => {
      avatarMedia.replaceChildren();
      if (account!.avatar) {
        avatarMedia.append(h('img', { src: config.authOrigin + account!.avatar, alt: '' }));
      } else {
        avatarMedia.append(h('span', { class: 'auth-avatar-fallback' }, [Array.from(account!.displayName)[0] || '?']));
      }
    };
    renderAvatar();
    const avatarEdit = h(
      'button',
      { class: 'auth-avatar-edit', type: 'button', 'aria-label': text('编辑头像', '編輯頭像'), title: text('编辑', '編輯') },
      [avatarMedia, h('span', { class: 'auth-avatar-hint' }, [text('编辑', '編輯')])]
    );
    avatarEdit.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        showError(text('图片太大了', '圖片太大了'));
        return;
      }
      showError('');
      void (async () => {
        try {
          const blob = await compressImage(file);
          const res = await api.uploadAvatar(token, blob);
          account!.avatar = res.avatar;
          renderAvatar();
          onChange();
        } catch (err) {
          showError(messageFor(err));
        }
      })();
    });
    const identityRow = h('div', { class: 'auth-identity' }, [avatarEdit, idLine, fileInput]);

    // Badge picker
    const badgeRow = h('div', { class: 'auth-badges' });
    const renderBadges = (): void => {
      badgeRow.replaceChildren();
      for (const kind of BADGES) {
        const selected = account!.badge === kind;
        const swatch = h('div', { class: 'auth-badge-mark' });
        swatch.innerHTML = kind === 'none' ? '<span class="auth-badge-none">—</span>' : badgeSvg(kind, 26);
        const option = h('button', { class: `auth-badge${selected ? ' selected' : ''}`, type: 'button' }, [
          swatch,
          h('span', {}, [text(...BADGE_LABEL[kind])])
        ]);
        option.addEventListener('click', () => {
          if (account!.badge === kind) return;
          const previous = account!.badge;
          account!.badge = kind; // optimistic: reflect immediately
          renderBadges();
          onChange();
          void api.setBadge(token, kind).catch((err) => {
            account!.badge = previous; // revert on failure
            renderBadges();
            onChange();
            showError(messageFor(err));
          });
        });
        badgeRow.append(option);
      }
    };
    renderBadges();

    // Profile: bio (+visibility), personal website, public email choice.
    const profileSection = h('details', { class: 'auth-section' });
    const bioInput = document.createElement('textarea');
    bioInput.className = 'auth-bio';
    bioInput.maxLength = 50;
    bioInput.placeholder = text('写一句话介绍自己…', '寫一句話介紹自己…');
    bioInput.value = account.bio || '';
    const bioCount = h('span', { class: 'auth-bio-count' }, [`${Array.from(bioInput.value).length}/50`]);
    bioInput.addEventListener('input', () => {
      bioCount.textContent = `${Array.from(bioInput.value).length}/50`;
    });
    const bioField = h('label', { class: 'auth-field' }, [h('span', {}, [text('简介', '簡介')]), bioInput, bioCount]);

    const showBioInput = h('input', { type: 'checkbox' }) as HTMLInputElement;
    showBioInput.checked = account.showBio;
    const showBioLabel = h('label', { class: 'auth-check' }, [
      showBioInput,
      text('在评论处展示简介', '在個人檔案中展示簡介')
    ]);

    const websiteInput = input('url', text('https://…（留空则不展示）', 'https://…（留空則不展示）'), { autocomplete: 'url' });
    websiteInput.value = account.website || '';

    const emailModeSelect = document.createElement('select');
    emailModeSelect.className = 'auth-select';
    for (const [value, label] of [
      ['none', text('不公开邮箱', '不公開電子郵件')],
      ['login', text('公开登录邮箱', '公開登入電子郵件')],
      ['custom', text('公开另一个邮箱', '公開另一個電子郵件')]
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      emailModeSelect.append(option);
    }
    emailModeSelect.value = account.publicEmailMode;
    const emailModeField = h('label', { class: 'auth-field' }, [h('span', {}, [text('联系方式', '聯絡方式')]), emailModeSelect]);
    const publicEmailInput = input('email', 'public@example.com', { autocomplete: 'off' });
    publicEmailInput.value = account.publicEmail || '';
    const publicEmailField = field(text('公开邮箱地址', '公開電子郵件地址'), publicEmailInput);
    const syncEmailField = (): void => {
      publicEmailField.hidden = emailModeSelect.value !== 'custom';
    };
    syncEmailField();
    emailModeSelect.addEventListener('change', syncEmailField);

    const profileSave = h('button', { class: 'auth-submit small', type: 'button' }, [text('保存资料', '儲存資料')]);
    profileSave.addEventListener('click', async () => {
      (profileSave as HTMLButtonElement).disabled = true;
      showError('');
      try {
        const mode = emailModeSelect.value as 'none' | 'login' | 'custom';
        const { user } = await api.updateProfile(token, {
          bio: bioInput.value,
          showBio: showBioInput.checked,
          website: websiteInput.value.trim(),
          publicEmailMode: mode,
          ...(mode === 'custom' ? { publicEmail: publicEmailInput.value.trim() } : {})
        });
        account = user;
        showError(text('资料已保存', '資料已儲存'));
      } catch (err) {
        showError(messageFor(err));
      } finally {
        (profileSave as HTMLButtonElement).disabled = false;
      }
    });
    profileSection.append(
      sectionSummary(text('个人资料', '個人資料')),
      bioField,
      showBioLabel,
      field(text('个人网站', '個人網站'), websiteInput),
      emailModeField,
      publicEmailField,
      profileSave
    );

    // Password
    const passwordSection = h('details', { class: 'auth-section' });
    const newPassword = input('password', account.hasPassword ? text('新密码（至少 8 位）', '新密碼（至少 8 位）') : text('设置密码（至少 8 位）', '設定密碼（至少 8 位）'), {
      autocomplete: 'new-password'
    });
    const currentPassword = input('password', text('当前密码', '目前密碼'), { autocomplete: 'current-password' });
    const pwSubmit = h('button', { class: 'auth-submit small', type: 'button' }, [account.hasPassword ? text('修改密码', '修改密碼') : text('设置密码', '設定密碼')]);
    pwSubmit.addEventListener('click', async () => {
      pwSubmit.disabled = true;
      showError('');
      try {
        await api.setPassword(token, {
          currentPassword: account!.hasPassword ? currentPassword.value : undefined,
          newPassword: newPassword.value
        });
        account!.hasPassword = true;
        newPassword.value = '';
        currentPassword.value = '';
        showError(text('密码已更新', '密碼已更新'));
      } catch (err) {
        showError(messageFor(err));
      } finally {
        pwSubmit.disabled = false;
      }
    });
    passwordSection.append(
      sectionSummary(account.hasPassword ? text('修改密码', '修改密碼') : text('设置密码', '設定密碼')),
      ...(account.hasPassword ? [field(text('当前密码', '目前密碼'), currentPassword)] : []),
      field(text('新密码', '新密碼'), newPassword),
      pwSubmit
    );

    // Email rebind
    const emailSection = h('details', { class: 'auth-section' });
    const newEmail = input('email', text('新邮箱', '新電子郵件'), { autocomplete: 'email' });
    const emailCode = input('text', text('6 位验证码', '6 位驗證碼'), { inputmode: 'numeric', maxlength: '6', class: 'auth-code' });
    const codeField = field(text('验证码', '驗證碼'), emailCode);
    codeField.hidden = true;
    const emailSend = h('button', { class: 'auth-submit small', type: 'button' }, [text('发送验证码', '傳送驗證碼')]);
    const emailVerify = h('button', { class: 'auth-submit small', type: 'button' }, [text('验证并更换', '驗證並更換')]);
    emailVerify.hidden = true;
    emailSend.addEventListener('click', async () => {
      emailSend.disabled = true;
      showError('');
      try {
        await api.emailStart(token, newEmail.value.trim());
        codeField.hidden = false;
        emailVerify.hidden = false;
        showError(text('验证码已发送至新邮箱', '驗證碼已傳送至新電子郵件'));
      } catch (err) {
        showError(messageFor(err));
      } finally {
        emailSend.disabled = false;
      }
    });
    emailVerify.addEventListener('click', async () => {
      emailVerify.disabled = true;
      showError('');
      try {
        const { user } = await api.emailVerify(token, emailCode.value.trim());
        account = user;
        renderIdLine();
        codeField.hidden = true;
        emailVerify.hidden = true;
        newEmail.value = '';
        emailCode.value = '';
        showError(text('邮箱已更换', '電子郵件已更換'));
      } catch (err) {
        showError(messageFor(err));
      } finally {
        emailVerify.disabled = false;
      }
    });
    emailSection.append(sectionSummary(text('更换邮箱', '更換電子郵件')), field(text('新邮箱', '新電子郵件'), newEmail), emailSend, codeField, emailVerify);

    const logout = h('button', { class: 'auth-text danger', type: 'button' }, [copy.logout]);
    logout.addEventListener('click', async () => {
      try {
        await api.logout(token);
      } catch {
        /* ignore */
      }
      persist('');
      account = null;
      closeOverlay();
      onChange();
    });

    body.append(
      identityRow,
      error,
      h('div', { class: 'auth-label' }, [text('评论头像标记', '留言頭像標記')]),
      badgeRow,
      profileSection,
      passwordSection,
      emailSection,
      h('div', { class: 'auth-foot' }, [logout])
    );
    openOverlay(root);
    requestAnimationFrame(() => {
      const height = Math.max(0, Math.min(root.getBoundingClientRect().height, window.innerHeight - 32));
      root.style.height = `${height}px`;
    });
  }

  return {
    account: () => account,
    token: () => token,
    refresh,
    open: () => (account ? showProfile() : showLogin()),
    destroy: () => {
      stopGooglePoll();
      googlePopup?.close();
      closeOverlay();
      window.removeEventListener('message', onMessage);
    }
  };
}

export type Auth = ReturnType<typeof createAuth>;

import type { CommentUiConfig } from './config';

export interface CommentElements {
  app: HTMLElement;
  header: HTMLElement;
  commentTitle: HTMLElement;
  nickname: HTMLInputElement;
  textarea: HTMLTextAreaElement;
  preview: HTMLElement;
  replyTarget: HTMLButtonElement;
  status: HTMLElement;
  list: HTMLElement;
  submit: HTMLButtonElement;
  previewToggle: HTMLButtonElement;
  discloseOs: HTMLInputElement;
  closeButton: HTMLButtonElement;
  accountButton: HTMLButtonElement;
  composerIdentity: HTMLElement;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`missing_element:${selector}`);
  return element;
}

export function mountApp(app: HTMLElement, config: CommentUiConfig): CommentElements {
  const inline = config.integration === 'inline';
  const traditional = config.locale === 'zh-TW';
  const composerMarkup = inline ? `
    <section class="composer">
      <h3 class="reply-title">${traditional ? '發表留言' : '发表评论'}</h3>
      <div class="comment-form">
        <div class="editor-toolbar" role="toolbar" aria-label="${traditional ? '留言格式工具' : '评论格式工具'}">
          <button class="toolbar-button format-button toolbar-bold" type="button" data-format="bold" aria-label="${traditional ? '粗體' : '粗体'}" title="${traditional ? '粗體' : '粗体'}"><strong>B</strong></button>
          <button class="toolbar-button format-button toolbar-italic" type="button" data-format="italic" aria-label="${traditional ? '斜體' : '斜体'}" title="${traditional ? '斜體' : '斜体'}"><em>I</em></button>
          <span class="toolbar-spacer"></span>
          <button class="toolbar-button toolbar-preview preview-toggle" type="button">${traditional ? '預覽' : '预览'}</button>
        </div>
        <button class="reply-target" type="button" hidden></button>
        <div class="editor-surface">
          <textarea id="comment-content" rows="8" maxlength="2000" aria-label="${traditional ? '留言內容' : '评论内容'}" placeholder="${traditional ? '輸入留言，支援 Markdown' : '输入评论，支持 Markdown'}"></textarea>
          <div class="preview markdown" hidden></div>
        </div>
        <div class="composer-actions">
          <details class="composer-options">
            <summary>匿名</summary>
            <div class="composer-options-panel">
              <span class="composer-account-slot"></span>
              <label class="field-label nickname-label" for="comment-nickname">${traditional ? '暱稱' : '昵称'}</label>
              <input id="comment-nickname" class="nickname" maxlength="32" autocomplete="nickname" placeholder="${traditional ? '暱稱（選填）' : '昵称（选填）'}">
              <div class="composer-identity" hidden></div>
              <label class="disclose-os"><input type="checkbox">${traditional ? '顯示 UA' : '显示 UA'}</label>
            </div>
          </details>
          <span class="status" role="status"></span>
          <button class="submit" type="button" disabled>${traditional ? '留言' : '发布'}</button>
        </div>
      </div>
    </section>
  ` : `
    <section class="composer">
      <h3 class="reply-title">发表评论</h3>
      <label class="field-label nickname-label" for="comment-nickname">昵称</label>
      <input id="comment-nickname" class="nickname" maxlength="32" autocomplete="nickname" placeholder="昵称（选填）">
      <div class="composer-identity" hidden></div>
      <button class="reply-target" type="button" hidden></button>
      <label class="field-label comment-label" for="comment-content">评论</label>
      <div class="editor-surface">
        <textarea id="comment-content" rows="8" maxlength="2000" placeholder="写下评论，支持 Markdown"></textarea>
        <div class="preview markdown" hidden></div>
      </div>
      <div class="composer-actions">
        <button class="text-button preview-toggle" type="button">预览</button>
        <label class="disclose-os"><input type="checkbox">展示UA</label>
        <span class="status" role="status"></span>
        <button class="submit" type="button">发布</button>
      </div>
    </section>
  `;

  app.innerHTML = `
    <header>
      <strong class="comment-title"></strong>
      <div class="header-actions">
        <button class="icon-button account" type="button" aria-label="账户">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.6c-3.3 0-8 1.7-8 5v1.2h16v-1.2c0-3.3-4.7-5-8-5Z"/></svg>
          <span class="account-label"></span>
        </button>
        <button class="icon-button close" type="button" aria-label="关闭">×</button>
      </div>
    </header>
    ${composerMarkup}
    <section class="comment-list" aria-live="polite"></section>
    <footer>
      Powered by <a class="source-link" target="_blank" rel="noreferrer">SicSic v0.1.0</a>
    </footer>
  `;

  const elements: CommentElements = {
    app,
    header: requireElement(app, 'header'),
    commentTitle: requireElement(app, '.comment-title'),
    nickname: requireElement(app, '.nickname'),
    textarea: requireElement(app, 'textarea'),
    preview: requireElement(app, '.preview'),
    replyTarget: requireElement(app, '.reply-target'),
    status: requireElement(app, '.status'),
    list: requireElement(app, '.comment-list'),
    submit: requireElement(app, '.submit'),
    previewToggle: requireElement(app, '.preview-toggle'),
    discloseOs: requireElement(app, '.disclose-os input'),
    closeButton: requireElement(app, '.close'),
    accountButton: requireElement(app, '.account'),
    composerIdentity: requireElement(app, '.composer-identity')
  };

  elements.commentTitle.textContent = config.title;
  if (inline) elements.commentTitle.hidden = true;
  elements.header.classList.toggle('no-comment-title', inline);
  if (inline) {
    elements.accountButton.setAttribute('aria-label', traditional ? '登入或管理帳戶' : '登录或管理账户');
    requireElement(app, '.account-label').textContent = traditional ? '登入' : '登录';
    requireElement(app, '.composer-account-slot').append(elements.accountButton);
  }
  if (inline) elements.closeButton.hidden = true;
  if (inline) elements.header.hidden = true;
  try {
    elements.nickname.value = localStorage.getItem(config.nicknameStorageKey) || '';
  } catch {
    /* third-party storage may be blocked; anonymous commenting still works */
  }
  requireElement<HTMLAnchorElement>(app, '.source-link').href = config.sourceRepoUrl;
  return elements;
}

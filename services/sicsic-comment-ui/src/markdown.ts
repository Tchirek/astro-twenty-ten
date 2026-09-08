import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import type { CommentLocale } from './config';

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isSafeImageUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeLinkUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.href);
    return SAFE_URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function renderSafeMarkdown(markdown: string, locale: CommentLocale = 'zh-CN', trustedOrigins: string[] = []): string {
  const html = micromark(markdown, {
    allowDangerousHtml: false,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()]
  });

  const template = document.createElement('template');
  template.innerHTML = html;

  const trusted = new Set([window.location.origin, ...trustedOrigins.map(origin => new URL(origin || '/', window.location.href).origin)]);
  for (const image of template.content.querySelectorAll('img')) {
    const src = image.getAttribute('src') || '';
    if (!isSafeImageUrl(src)) return `<p class="preview-error">${locale === 'zh-TW' ? '圖片只允許安全 HTTPS 位址。' : '图片只允许安全 HTTPS 地址。'}</p>`;
    if (!trusted.has(new URL(src).origin)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'comment-image';
      button.dataset.commentImage = src;
      button.dataset.alt = image.getAttribute('alt') || '';
      button.textContent = (locale === 'zh-TW' ? '載入圖片' : '加载图片') + (button.dataset.alt ? ': ' + button.dataset.alt : '');
      image.replaceWith(button);
      continue;
    }
    image.setAttribute('loading', 'lazy');
    image.setAttribute('referrerpolicy', 'no-referrer');
  }

  for (const link of template.content.querySelectorAll('a')) {
    const href = link.getAttribute('href') || '';
    if (!isSafeLinkUrl(href)) {
      link.removeAttribute('href');
      continue;
    }
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noreferrer');
  }

  return template.innerHTML;
}

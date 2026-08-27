import './style.css';
import { init } from './core';
import { readFrameConfig } from './frameConfig';
import { installPanelPull } from './panelPull';
import { createParentBridge } from './parentBridge';
import type { ParentMessage } from './types';

const root = document.getElementById('app');
if (!root) throw new Error('missing_app_root');
const appRoot: HTMLElement = root;

const config = readFrameConfig();
const bridge = createParentBridge(config);
const panelPull = installPanelPull(appRoot, bridge);
const controller = init({ el: appRoot, ...config.core }, {
  onClose: () => bridge.post({ type: 'comment-ui:close' }),
  onLoaded: ({ subject, commentCount, commentedByMe }) => bridge.post({
    type: 'comment-ui:loaded',
    imageId: subject,
    commentCount,
    commentedByMe
  })
});

function applyTheme(theme: unknown): void {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
}

function onMessage(event: MessageEvent): void {
  if (!bridge.acceptMessage(event)) return;
  const data = event.data as ParentMessage | null;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'normalpics:context' && typeof data.imageId === 'string' && data.imageId) {
    controller.update({ subject: data.imageId, viewerId: typeof data.viewerId === 'string' ? data.viewerId : undefined });
    return;
  }
  if (data.type === 'normalpics:theme') {
    applyTheme(data.theme);
    return;
  }
  if (data.type === 'normalpics:admin-token' && typeof data.token === 'string' && data.token) {
    controller.update({ adminToken: data.token });
    return;
  }
  if (data.type === 'normalpics:drag-channel' && event.ports[0]) {
    bridge.setDragPort(event.ports[0]);
    return;
  }
  if (data.type === 'normalpics:panel-reset') panelPull.reset();
}

window.addEventListener('message', onMessage);

const title = appRoot.querySelector<HTMLElement>('.comment-title');
let adminTapCount = 0;
let adminTapTimer = 0;
function requestAdmin(): void {
  bridge.post({ type: 'comment-ui:request-admin' });
}
function onTitleClick(): void {
  adminTapCount += 1;
  window.clearTimeout(adminTapTimer);
  if (adminTapCount >= 5) {
    adminTapCount = 0;
    requestAdmin();
    return;
  }
  adminTapTimer = window.setTimeout(() => {
    adminTapCount = 0;
  }, 1_500);
}
title?.addEventListener('click', onTitleClick);

function onKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    requestAdmin();
  }
}
window.addEventListener('keydown', onKeydown);

let resizeFrame = 0;
let lastPostedHeight = 0;
function queueResize(): void {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    const height = Math.ceil(appRoot.scrollHeight);
    if (!height || Math.abs(height - lastPostedHeight) < 1) return;
    lastPostedHeight = height;
    bridge.post({ type: 'comment-ui:resize', height });
  });
}
const resizeObserver = new ResizeObserver(queueResize);
const mutationObserver = new MutationObserver(queueResize);
resizeObserver.observe(appRoot);
mutationObserver.observe(appRoot, { attributes: true, childList: true, characterData: true, subtree: true });
window.addEventListener('load', queueResize);

function destroy(): void {
  window.removeEventListener('message', onMessage);
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('load', queueResize);
  title?.removeEventListener('click', onTitleClick);
  resizeObserver.disconnect();
  mutationObserver.disconnect();
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  window.clearTimeout(adminTapTimer);
  panelPull.destroy();
  controller.destroy();
}
window.addEventListener('pagehide', (event) => { if (!event.persisted) destroy(); });

queueResize();
bridge.post({ type: 'comment-ui:ready' });

import assert from 'node:assert/strict';
import test from 'node:test';

test('comment presets isolate viewers while sharing the account session', async () => {
  globalThis.window = { location: { search: '?preset=normalpics' } };
  const { readFrameConfig } = await import('../src/frameConfig.ts');
  const { resolveConfig } = await import('../src/config.ts');
  const normalpics = resolveConfig({ el: '#comments', ...readFrameConfig().core });

  window.location.search = '?preset=normaldocs';
  const normaldocs = resolveConfig({ el: '#comments', ...readFrameConfig().core });
  const blog = resolveConfig({ el: '#comments', serverURL: normalpics.apiOrigin, storageNamespace: 'sicsic_blog' });

  assert.equal(normalpics.viewerStorageKey, 'normalpics_comment_viewer');
  assert.equal(normaldocs.viewerStorageKey, 'normaldocs_comment_ui_viewer');
  assert.equal(blog.viewerStorageKey, 'sicsic_blog_viewer');
  assert.equal(new Set([
    normalpics.viewerStorageKey,
    normaldocs.viewerStorageKey,
    blog.viewerStorageKey,
  ]).size, 3);
  assert.equal(normalpics.sessionStorageKey, normaldocs.sessionStorageKey);
  assert.equal(normaldocs.sessionStorageKey, blog.sessionStorageKey);
});

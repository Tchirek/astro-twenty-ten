import assert from 'node:assert/strict';
import test from 'node:test';

test('presets isolate viewers and reuse only the same-origin account storage key', async () => {
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
  assert.equal(normalpics.sourceRepoUrl, 'https://github.com/Tchirek/SicSic');
  assert.equal(normaldocs.sourceRepoUrl, 'https://github.com/Tchirek/SicSic');
  assert.equal(normaldocs.sessionStorageKey, blog.sessionStorageKey);
  assert.equal(normalpics.sessionBroker, true);
  assert.equal(normaldocs.sessionBroker, true);
  assert.equal(blog.sessionBroker, false, 'Cross-origin session access must be explicitly enabled');
});

test('Google uses independent random state and an S256 verifier', async () => {
  const { sessionProof } = await import('../src/sessionProof.ts');
  const { createHash } = await import('node:crypto');
  const first = await sessionProof();
  const second = await sessionProof();
  for (const value of Object.values(first)) assert.match(value, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.state, first.codeVerifier);
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.codeVerifier, second.codeVerifier);
  assert.equal(first.codeChallenge, createHash('sha256').update(first.codeVerifier).digest('base64url'));
});

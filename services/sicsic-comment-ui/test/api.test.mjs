import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('./') && !specifier.endsWith('.ts') && context.parentURL?.includes('/src/') ? specifier + '.ts' : specifier, context);
} });
const user = { id: 'reader', username: 'reader', displayName: 'Reader', email: null, avatar: null, bio: null, website: null, publicEmail: null,
  emailVerified: false, hasPassword: true, googleLinked: false, showBio: false, badge: 'none', publicEmailMode: 'none' };


test('Passport sends cookies for continuity and login but keeps Google verifiers out of URLs', async (t) => {
  const { createPassportApi } = await import('../src/passportApi.ts');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url, init });
    return Response.json({ token: 'session', user });
  });
  const api = createPassportApi({ authOrigin: 'https://api.example.test', sessionBroker: true });
  await api.session('saved-session');
  await api.login({ identifier: 'reader', password: 'test-password' });
  await api.logout('saved-session');
  await api.googleStart({ origin: 'https://blog.example.test', state: 'state', codeChallenge: 'challenge' }, new AbortController().signal);
  for (const { init } of calls) {
    assert.equal(init.credentials, 'include');
    assert.equal(init.method, 'POST');
  }
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer saved-session');
  await api.googleResult('private-state', 'private-verifier');
  const result = calls.at(-1);
  assert.equal(result.init.credentials, 'omit');
  assert.equal(result.init.cache, 'no-store');
  assert.equal(result.url, 'https://api.example.test/api/auth/google/result');
  assert.deepEqual(JSON.parse(result.init.body), { state: 'private-state', codeVerifier: 'private-verifier' });
});

test('comment API creates a viewer only for anonymous mutations', async () => {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ items: [], likedByMe: true, likeCount: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  let sessionToken = 'account-session';
  let peekViewerId = '';
  let peekCalls = 0;
  let requireCalls = 0;
  const { createCommentApi } = await import('../src/api.ts');
  const api = createCommentApi({ apiOrigin: 'https://api.example.test' }, {
    peekSessionViewerId() {
      peekCalls += 1;
      return peekViewerId;
    },
    requireSessionViewerId() {
      requireCalls += 1;
      return 'session-viewer-123456';
    },
    adminToken: () => '',
    sessionToken: () => sessionToken,
  });

  await api.list('image-123456');
  let headers = new Headers(calls.at(-1).init.headers);
  assert.equal(headers.has('X-Viewer-Id'), false);
  assert.equal(headers.has('Content-Type'), false);
  assert.equal(requireCalls, 0);

  peekViewerId = 'existing-session-viewer';
  await api.list('image-123456');
  headers = new Headers(calls.at(-1).init.headers);
  assert.equal(headers.get('X-Viewer-Id'), 'existing-session-viewer');
  assert.equal(requireCalls, 0);

  await api.publish({
    imageId: 'image-123456',
    nickname: '',
    content: 'Signed in',
    parentId: null,
  });
  headers = new Headers(calls.at(-1).init.headers);
  assert.equal(headers.get('Authorization'), 'Bearer account-session');
  assert.equal(headers.has('X-Viewer-Id'), false);
  assert.equal(requireCalls, 0);

  sessionToken = '';
  await api.publish({
    imageId: 'image-123456',
    nickname: 'Anonymous',
    content: 'Anonymous',
    parentId: null,
  });
  headers = new Headers(calls.at(-1).init.headers);
  assert.equal(headers.has('Authorization'), false);
  assert.equal(headers.get('X-Viewer-Id'), 'session-viewer-123456');
  assert.equal(requireCalls, 1);
  assert.equal(peekCalls, 2);

  await api.setLike('comment-123456', true);
  headers = new Headers(calls.at(-1).init.headers);
  assert.equal(headers.get('X-Viewer-Id'), 'session-viewer-123456');
  assert.equal(requireCalls, 2);
});

test('malformed JSON, comment shapes, likes and sessions fail explicitly', async (t) => {
  const { createCommentApi } = await import('../src/api.ts');
  const { createPassportApi } = await import('../src/passportApi.ts');
  let body = '<html>not JSON</html>';
  t.mock.method(globalThis, 'fetch', async () => new Response(body));
  const api = createCommentApi({ apiOrigin: '' }, { peekSessionViewerId: () => '', requireSessionViewerId: () => 'fixture-viewer', sessionToken: () => '', adminToken: () => '' });
  await assert.rejects(api.list('one'), /invalid_response/);
  for (const invalid of [{}, { items: null }, { items: [{}] }, { items: [], commentedByMe: 'yes' }]) {
    body = JSON.stringify(invalid);
    await assert.rejects(api.list('one'), /invalid_response/);
  }
  for (const invalid of [{ likedByMe: 'yes', likeCount: 1 }, { likedByMe: true, likeCount: -1 }, { likedByMe: false, likeCount: 0.5 }]) {
    body = JSON.stringify(invalid);
    await assert.rejects(api.setLike('one', true), /invalid_response/);
  }
  const passport = createPassportApi({ authOrigin: '', sessionBroker: true });
  for (const invalid of [{}, { token: 'saved', user: null }, { token: 'saved', user: {} }]) {
    body = JSON.stringify(invalid);
    await assert.rejects(passport.session(), /invalid_response/);
  }
  body = JSON.stringify({ profiles: { reader: { displayName: 'Reader', email: true } } });
  await assert.rejects(passport.profiles(['reader']), /invalid_response/);
});

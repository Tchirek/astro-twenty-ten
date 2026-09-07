import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

test('Passport sends cookies for continuity and login but keeps Google verifiers out of URLs', async (t) => {
  const resolver = registerHooks({ resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === './api' && context.parentURL?.endsWith('/passportApi.ts') ? './api.ts' : specifier, context);
  } });
  const { createPassportApi } = await import('../src/passportApi.ts');
  resolver.deregister();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url, init });
    return Response.json({});
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
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
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

import assert from 'node:assert/strict';
import test from 'node:test';

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

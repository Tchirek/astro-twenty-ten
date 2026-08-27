import assert from 'node:assert/strict';
import test from 'node:test';
import { paginate, postOgPath, postPath, publishedAt, readingMinutes, slugify, sortPosts, validatePostPaths } from './blog.ts';

test('published posts are neither drafts nor future-dated', () => {
  const isPublished = publishedAt(new Date('2026-08-27T12:00:00Z'));

  assert.equal(isPublished({ data: { draft: true, date: new Date('2026-08-26T12:00:00Z') } } as never), false);
  assert.equal(isPublished({ data: { draft: false, date: new Date('2026-08-26T12:00:00Z') } } as never), true);
  assert.equal(isPublished({ data: { draft: false, date: new Date('2026-08-27T12:00:00Z') } } as never), true);
  assert.equal(isPublished({ data: { draft: false, date: new Date('2026-08-28T12:00:00Z') } } as never), false);
});

test('blog helpers keep routes stable and content ordered', () => {
  assert.equal(slugify('C++ & C#'), 'c-plus-plus-and-c-sharp');
  assert.equal(slugify('生活 随笔'), '生活-随笔');
  assert.equal(readingMinutes('hello world'), 1);
  assert.equal(readingMinutes('文'.repeat(401)), 2);
  const dated = { id: 'dated', data: { date: new Date('2020-01-02'), slug: 'Hello World' } };
  const custom = { id: 'custom', data: { date: new Date('2020-01-02'), slug: 'ignored', permalink: '/notes/hello/' } };
  assert.equal(postPath(dated), '/2020/01/02/hello-world/');
  assert.equal(postPath(custom), '/notes/hello/');
  assert.equal(postOgPath(custom), '/og/ignored.png');
  assert.doesNotThrow(() => validatePostPaths([dated, custom]));
  assert.throws(
    () => validatePostPaths([custom, { ...custom, id: 'duplicate' }]),
    /share permalink/,
  );
  assert.throws(
    () => validatePostPaths([{ ...custom, data: { ...custom.data, permalink: '/search/post/' } }]),
    /reserved permalink/,
  );
  assert.throws(
    () => validatePostPaths([dated, { ...custom, id: 'same-og', data: { ...custom.data, slug: 'Hello World' } }]),
    /share OG image/,
  );
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

  const older = { data: { date: new Date('2020-01-01') } };
  const newer = { data: { date: new Date('2021-01-01') } };
  assert.deepEqual(sortPosts([older, newer]), [newer, older]);
});

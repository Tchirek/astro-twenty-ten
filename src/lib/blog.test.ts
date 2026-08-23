import assert from 'node:assert/strict';
import test from 'node:test';
import { paginate, postPath, readingMinutes, slugify, sortPosts, validatePostPaths } from './blog.ts';

test('blog helpers keep routes stable and content ordered', () => {
  assert.equal(slugify('C++ & C#'), 'c-plus-plus-and-c-sharp');
  assert.equal(slugify('生活 随笔'), '生活-随笔');
  assert.equal(readingMinutes('hello world'), 1);

  const dated = { id: 'dated', data: { date: new Date('2020-01-02'), slug: 'Hello World' } };
  const custom = { id: 'custom', data: { date: new Date('2020-01-02'), slug: 'ignored', permalink: '/notes/hello/' } };
  assert.equal(postPath(dated), '/2020/01/02/hello-world/');
  assert.equal(postPath(custom), '/notes/hello/');
  assert.doesNotThrow(() => validatePostPaths([dated, custom]));
  assert.throws(
    () => validatePostPaths([custom, { ...custom, id: 'duplicate' }]),
    /share permalink/,
  );
  assert.throws(
    () => validatePostPaths([{ ...custom, data: { ...custom.data, permalink: '/search/post/' } }]),
    /reserved permalink/,
  );
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

  const older = { data: { date: new Date('2020-01-01') } };
  const newer = { data: { date: new Date('2021-01-01') } };
  assert.deepEqual(sortPosts([older, newer]), [newer, older]);
});

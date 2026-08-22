import assert from 'node:assert/strict';
import test from 'node:test';
import { readingMinutes, slugify, sortPosts } from './blog.ts';

test('blog helpers keep routes stable and content ordered', () => {
  assert.equal(slugify('C++ & C#'), 'c-plus-plus-and-c-sharp');
  assert.equal(slugify('生活 随笔'), '生活-随笔');
  assert.equal(readingMinutes('hello world'), 1);

  const older = { data: { date: new Date('2020-01-01') } };
  const newer = { data: { date: new Date('2021-01-01') } };
  assert.deepEqual(sortPosts([older, newer]), [newer, older]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSearchIndex, markdownText, querySearch, tokenize } from './search.ts';

const index = buildSearchIndex([
  {
    title: 'Astro publishing',
    tags: ['Static'],
    description: 'A modern publishing architecture.',
    body: 'Readable HTML first.',
    url: '/astro/',
    date: '2026-01-01T00:00:00.000Z',
  },
  {
    title: 'Web notes',
    tags: ['Astro'],
    description: 'Small experiments.',
    body: 'Astro appears in the body too. 现代静态出版保持内容可读。',
    url: '/notes/',
    date: '2025-01-01T00:00:00.000Z',
  },
]);

test('search builds weighted rankings and CJK bigrams', () => {
  assert.equal(querySearch(index, 'Astro')[0].url, '/astro/');
  assert.equal(querySearch(index, '现代')[0].url, '/notes/');
  assert.equal(querySearch(index, 'Astro readable')[0].url, '/astro/');
  assert.equal(querySearch(index, 'missing').length, 0);
  assert.deepEqual(tokenize('现代 Web'), ['现', '代', '现代', 'web']);
  assert.match(querySearch(index, '静态')[0].snippet, /静态/);
});

test('markdown text keeps useful words and removes syntax', () => {
  assert.equal(markdownText('[Astro](https://astro.build/) and `HTML`'), 'Astro and HTML');
});

import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('production build emits durable discovery and taxonomy routes', async () => {
  const paths = [
    'index.html',
    'archives/index.html',
    'category/programming/index.html',
    'tag/astro/index.html',
    '2026/08/23/twenty-ten-on-astro/index.html',
    'rss.xml',
    'atom.xml',
    'sitemap-index.xml',
  ];
  await Promise.all(paths.map((path) => access(new URL(`../dist/${path}`, import.meta.url))));

  const home = await read('index.html');
  assert.match(home, /href="\/category\/programming\/"/);
  assert.match(home, /href="\/tag\/astro\/"/);

  const category = await read('category/programming/index.html');
  assert.match(category, /href="\/2026\/08\/23\/twenty-ten-on-astro\/"/);
});

test('canonical, feeds, search, and OG metadata share the permalink', async () => {
  const permalink = 'https://example.com/2026/08/23/twenty-ten-on-astro/';
  const article = await read('2026/08/23/twenty-ten-on-astro/index.html');
  assert.match(article, new RegExp(`<link rel="canonical" href="${permalink}">`));
  assert.match(article, /content="https:\/\/example\.com\/og\/twenty-ten-on-astro\.png"/);
  assert.match(article, /target="_blank" rel="external noopener" class="external-link"/);

  assert.match(await read('rss.xml'), new RegExp(permalink));
  assert.match(await read('atom.xml'), new RegExp(permalink));
  assert.match(await read('search/index.html'), /"postings":/);

  const png = await readFile(new URL('../dist/og/twenty-ten-on-astro.png', import.meta.url));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

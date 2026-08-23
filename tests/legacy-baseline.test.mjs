import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('core documents contain readable HTML independently of scripts', async () => {
  const pages = [
    ['index.html', 'Twenty Ten, Still Quietly Good'],
    ['2026/08/23/twenty-ten-on-astro/index.html', 'Twenty Ten never asked'],
    ['archives/index.html', 'Welcome to the Archive'],
  ];

  for (const [path, text] of pages) {
    const html = await read(path);
    const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    assert.match(withoutScripts, /<main id="content">/);
    assert.match(withoutScripts, /<nav class="primary-nav" aria-label="Primary navigation">/);
    assert.match(withoutScripts, new RegExp(text));
    assert.match(html, /<link rel="stylesheet" href="\/_astro\/[^"?]+\.css">/);
    assert.match(html, /<meta name="astro-view-transitions-enabled" content="true">/);
  }
});

test('legacy CSS and image fallbacks precede modern enhancements', async () => {
  const assets = await readdir(new URL('../dist/_astro/', import.meta.url));
  const css = (await Promise.all(assets.filter((name) => name.endsWith('.css')).map((name) => read(`_astro/${name}`)))).join('\n');
  const article = await read('2026/08/23/twenty-ten-on-astro/index.html');

  assert.match(css, /#content\s*\{[^}]*float:\s*left;[^}]*width:\s*640px;/);
  assert.match(css, /\.sidebar\s*\{[^}]*float:\s*right;[^}]*width:\s*220px;/);
  assert.match(css, /@supports \(display:\s*grid\)/);
  assert.doesNotMatch(css, /outline:\s*1px dotted/);
  assert.doesNotMatch(css, /@view-transition\s*\{[^}]*navigation:\s*auto/);
  assert.match(css, /article,\s*aside,\s*footer,\s*header,\s*main,\s*nav,\s*picture,\s*section\s*\{\s*display:\s*block;/);
  assert.match(article, /<!--\[if lt IE 9\]><script>/);
  assert.match(article, /<picture class="header-picture"><source[^>]+type="image\/webp"[^>]*><img src="[^"]+\.png"/);
});

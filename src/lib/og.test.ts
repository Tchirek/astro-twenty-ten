import assert from 'node:assert/strict';
import test from 'node:test';
import { renderOgSvg, wrapTitle } from './og.ts';

test('OG SVG wraps long titles and escapes content', () => {
  assert.deepEqual(wrapTitle('123456789', 4, 3), ['1234', '5678', '9']);
  const truncated = wrapTitle('123456789', 4, 2);
  assert.equal(truncated.at(-1), '5678…');

  const svg = renderOgSvg({
    title: 'Astro & the <old> Web',
    date: 'August 23, 2026',
    categories: ['Web'],
    siteName: 'Twenty Ten Notes',
  });
  assert.match(svg, /Astro &amp; the &lt;old&gt; Web/);
  assert.match(svg, /TWENTY TEN · MODERN ASTRO EDITION/);
});

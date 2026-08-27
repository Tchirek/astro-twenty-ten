import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

const blogDist = new URL('../dist/', import.meta.url);
const gzipBytes = (value) => gzipSync(value, { level: 9 }).byteLength;

test('Blog ships only the inline core and host comment styles on first load', async (t) => {
  const article = await readFile(new URL('2026/08/23/twenty-ten-on-astro/index.html', blogDist), 'utf8');
  assert.doesNotMatch(article, /<iframe|(?:href|src)="[^"]*passport/);
  const scripts = [...article.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
  const coreScripts = scripts.filter((path) => path.includes('Comments.astro_'));
  assert.equal(coreScripts.length, 1, 'Expected one inline comment bootstrap');
  const core = await readFile(new URL(coreScripts[0].replace(/^\//, ''), blogDist));
  const coreSize = gzipBytes(core);
  assert.ok(coreSize <= 12 * 1024, `Blog core + bootstrap exceeds 12 KiB: ${coreSize}`);
  assert.doesNotMatch(core.toString(), /postMessage|normalpics:|\/api\/auth\/|auth-overlay|auth-google/);

  const assets = await readdir(new URL('_astro/', blogDist));
  const css = await Promise.all(assets.filter((name) => name.endsWith('.css')).map((name) => readFile(new URL(`_astro/${name}`, blogDist), 'utf8')));
  const commentStyles = css.filter((source) => source.includes('.comments .comment-form'));
  assert.equal(commentStyles.length, 1, 'Expected one host-owned comment stylesheet');
  const cssSize = gzipBytes(commentStyles[0]);
  assert.ok(cssSize <= 4 * 1024, `Comment CSS exceeds 4 KiB: ${cssSize}`);
  t.diagnostic(`Blog core + bootstrap: ${coreSize} / 12288 gzip bytes; comment CSS: ${cssSize} / 4096`);
});

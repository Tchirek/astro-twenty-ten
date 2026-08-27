import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

const dist = new URL('../dist/', import.meta.url);

test('anonymous core and frame adapter stay separate and within gzip budgets', async (t) => {
  const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', dist), 'utf8'));
  function graph(entry, seen = new Set()) {
    assert.ok(manifest[entry], `Missing build entry: ${entry}`);
    if (seen.has(entry)) return seen;
    seen.add(entry);
    for (const dependency of manifest[entry].imports || []) graph(dependency, seen);
    return seen;
  }
  const core = graph('src/core.ts');
  const frame = [...graph('index.html')].filter((entry) => !core.has(entry));
  assert.ok(manifest['src/passport.ts']?.isDynamicEntry, 'Passport must remain a lazy entry');
  assert.ok(!core.has('src/passport.ts'), 'Passport must not enter the anonymous static graph');

  for (const [name, entries, limit] of [['core', [...core], 12 * 1024], ['frame adapter', frame, 3 * 1024]]) {
    const sources = await Promise.all(entries.map((entry) => readFile(new URL(manifest[entry].file, dist))));
    const size = sources.reduce((total, source) => total + gzipSync(source, { level: 9 }).byteLength, 0);
    t.diagnostic(`${name}: ${size} / ${limit} gzip bytes`);
    assert.ok(size <= limit, `${name} exceeds its gzip budget: ${size} > ${limit}`);
    if (name === 'core') {
      assert.doesNotMatch(sources.join('\n'), /postMessage|normalpics:|comment-ui:ready|\/api\/auth\/|auth-overlay|auth-google/);
    }
  }
});

test('corresponding-source archive excludes private deployment files', () => {
  const archive = fileURLToPath(new URL('sicsic-comment-ui-source.tar.gz', dist));
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/);
  const allowed = new Set(['src', 'test', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'LICENSE', 'NOTICE', 'INTEGRATION.md', 'MODIFICATIONS.md', 'THREAT_MODEL.md', '.env.example', 'wrangler.example.toml']);
  for (const entry of entries) {
    assert.ok(allowed.has(entry.split('/')[0]), `Unexpected archive entry: ${entry}`);
    assert.doesNotMatch(entry, /(^|\/)(\.git|\.wrangler|node_modules|\.dev\.vars|\.env(?!\.example$)|wrangler\.toml|\.\.)($|[./])/);
  }
  for (const required of ['src/core.ts', 'src/passport.ts', 'src/frame.ts', 'wrangler.example.toml', 'LICENSE']) {
    assert.ok(entries.includes(required), `Missing corresponding source: ${required}`);
  }
});

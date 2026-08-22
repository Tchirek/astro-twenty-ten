export function GET({ site }: { site: URL | undefined }) {
  const base = site ?? new URL('https://example.com');
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', base)}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

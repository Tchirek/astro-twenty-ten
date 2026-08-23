import siteConfig from '../../site.config.ts';

export function GET({ site }: { site: URL | undefined }) {
  const base = site ?? new URL(siteConfig.site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', base)}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

import siteConfig from '../../site.config.ts';

export function GET() {
  return new Response(JSON.stringify({
    name: siteConfig.title,
    short_name: siteConfig.title.replace(/\s+Notes$/, ''),
    start_url: '/',
    display: 'standalone',
    background_color: '#f1f1f1',
    theme_color: '#111111',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }), { headers: { 'Content-Type': 'application/manifest+json' } });
}

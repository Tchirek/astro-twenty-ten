import { getCollection } from 'astro:content';
import siteConfig from '../../site.config.ts';
import { postPath, published, sortPosts } from '../lib/blog';

const xml = (value: string) => value.replace(/[<>&"']/g, (character) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
})[character]!);

export async function GET({ site }: { site: URL | undefined }) {
  const base = site ?? new URL(siteConfig.site);
  const posts = sortPosts((await getCollection('blog')).filter(published));
  const updated = (posts[0]?.data.updated ?? posts[0]?.data.date ?? new Date(0)).toISOString();
  const entries = posts.map((post) => {
    const url = new URL(postPath(post), base).href;
    return `<entry><title>${xml(post.data.title)}</title><id>${xml(url)}</id><link href="${xml(url)}"/><updated>${(post.data.updated ?? post.data.date).toISOString()}</updated><published>${post.data.date.toISOString()}</published><author><name>${xml(post.data.author)}</name></author><summary>${xml(post.data.description)}</summary></entry>`;
  }).join('');

  const body = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${xml(siteConfig.title)}</title><subtitle>${xml(siteConfig.description)}</subtitle><id>${xml(base.href)}</id><link href="${xml(new URL('/atom.xml', base).href)}" rel="self"/><link href="${xml(base.href)}"/><updated>${updated}</updated>${entries}</feed>`;
  return new Response(body, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}

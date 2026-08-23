import type { CollectionEntry } from 'astro:content';
import siteConfig from '../../site.config.ts';

export type BlogPost = CollectionEntry<'blog'>;

export const published = (post: BlogPost) => !post.data.draft;

export function sortPosts<T extends { data: { date: Date } }>(posts: T[]) {
  return [...posts].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/&/g, ' and ')
    .toLocaleLowerCase(siteConfig.language)
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

interface PostRoute {
  id?: string;
  data: {
    date: Date;
    permalink?: string;
    slug: string;
  };
}

export function postPath(post: PostRoute) {
  if (post.data.permalink) return post.data.permalink;

  const year = post.data.date.getUTCFullYear();
  const month = String(post.data.date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(post.data.date.getUTCDate()).padStart(2, '0');
  return `/${year}/${month}/${day}/${slugify(post.data.slug)}/`;
}

const reservedRoutes = /^\/(?:404(?:\/|$)|about(?:\/|$)|archives(?:\/|$)|atom\.xml(?:\/|$)|category(?:\/|$)|feed(?:\/|$)|og(?:\/|$)|page(?:\/|$)|robots\.txt(?:\/|$)|rss\.xml(?:\/|$)|search(?:\/|$)|site\.webmanifest(?:\/|$)|tag(?:\/|$))/i;

export function validatePostPaths(posts: PostRoute[]) {
  const seen = new Map<string, string>();
  for (const post of posts) {
    const path = postPath(post);
    const name = post.id ?? post.data.slug;
    if (reservedRoutes.test(path)) throw new Error(`Post "${name}" uses reserved permalink ${path}`);

    const key = path.toLocaleLowerCase('en');
    const duplicate = seen.get(key);
    if (duplicate) throw new Error(`Posts "${duplicate}" and "${name}" share permalink ${path}`);
    seen.set(key, name);
  }
}

export function paginate<T>(items: T[], pageSize = siteConfig.postsPerPage) {
  return Array.from({ length: Math.ceil(items.length / pageSize) }, (_, index) =>
    items.slice(index * pageSize, (index + 1) * pageSize),
  );
}

const fullDate = new Intl.DateTimeFormat(siteConfig.language, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const monthDate = new Intl.DateTimeFormat(siteConfig.language, {
  year: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export const formatDate = (date: Date) => fullDate.format(date);
export const formatMonth = (date: Date) => monthDate.format(date);
export const monthKey = (date: Date) => date.toISOString().slice(0, 7);

export function readingMinutes(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>\[\]()!-]/g, ' ');
  const cjk = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const words = text
    .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(cjk / 400 + words / 200));
}

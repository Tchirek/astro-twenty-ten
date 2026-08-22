import type { CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export const POSTS_PER_PAGE = 5;

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
    .toLocaleLowerCase('en')
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function postPath(post: BlogPost) {
  if (post.data.legacyUrl) return post.data.legacyUrl;

  const year = post.data.date.getUTCFullYear();
  const month = String(post.data.date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(post.data.date.getUTCDate()).padStart(2, '0');
  return `/${year}/${month}/${day}/${slugify(post.data.slug)}/`;
}

const fullDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const monthDate = new Intl.DateTimeFormat('en-US', {
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

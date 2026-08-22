import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { postPath, published, sortPosts } from '../lib/blog';

export async function GET(context) {
  const posts = sortPosts((await getCollection('blog')).filter(published));

  return rss({
    title: 'Twenty Ten Notes',
    description: 'Notes on software, systems, and the small things learned along the way.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postPath(post),
      categories: [...post.data.categories, ...post.data.tags],
    })),
    customData: '<language>en-us</language>',
  });
}

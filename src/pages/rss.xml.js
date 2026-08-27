import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { postPath, published, sortPosts } from '../lib/blog';
import siteConfig from '../../site.config.ts';

export async function GET(context) {
  const posts = sortPosts((await getCollection('blog')).filter(published));

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postPath(post),
      categories: [...post.data.categories, ...post.data.tags],
    })),
    customData: `<language>${siteConfig.language}</language><copyright>${siteConfig.footer.prefix} ${siteConfig.footer.label}</copyright>`,
  });
}

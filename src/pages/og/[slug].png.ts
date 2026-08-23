import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import sharp from 'sharp';
import siteConfig from '../../../site.config.ts';
import { formatDate, postOgPath, published, sortPosts, validatePostPaths } from '../../lib/blog';
import { renderOgSvg } from '../../lib/og';

export const getStaticPaths = (async () => {
  const posts = sortPosts((await getCollection('blog')).filter(published));
  validatePostPaths(posts);
  return posts.map((post) => ({
    params: { slug: postOgPath(post).split('/').at(-1)!.replace(/\.png$/, '') },
    props: {
      title: post.data.title,
      date: formatDate(post.data.date),
      categories: post.data.categories,
    },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const svg = renderOgSvg({
    title: props.title,
    date: props.date,
    categories: props.categories,
    siteName: siteConfig.title,
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

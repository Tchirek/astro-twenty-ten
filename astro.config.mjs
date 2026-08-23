import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import siteConfig from './site.config.ts';
import rehypeTwentyTen from './src/lib/rehype-twenty-ten.ts';

const site = process.env.SITE_URL || siteConfig.site;

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
  redirects: {
    '/feed': '/rss.xml',
  },
  markdown: {
    processor: unified({
      rehypePlugins: [[rehypeTwentyTen, { site }]],
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
      wrap: true,
    },
  },
});

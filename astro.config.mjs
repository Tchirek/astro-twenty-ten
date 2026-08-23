import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import siteConfig from './site.config.ts';

const site = process.env.SITE_URL || siteConfig.site;

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
  redirects: {
    '/feed': '/rss.xml',
  },
  markdown: {
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

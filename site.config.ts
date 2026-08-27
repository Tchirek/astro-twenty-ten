export interface SiteConfig {
  title: string;
  description: string;
  site: string;
  language: string;
  author: {
    name: string;
    url?: string;
  };
  navigation: Array<{
    label: string;
    href: string;
  }>;
  postsPerPage: number;
  social: {
    twitterSite?: string;
    twitterCreator?: string;
  };
  appearance: {
    darkMode: boolean;
  };
  features: {
    search: boolean;
    toc: boolean;
    readingTime: boolean;
    codeCopy: boolean;
  };
  footer: {
    prefix: string;
    label: string;
    href: string;
  };
}

export function defineSiteConfig(config: SiteConfig): SiteConfig {
  const site = new URL(config.site);
  if (site.pathname !== '/') throw new Error('site must be an origin without a path');
  if (!Number.isInteger(config.postsPerPage) || config.postsPerPage < 1) {
    throw new Error('postsPerPage must be a positive integer');
  }
  return config;
}

const siteUrl = 'https://blog.tchirek.top';

export default defineSiteConfig({
  title: 'Tchirek Afra',
  description: "Tchirek Afra's notes on software, systems, and the small things learned along the way.",
  site: siteUrl,
  language: 'en',
  author: {
    name: 'Tchirek Afra',
    url: siteUrl,
  },
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Archives', href: '/archives/' },
  ],
  postsPerPage: 5,
  social: {},
  appearance: {
    darkMode: true,
  },
  features: {
    search: true,
    toc: true,
    readingTime: true,
    codeCopy: true,
  },
  footer: {
    prefix: 'Copyleft 🄯 2024-2026 Tchirek Afra. Licensed under',
    label: 'CC BY-NC-SA 4.0',
    href: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },
});

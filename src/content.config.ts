import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import siteConfig from '../site.config.ts';

const blog = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: '**/*.{md,mdx}',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string().default(siteConfig.author.name),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featuredImage: z.string().optional(),
    permalink: z.string().regex(/^\/(?:[^/?#]+\/)+$/).optional(),
    canonical: z.url().optional(),
  }),
});

export const collections = { blog };

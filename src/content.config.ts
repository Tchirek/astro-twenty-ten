import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
    author: z.string().default('Demo Author'),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featuredImage: z.string().optional(),
    legacyUrl: z.string().regex(/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/).optional(),
    canonical: z.url().optional(),
  }),
});

export const collections = { blog };

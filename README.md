# astro-twenty-ten

A lightweight Astro blog that carries the classic WordPress Twenty Ten design into a static site.

Write Markdown and MDX posts in `src/content/blog`.

## Features

- Faithful Twenty Ten desktop proportions and typography
- Responsive mobile layout
- Markdown and MDX with Astro Content Collections
- Categories, tags, archives, pagination, and dated post URLs
- RSS feed, sitemap, syntax highlighting, and table of contents
- Static search
- Automatic system theme with a light/dark switch
- Static HTML with minimal client-side JavaScript

## Run

Requires Node.js 22.18 or newer.

```bash
npm ci
npm run dev
```

Use `npm test` for the route/content helper check and `npm run build` for the production build. Set `SITE_URL` to the final origin before building for deployment.

## Write

Add a `.md` or `.mdx` file under `src/content/blog`:

```yaml
---
title: "Post title"
description: "One useful sentence."
slug: "post-title"
date: 2026-08-23T08:00:00Z
categories: [Web]
tags: [Astro]
---
```

All bundled posts and identities are fictional demo data. The bundled header image was generated for this demo.

## License

AGPL-3.0-or-later. Modified versions offered over a network must make their corresponding source available to users. The visual design is inspired by the WordPress Twenty Ten theme, originally distributed under the GNU General Public License.

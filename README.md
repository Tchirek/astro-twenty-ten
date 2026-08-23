# astro-twenty-ten

A modern Astro recreation inspired by WordPress Twenty Ten's visual language and URL conventions.

Built with modern Astro tooling, but with an HTML/CSS baseline suitable for browsers from the original Twenty Ten era. Modern capabilities are layered on through progressive enhancement and are never required to read or navigate the site.

> Legacy compatibility is a floor, not a ceiling.

## What it includes

- Twenty Ten's 940px desktop proportions, typography, header treatment, sidebar, and chronological publishing model
- Responsive Grid/Flex enhancement over a float/block baseline
- Astro Content Collections with Markdown and MDX
- Configurable permalinks, categories, tags, archives, pagination, RSS, Atom, sitemap, canonical metadata, JSON-LD, Open Graph, and Twitter cards
- One local `rehype-twenty-ten` build transform for heading permalinks, external-link policy, figures, code metadata, images, and table accessibility
- Weighted zero-server search with title/tag/description/body ranking, snippets, tokenization, and CJK bigrams
- CJK-aware reading time, font fallbacks, ruby styling, and modern typography properties where supported
- Build-time Twenty Ten-style PNG social images
- Dark mode, code copy, and <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> as optional modern JavaScript enhancements
- PNG image and CSS 2.1-style layout fallbacks, plus an isolated conditional HTML5 element shim for IE below 9

This is a recreation, not a promise of seamless WordPress migration or perfect support for every historical browser.

## Configure

Edit `site.config.ts` for normal theme use. It owns the title, description, canonical site URL, author, language, navigation, page size, social metadata, appearance, feature flags, and footer credit. Presentation components should not need editing for these values.

`SITE_URL` can override the configured origin in a deployment build:

```bash
SITE_URL=https://notes.example.com npm run build
```

On PowerShell:

```powershell
$env:SITE_URL = 'https://notes.example.com'
npm run build
```

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
permalink: "/2026/08/23/post-title/"
---
```

`permalink` is optional. Without it, the URL is generated from the UTC date and slug. Builds fail on duplicate post routes, reserved theme routes, or duplicate OG image slugs.

MDX can use the static `Aside`, `Details`, `Figure`, and `YouTube` components without a client framework. Their essential content remains ordinary HTML.

External HTTP(S) links in Markdown/MDX are classified at build time using the configured site origin. External text links receive `_blank`, `rel="external noopener"`, and a quiet `↗`; same-origin absolute links, relative links, hash links, `mailto:`, and `tel:` stay internal. Image links do not receive the arrow.

## JavaScript contract

The article body, navigation, archives, pagination, categories, tags, footer, and feeds are static HTML. Runtime code is limited to behavior that build time and native HTML/CSS cannot know or perform:

- the reader's saved color preference;
- the current search query and keyboard shortcut;
- writing a code block to the clipboard.

If modules or these APIs fail, core reading and navigation remain intact. Search falls back to archives, categories, and tags. Native cross-document View Transitions are enabled only where the browser supports them; navigation remains a normal multi-page document load.

## Browser contract

| Browser class | Intended experience | Repository verification |
| --- | --- | --- |
| Current Chromium, Firefox, WebKit | Responsive layout, dark mode, weighted search, code copy, TOC/permalinks, accessibility smoke | Automated with Playwright |
| JavaScript disabled | Complete reading, navigation, taxonomy, archives, and feeds | Automated in Chromium plus static-output checks |
| IE8-era engines | 940px readable/navigable baseline with PNG image fallback | Targeted by output; **not claimed as currently engine-verified** |
| IE7 | Best-effort readable and navigable | Manual only |
| IE6 | Best-effort content; no architecture-polluting hacks | Manual only |

Use a real VM, BrowserStack, Sauce Labs, or another credible engine for legacy release verification—never a changed Chromium user agent. See [the legacy release checklist](docs/legacy-testing.md).

## Develop and verify

Requires Node.js 22.18 or newer.

```bash
npm ci
npm run dev
```

Verification commands:

```bash
npm run lint          # Astro/TypeScript diagnostics
npm test              # route helpers, HAST transform, search, OG logic
npm run build         # checked production build
npm run test:routes   # built routes, metadata, feeds, and legacy structure
npm run test:e2e      # Chromium, Firefox, and WebKit smoke tests
npm run test:visual   # compare Chromium visual snapshots
```

Run `npm run test:visual:update` only after intentionally reviewing visual changes. CI runs diagnostics, unit tests, production build, built-output tests, and all three modern browser projects. Visual snapshots remain an explicit review step because system-font rasterization differs by platform.

All bundled posts and identities are fictional demo data. The bundled header image was generated for this demo.

## License

AGPL-3.0-only. Modified versions offered over a network must make their corresponding source available to users. The visual design is inspired by the WordPress Twenty Ten theme, originally distributed under the GNU General Public License.

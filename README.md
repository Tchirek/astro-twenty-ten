# astro-twenty-ten

A modern Astro recreation inspired by WordPress Twenty Ten's visual language and URL conventions.

Public source for Tchirek Afra's Blog. This checkout retains the public site identity and service presets, but excludes private backend patches, production Worker configuration and credentials. Publishing this repository does not deploy the Blog.

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
- Dark mode, code copy, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd>, and SicSic comments as optional modern JavaScript enhancements
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

Only non-draft posts dated at or before the fixed build instant are published. A future post needs another build after its date; there is no background scheduler. Tests inject a date with `publishedAt(now)`. Article JSON-LD uses the same byline as the page, and only the site author's byline receives the site-author URL.

MDX can use the static `Aside`, `Details`, `Figure`, and `YouTube` components without a client framework. Their essential content remains ordinary HTML.

External HTTP(S) links in Markdown/MDX are classified at build time using the configured site origin. External text links receive `_blank`, `rel="external noopener"`, and a quiet `↗`; same-origin absolute links, relative links, hash links, `mailto:`, and `tel:` stay internal. Image links do not receive the arrow.

## JavaScript contract

The article body, navigation, archives, pagination, categories, tags, footer, and feeds are static HTML. Runtime code is limited to behavior that build time and native HTML/CSS cannot know or perform:

- the reader's saved color preference;
- the current search query and keyboard shortcut;
- writing a code block to the clipboard;
- mounting native SicSic comments near the viewport, with optional identity UI loaded on demand.

If modules or these APIs fail, core reading and navigation remain intact. Search falls back to archives, categories, and tags, while comments remain an optional enhancement. Navigation uses normal multi-page document loads, without ClientRouter or transition lifecycle code.

The single SicSic source package lives in `services/sicsic-comment-ui`: `core` mounts inline, `passport` supplies lazy account/profile features, and `frame` retains the NormalPics/NormalDocs panel. Blog owns its comment CSS in `src/styles/comments.css`; there is no Blog iframe or bridge. Reading does not create a viewer ID or initialize a stored account. A like or anonymous publication creates a tab-scoped ID in `sessionStorage` (memory-only if storage is blocked); signed-in publication does not create an extra anonymous ID.

Comment avatars and badges follow the account's current settings, including on old comments. The comment API includes them in its list response; no extra profile request or frozen avatar/badge history is needed. Historical text bylines remain separate from those current account visuals.

See [the integration contract and non-goals](services/sicsic-comment-ui/INTEGRATION.md) and [the threat model](services/sicsic-comment-ui/THREAT_MODEL.md). Before enabling inline comments, verify the deployed API's origin allowlists, historical text bylines and stored HTML safety. Local mocked E2E passing does not establish that those backend requirements are deployed. Configure your own comment API in `src/components/Comments.astro`; the bundled public service presets are not credentials or access grants.

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

Requires Node.js 22.19 or newer.

```bash
npm ci
npm run dev
```

Verification commands:

```bash
npm --prefix services/sicsic-comment-ui ci
npm run check         # Astro/TypeScript + SicSic diagnostics
npm run lint          # ESLint: TypeScript, JavaScript, Astro
npm test              # route helpers, HAST transform, search, OG logic
npm run build         # Blog production build only
npm run comments:build # core/frame bundles + corresponding-source archive
npm run test:routes   # built routes, metadata, feeds, and legacy structure
npm run test:budget   # gzip budgets + static dependency boundaries
npm run test:e2e      # Chromium, Firefox, and WebKit smoke tests
npm run test:visual   # compare Chromium visual snapshots
```

Run `npm run test:visual:update` only after intentionally reviewing visual changes. Comment and panel goldens are separate from whole-page identity/copy changes. CI runs each check, lint, test, build, budget and E2E step once. Visual snapshots remain an explicit review step because system-font rasterization differs by platform. Stylelint is intentionally not added to the paired legacy CSS declarations.

Budgets fail CI at 12 KiB gzip for core (also checked in Blog's real bootstrap), 4 KiB for Blog comment CSS, 3 KiB for the frame adapter, and 100 KiB uncompressed for the inline search index. Passport and Markdown preview stay separate lazy chunks. Split search into a static asset only when its budget is reached; do not add a search worker or ranking framework preemptively.

The four bundled posts under `src/content/blog` are fictional fixtures attributed to `Demo Author`, each visibly labelled as demonstration content. Replace or delete them before publishing a real archive rather than reassigning their bylines. The site stays `lang="en"` because the main interface and current article text are English; the comment region declares `lang="zh-TW"`. The bundled header image is also a generated sample asset and can be replaced independently.

The Blog's light muted/hover colors now meet AA on its actual light surfaces, with matching CSS 2.1 fallbacks; rainbow selection styling is removed. Comment-specific colors are deliberately retained to honor the visual-parity requirement. They are **not** included in a claim of site-wide AA conformance; changing those colors needs a separate visual decision.

## License

AGPL-3.0-only. Modified versions offered over a network must make their corresponding source available to users. The visual design is inspired by the WordPress Twenty Ten theme, originally distributed under the GNU General Public License.

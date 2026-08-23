# Legacy browser release check

The automated suite proves that core content is static HTML, that a CSS 2.1-style float/block layout exists before modern enhancements, and that JavaScript can be disabled in Chromium. It does **not** prove that Internet Explorer behaves like Chromium.

Before describing a release as tested in a legacy engine, run this checklist in a real IE VM or a service such as BrowserStack or Sauce Labs. Changing a modern browser user agent is not a valid substitute.

## Target pages

- `/`
- `/2026/08/23/twenty-ten-on-astro/`
- `/archives/`
- `/category/programming/`
- `/tag/astro/`
- `/search/` (discovery fallback only)
- `/rss.xml`

## IE8 baseline

- Document title, site heading, primary navigation, article text, images, sidebar, and footer are visible.
- Home, article, archive, category, tag, and pagination links navigate normally.
- The 940px desktop layout has a 640px content column and 220px sidebar without catastrophic overflow.
- The PNG header fallback loads; WebP support is not assumed.
- RSS is downloadable and contains canonical post URLs.
- A failure in enhancement JavaScript does not hide or remove core content.
- Dark mode, instant search, code copy, and transitions are not acceptance criteria.

## IE7 / IE6 best effort

- Confirm article text and navigation remain reachable.
- Record visual degradation, but do not add browser-specific architecture, CSS expressions, VML, or broad polyfill bundles.
- Only take a fix when it is small, isolated, and does not weaken modern output.

## Test record

Record the browser/VM image, OS, date, commit SHA, checked routes, failures, and screenshots. Keep the README compatibility table at “targeted, not verified” until a current record exists.

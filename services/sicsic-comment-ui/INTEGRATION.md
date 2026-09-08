# SicSic integration

One source package, three boundaries; no framework or npm-package split.

| Entry | Responsibility | Styling |
| --- | --- | --- |
| `src/core.ts` | Comments, anonymous publishing, replies, likes, own-comment operations, lazy Markdown preview | Host-owned; Blog uses `src/styles/comments.css` |
| `src/passport.ts` | Account/session initialization, OAuth, profile cards and badge management | Loaded with the identity module, never hoisted into the initial Blog page |
| `src/frame.ts` | Pics/Docs context/theme messages, resize/close, panel scrolling and pull gestures | Existing panel `src/style.css` |

## Inline

```ts
import { init } from './src/core';

const comments = init({
  el: '#comments',
  serverURL: 'https://api.pics.tchirek.top',
  subject: 'blog:/2026/08/23/twenty-ten-on-astro/',
  locale: 'zh-TW',
  passport: true,
  sessionBroker: true, // requires the matching account-origin broker deployment
});

// Only if the host reuses or removes the mount:
comments.update({ subject: 'blog:/2021/06/12/systemd-timers/' });
comments.destroy();
```

Blog renders a normal `<section id="comments" class="comments">`. Its bootstrap mounts the form immediately and supplies the subject within 300px of the viewport. Without IntersectionObserver it loads directly; without JavaScript the article and comment fallback stay readable. There is no iframe, height reservation, handshake, scroll relay or theme message.

`locale` controls language/date text, `integration` controls inline/frame layout, CSS controls appearance, and `passport: false` disables optional identity UI. `sessionBroker: true` explicitly enables cross-origin session continuation for an account backend implementing this protocol; it is off for generic integrations. Blog and the known Pics/Docs account presets opt in. Inline roots default to chronological order; frame presets explicitly select ranked roots. Never make a visual skin name a business-mode switch.

Blog keeps the existing Twenty Ten form, B/I/Preview buttons, avatars, indents, hover/focus and dark appearance. Comment breakpoints use container width, matching the old iframe viewport. Explicit CJK font fallbacks preserve Windows rendering while the region correctly declares `zh-TW`. Pics/Docs keep their independent panel appearance and gestures.

## Identity and storage

- Reading, expanding threads, replying and opening a profile do not create a viewer ID.
- A like or anonymous publication creates a random `sessionStorage` viewer ID; signed-in publication does not create an extra anonymous ID. Blocked storage falls back to mount-local memory. It is a continuity/abuse-control hint, not authentication.
- Nickname and OS-disclosure preferences are written only after an explicit action. Old persistent viewer keys are ignored, not silently deleted.
- Lists render the stored text byline and the account's current avatar/badge directly from the comment API response. Old comments follow avatar/badge changes when comments are fetched again. There is no bulk profile request or client-side profile overlay. A clicked author with `authorId` loads Passport and requests only that profile.
- Opening the identity drawer alone does not load Passport; login/account management inside it does.
- Hovering or focusing the account button preloads UI code only. Clicking shows the complete login form or known account immediately, with no status screen or artificial delay. Session lookup runs in the background. Input or a login-method choice takes precedence over a late session response. Focus refreshes wait until the dialog closes.
- Passport reads a saved account only after an identity action. Opening the account, password login, registration, reset and logout stay in the current page. The existing `sessionBroker: true` option now enables credentialed session requests; no popup broker is used.
- The canonical session is an HttpOnly, Secure, host-only API cookie. HTTPS sites under the same registrable domain (the formal Blog/Pics/Docs domains) can restore it through an exact-origin CORS JSON POST. A current central account wins over old local storage; a valid legacy bearer can initialize an empty central session. Blocked localStorage falls back to memory.
- SameSite=Lax is retained. Automatic continuity across unrelated domains (including a pages.dev preview versus the formal domain) is subject to browser cookie restrictions; use the formal same-site domains for continuity. There is no automatic popup fallback.
- Password login, registration and reset set the central cookie in their own response. Logout revokes the bearer and clears its matching cookie. Session and bearer validation both consult the D1 revocation barrier, including requests from Docs.
- Only Google opens a window. The login form prepares a browser-bound PKCE transaction on the account API; the Google click opens the provider URL directly. Proof-bound polling works even if COOP returns no WindowProxy. Separate nonce cookies keep concurrently prepared Google flows independent. Legacy state-only GET endpoints remain disabled.
- Closing a dialog discards pending UI results; it does not undo authentication already completed by the backend. Network failures preserve the draft and never trigger continuity popups.
- Dialogs trap keyboard focus, close on Escape and restore the opener. Loading failures leave anonymous editing usable.

Custom avatar upload and badge selection remain available. Avatars and badges are not frozen per comment, and no avatar/badge snapshot migration is required. Preserving the historical text byline is a separate backend rollout requirement; verify it against the deployed API before enabling inline comments.

## Frame adapter

Deploy the frame build independently. `index.html` loads `src/frame.ts` and accepts `?preset=normalpics` or `?preset=normaldocs`; Blog presets are removed. `src/frameConfig.ts` owns the presets. Optional `window.COMMENT_UI_CONFIG` belongs in the **iframe document**, not on the cross-origin parent. Explicit values override the preset; Vite environment values fill unset fields.

Parent messages: `normalpics:context`, `normalpics:theme`, `normalpics:admin-token`, `normalpics:drag-channel`, `normalpics:panel-reset`.
Frame messages: `comment-ui:ready`, `comment-ui:loaded`, `comment-ui:close`, `comment-ui:request-admin`, `comment-ui:pull`, `comment-ui:resize`.
Validate both source window and exact origin; never use `postMessage(..., '*')`.

The existing iframe sandbox is `allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`. Those permissions belong only to frame hosts. Keep the deployed corresponding-source archive and attribution accessible.

## Verification and non-goals

From this package, run `npm run check`, `npm test`, `npm run build`, then `npm run test:budget`. The Blog repository additionally builds both products before its route, bundle, E2E and visual checks.

Run npm run test:browser in this package after building. The package-owned
fixtures exercise isolated HTTPS origins for inline and iframe hosts, account
continuity, Google PKCE, drafts, likes, public profiles and cancelled reads. They
never use production accounts. Host repositories keep only host-specific checks;
SicSic CI must independently reject regressions in the component. These mocks do
not prove that a deployed backend implements the response contract.

`npm run build` publishes an allowlisted corresponding-source archive. It includes `wrangler.example.toml`, not the private deployment configuration, credentials or local environment files. Copy the example to `wrangler.toml` and configure your own origins before deploying.

CI fails above 12 KiB gzip for core + inline bootstrap, 4 KiB for Blog comment CSS, or 3 KiB for the frame adapter. The adapter budget excludes its shared core; both are measured from the emitted static graph. Passport and Markdown are independent dynamic chunks. Nonempty comment lists load Markdown before rendering their bodies; the editor shell remains immediate. Tests reject identity/frame code in the anonymous bundle. Whole-page copy changes must not update comment goldens.

- No OAuth/profile initialization, current-profile overlay, cross-site storage bridge or panel gestures in the reader's core path.
- No attachment uploads, rich-text framework, React/Vue/Solid wrapper, design system or extra package boundaries without a concrete need.
- No speculative search engine, background worker or global CSS file-count target.
- No claim that shorter-lived viewer IDs solve XSS or that client hiding replaces server authorization.

See [THREAT_MODEL.md](THREAT_MODEL.md) for the remaining security and deployment boundaries.

The account backend must expose GET /api/auth/profiles and POST /api/auth/profile and include authorId for verified comments. Public profile fields must respect their visibility settings. Password login accepts the original username (without @) or email, never the editable nickname.

## 0.2.0 contract

- Render comment content locally; html is an optional, ignored legacy field.
- Invalid successful JSON and malformed comment/like/session/profile responses reject explicitly. Reads have a 15-second deadline and are cancelled on subject replacement or destroy. Writes have deadlines but are never automatically retried: a timeout does not prove the server rejected the operation.
- First-party bearer credentials stay in memory after a successful cookie exchange; generic bearer-only integrations retain persistence. Failed migration preserves the legacy credential for retry.
- External comment images require an explicit click unless hosted on the exact page/API/auth origin. Preview follows the same policy.
- The inline composer status remains intentionally hidden. Failed publication preserves the draft; failed likes restore their last confirmed state. This release adds no status banner or intermediate account screen.
- Product version comes from package.json at build time. Source changes and production deployment are separate operations.

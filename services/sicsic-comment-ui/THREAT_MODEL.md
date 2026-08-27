# SicSic trust model

## Inline changes the trust boundary

Blog no longer isolates comments in another origin. Comment HTML now lives in the
Blog document. `item.html` is accepted **only from the trusted comment API**, whose
recorded Worker renders Markdown with raw HTML disabled and rejects non-HTTPS
images. Nicknames and profile text use `textContent`; profile website navigation
accepts only parsed HTTP(S) URLs. Markdown preview keeps the existing safe renderer.

Before rollout, verify the deployed renderer and existing stored HTML, not just
new submissions. A malicious or compromised API response could execute in the
host origin: CORS and TypeScript types do not sanitize it. There is deliberately
no second handwritten sanitizer that disagrees with the server. Backend controls,
dependency updates and an appropriate host CSP remain part of the release review.

## Identity-on-demand is not an XSS cure

Passport still uses the existing persistent bearer-session protocol. Its token is
stored in `localStorage` after login; moving the module off the reader path does
not make a previously saved token unreadable to other same-origin JavaScript.
An XSS on the executing origin could steal it. Presets sharing the comment origin
and auth backend share that blast radius. Blog storage is a separate origin and
does not automatically import an existing iframe session.

A switch to HttpOnly cookies or short-lived access tokens with refresh rotation
requires a coordinated backend/client migration, including expiry/revocation,
CSRF, exact origin rules and third-party-cookie behavior for frame consumers.
This refactor does not claim to have implemented or deployed that migration.
Changing only the storage API is not a complete security fix.

OAuth messages are accepted only during an active flow, from the known popup and
the configured auth origin. State-bound result polling remains the fallback when
popup/opener isolation prevents messages. Never send bearer tokens through
generic frame context or theme messages.

## Anonymous continuity

No viewer ID is generated on mount/read/profile open. Likes and anonymous publication
create one using Web Crypto, retained in tab-scoped session storage or memory if blocked.
Signed-in publication uses the account session without creating an anonymous ID.
This reduces persistence, not linkability guarantees: the backend still sees IP,
User-Agent and requests. IDs can be reset or forged; authorization and abuse limits
must remain server-side. OS disclosure is opt-in. Nickname preferences are not
auth credentials.

## Deployment gates

Allow only the actual Blog origin in API CORS and the OAuth return-origin list,
while preserving Pics/Docs/comment-origin entries. Do not replace an allowlist with
`*`. A new `SITE_URL` also needs its own backend origin review.

Inline rollout requires the backend to preserve each comment's historical text byline, while avatars and
badges follow the account's current settings on old and new comments. Those values
come with the comment list response; there is no avatar/badge snapshot migration.
Account updates still require server-side authorization. Verify these rules against
the deployed backend, not only a source checkout. Tests using mocked APIs do not
clear those deployment gates. Publishing the Pics/Docs frame does not enable the
Blog's inline integration or change backend origin permissions.

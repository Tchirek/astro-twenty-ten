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
and auth backend share that blast radius. Blog storage remains a separate origin;
identical storage keys never make different origins share storage.

An explicit identity action restores the account with a credentialed JSON POST
to /api/auth/sso/session. The host-only __Host-sicsic-session cookie remains
HttpOnly, Secure, SameSite=Lax, Path=/, without Domain. Formal HTTPS sites under
the same registrable domain share the API cookie under ordinary browser rules;
unrelated domains and third-party-cookie restrictions are not bypassed.

Cookie reads require an exact allowlisted Origin and application/json. CORS
allows credentials only on auth routes for the account/Comment/Blog origins.
Neither a wildcard nor a generic same-site Origin is sufficient. Normal bearer
requests remain authenticated by the bearer; arbitrary sibling domains cannot
read a cookie or set the canonical account through a form submission.

An existing central account wins over a stale local bearer. A valid legacy
bearer initializes only an empty central session, with its original remaining
lifetime. Login/registration/reset can explicitly replace it. Both central and
ordinary bearer validation consult primary D1 revocation state so delayed KV
deletion cannot revive a logged-out account. Old code/exchange routes remain for
already-open clients; the new UI does not use them.

Google preparation is a credentialed, exact-origin JSON POST from the login
form. Each flow has a separate HttpOnly nonce cookie and a server-generated
provider state. The only window.open navigates directly to Google during the
user click; it never reserves about:blank or relies on opener messaging. The
result endpoint atomically consumes state + exact Origin + S256 PKCE verifier.
No bearer or verifier enters a URL or postMessage. Legacy GET start/result
endpoints remain disabled. Concurrent forms cannot overwrite a pending flow's
nonce. A verified callback is the login commit point; closing a host dialog
discards its pending UI result but cannot undo a completed server-side login.

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

Deploy the account API before the new frame. Verify credentialed preflight and
session requests on the formal origins, plus nonce-bound Google callback and
PKCE result collection. Preserve production bindings and exact allowlists.
The legacy broker stays unframeable, no-store and no-referrer. Browser fixtures
and source tests are regression checks, not evidence of production deployment.

Inline rollout requires the backend to preserve each comment's historical text byline, while avatars and
badges follow the account's current settings on old and new comments. Those values
come with the comment list response; there is no avatar/badge snapshot migration.
Account updates still require server-side authorization. Verify these rules against
the deployed backend, not only a source checkout. Tests using mocked APIs do not
clear those deployment gates. Publishing the Pics/Docs frame does not enable the
Blog's inline integration or change backend origin permissions.

# SicSic trust model

## Comment content is untrusted

Inline and iframe comments render the API's Markdown content with the same local
micromark renderer as preview, with raw HTML disabled and URL protocol checks.
The legacy HTML field is ignored. Runtime response guards validate shape, not HTML
safety. Profile strings use textContent and navigation URLs have protocol checks.
Renderer dependencies and host CSP still matter; this is not a claim of immunity
to XSS or a compromised JavaScript delivery origin.

HTTPS comment images on the exact page, comment API or auth API origin load normally.
Other images have a per-image click-to-load control and make no image request until
clicked. Images use no-referrer, but their servers still see network metadata when
loaded. This policy does not proxy images or hide the reader's IP.

## Identity-on-demand is not an XSS cure

First-party Passport keeps its bearer in memory and restores it on deliberate
identity actions using the central HttpOnly cookie. A successful exchange removes
legacy persistent bearer keys; a failed exchange leaves the legacy token intact
for retry. Generic bearer-only integrations retain their existing persistence.
HttpOnly reduces direct cookie theft; an active same-origin XSS could still call
the session API or perform authenticated actions. Identity-on-demand is not an
XSS cure. Nothing creates an identity request merely to read comments.

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

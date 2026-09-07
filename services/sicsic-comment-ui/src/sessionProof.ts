export interface SessionProof { state: string; codeVerifier: string; codeChallenge: string }

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sessionProof(): Promise<SessionProof> {
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const codeVerifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return { state, codeVerifier, codeChallenge: base64url(new Uint8Array(digest)) };
}

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HS256 JSON Web Tokens, minted with node:crypto so no dependency is added.
 * The gateway verifies these with the same shared secret and the same issuer /
 * audience, so a token this service signs is one the edge already accepts.
 *
 * HS256 (a shared secret) is right while identity-service and the gateway are
 * one trust domain. Moving to RS256 + a published JWKS is the follow-up when a
 * third party needs to verify tokens without holding the signing key.
 */
export interface Claims {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  email?: string;
  app_id?: string;
}

const b64url = (b: Buffer | string): string =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlJson = (o: unknown): string => b64url(JSON.stringify(o));

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signJwt(
  payload: { sub: string; iss: string; aud: string; email?: string; app_id?: string },
  secret: string,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: Claims = { ...payload, iat: now, exp: now + ttlSeconds };
  const signingInput = `${b64urlJson({ alg: "HS256", typ: "JWT" })}.${b64urlJson(claims)}`;
  const sig = b64url(createHmac("sha256", secret).update(signingInput).digest());
  return `${signingInput}.${sig}`;
}

/** Verify signature, issuer/audience and expiry. Returns claims, or null if anything is off. */
export function verifyJwt(
  token: string,
  secret: string,
  expect: { iss: string; aud: string },
): Claims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  const expectedSig = b64url(createHmac("sha256", secret).update(`${header}.${payload}`).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims: Claims;
  try {
    claims = JSON.parse(fromB64url(payload).toString("utf8")) as Claims;
  } catch {
    return null;
  }
  if (claims.iss !== expect.iss || claims.aud !== expect.aud) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now) return null;
  return claims;
}

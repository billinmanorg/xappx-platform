import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { unauthorized } from "./errors.js";
import type { Config } from "./config.js";

/**
 * Who is making this request. Authentication proves identity; it is NOT the
 * tenant boundary (that is resolved separately) and it is NOT authorization
 * (services enforce that at their own edge).
 *
 * Credentials are verified when present and rejected 401 when invalid. Absent
 * credentials pass through as anonymous — the gateway still resolves a tenant,
 * and the downstream service decides what an anonymous caller may do.
 */
export interface Principal {
  userId?: string; // JWT sub — forwarded as X-User-Id
  appIdClaim?: string; // JWT app_id claim — one tenant-resolution source
  clientId?: string; // supplied by an API key identity
  viaApiKey?: boolean;
}

// Verification is pluggable. Locally and in tests a symmetric HS256 secret from
// GATEWAY_JWT_TEST_SECRET is used, so the suite mints its own tokens with no
// network. In production the issuer's JWKS verifies RS256 signatures.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function remoteJwks(issuer: string) {
  if (!jwks) {
    const base = new URL(issuer).origin;
    jwks = createRemoteJWKSet(new URL(base + "/.well-known/jwks.json"));
  }
  return jwks;
}

async function verifyJwt(token: string, cfg: Config): Promise<JWTPayload> {
  const opts = {
    issuer: cfg.auth.jwt.issuer || undefined,
    audience: cfg.auth.jwt.audience || undefined,
  };
  const testSecret = process.env.GATEWAY_JWT_TEST_SECRET;
  if (testSecret) {
    const key = new TextEncoder().encode(testSecret);
    const { payload } = await jwtVerify(token, key, { ...opts, algorithms: ["HS256"] });
    return payload;
  }
  const { payload } = await jwtVerify(token, remoteJwks(cfg.auth.jwt.issuer), {
    ...opts,
    algorithms: ["RS256"],
  });
  return payload;
}

function apiKeyRegistry(): Record<string, { app_id?: string; client_id?: string; user_id?: string }> {
  try {
    return JSON.parse(process.env.GATEWAY_API_KEYS ?? "{}");
  } catch {
    return {};
  }
}

export async function authenticate(
  getHeader: (name: string) => string | undefined,
  cfg: Config,
): Promise<Principal> {
  const apiKey = getHeader(cfg.auth.apiKeyHeader);
  if (apiKey) {
    const record = apiKeyRegistry()[apiKey];
    if (!record) throw unauthorized("The API key is not recognised.");
    return {
      userId: record.user_id,
      appIdClaim: record.app_id,
      clientId: record.client_id,
      viaApiKey: true,
    };
  }

  const authz = getHeader("authorization");
  if (authz && /^bearer /i.test(authz)) {
    const token = authz.slice(authz.indexOf(" ") + 1).trim();
    let payload: JWTPayload;
    try {
      payload = await verifyJwt(token, cfg);
    } catch {
      throw unauthorized("The bearer token is invalid or expired.");
    }
    return {
      userId: typeof payload.sub === "string" ? payload.sub : undefined,
      appIdClaim: typeof payload.app_id === "string" ? payload.app_id : undefined,
    };
  }

  return {}; // anonymous — verified nothing, claims nothing
}

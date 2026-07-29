/**
 * The member-facing side of authentication. The web runtime doesn't verify
 * credentials itself — it calls identity-service, which owns that — and carries
 * the returned bearer token in an http-only cookie so the browser never sees it
 * in script. This keeps the auth secret out of the runtime entirely.
 */
const idBase = () => {
  let b = (process.env.IDENTITY_API_BASE ?? "http://localhost:8082").trim().replace(/\/$/, "");
  if (!/^https?:\/\//.test(b)) b = "https://" + b; // tolerate a bare cloud host
  return b;
};

export interface AuthResult {
  ok: boolean;
  status: number;
  token?: string;
  user?: { user_id: string; email: string; name?: string | null };
  error?: string;
}

async function post(path: string, body: unknown): Promise<AuthResult> {
  try {
    const r = await fetch(idBase() + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = (await r.json().catch(() => ({}))) as any;
    if (r.ok) return { ok: true, status: r.status, token: data.token, user: data.user };
    return { ok: false, status: r.status, error: data.detail ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, status: 502, error: "The sign-in service is unavailable. Please try again shortly." };
  }
}

export const login = (email: string, password: string) => post("/api/v1/auth/login", { email, password });
export const signup = (email: string, password: string, name?: string) =>
  post("/api/v1/auth/signup", { email, password, name });

/** Resolve a token back into a user, or null if it is missing/invalid. */
export async function me(token: string): Promise<{ email: string } | null> {
  try {
    const r = await fetch(idBase() + "/api/v1/auth/me", {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    return ((await r.json()) as any).user ?? null;
  } catch {
    return null;
  }
}

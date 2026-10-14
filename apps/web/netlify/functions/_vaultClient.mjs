// Server-side Twin Vault REST client.
//
// Auth is a single secret key sent as the `x-vault-secret-key` header; the Vault
// API resolves it to the owning user's vault, so no userId is ever sent. That
// key is a full-access credential, so this runs SERVER-SIDE ONLY — never in the
// browser. This module is the one seam the rest of XAPPX goes through, so the
// base URL / auth lives in exactly one place.
//
// Docs: GET https://vaultapi.twinprotocol.ai/api/v1/instructions?format=markdown

const DEFAULT_BASE = "https://vaultapi.twinprotocol.ai/api/v1";

/** True only when the Vault secret key is present. */
export function vaultConfigured() {
  return Boolean(process.env.VAULT_SECRET_KEY);
}

function baseUrl() {
  return (process.env.VAULT_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

/** GET a Vault endpoint and return its `data`, or throw with the API message. */
export async function vaultGet(path, query = {}) {
  if (!vaultConfigured()) throw new Error("vault_not_configured");
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  const url = `${baseUrl()}${path}${qs ? `?${qs}` : ""}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { "x-vault-secret-key": process.env.VAULT_SECRET_KEY, accept: "application/json" },
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.success === false) {
      const err = new Error((body && body.message) || `vault_http_${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

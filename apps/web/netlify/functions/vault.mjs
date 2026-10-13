// Twin Vault data-layer endpoint (read-only MVP).
//
// Exposes the vault's file/storage reads to XAPPX so the app and the /build
// preview can show real vault data. It is intentionally READ-ONLY for now:
// writes (upload, create/rename/delete, bots) wait until XAPPX session auth is
// wired so we can authorize *who* may touch *which* vault.
//
// Safe by default:
//   - returns { configured:false } until the Vault credentials are set, so
//     there is no exposure before setup;
//   - once configured, requires a shared VAULT_PROXY_TOKEN bearer so it is not
//     an open proxy. If that token isn't set, the endpoint stays disabled.
//
// Request: POST { action, vaultId, query? }
//   action = "files" | "allFiles" | "storage"
// Header:  Authorization: Bearer <VAULT_PROXY_TOKEN>

import { getVault, vaultConfigured } from "./_vaultClient.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

const READONLY = new Set(["files", "allFiles", "storage"]);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Not set up yet — nothing is exposed.
  if (!vaultConfigured()) return json({ configured: false });

  // Guard: don't run as an open proxy. Disabled until a proxy token is set.
  const guard = process.env.VAULT_PROXY_TOKEN;
  if (!guard) return json({ configured: true, enabled: false, reason: "VAULT_PROXY_TOKEN not set" }, 503);
  if ((req.headers.get("authorization") || "") !== `Bearer ${guard}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const { action, vaultId, query } = body || {};
  if (!action || !vaultId) return json({ error: "action and vaultId are required" }, 400);
  if (!READONLY.has(action)) return json({ error: "write actions are not enabled yet (auth required)" }, 400);

  const vault = getVault();
  try {
    let data;
    if (action === "files") data = await vault.getFiles(vaultId, query || "");
    else if (action === "allFiles") data = await vault.getAllFiles(vaultId);
    else if (action === "storage") data = await vault.getStorageDetails(vaultId);
    return json({ ok: true, data });
  } catch (e) {
    return json({ error: "vault_error", message: String((e && e.message) || e) }, 502);
  }
};

// Twin Vault data-layer endpoint (read-only MVP).
//
// Calls the Twin Vault REST API (via _vaultClient) to expose the vault's
// file/folder/storage reads to XAPPX, so the app and the /build preview can show
// real vault data. READ-ONLY for now: writes (upload, rename, delete, bots) wait
// until XAPPX session auth is wired so we can authorize who may touch the vault.
//
// Safe by default:
//   - { configured:false } until VAULT_SECRET_KEY is set (no exposure);
//   - once configured, requires a shared VAULT_PROXY_TOKEN bearer (stays
//     disabled if that token isn't set) so it is not an open proxy.
//
// The Vault secret key maps to one user's vault, so no vaultId is sent.
//
// Request: POST { action, folderId?, parentId?, query?, type?, limit? }
//   action = profile | storage | files | folders | folder | folderFiles | search | favorites
// Header:  Authorization: Bearer <VAULT_PROXY_TOKEN>

import { vaultConfigured, vaultGet } from "./_vaultClient.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!vaultConfigured()) return json({ configured: false });

  const guard = process.env.VAULT_PROXY_TOKEN;
  if (!guard) return json({ configured: true, enabled: false, reason: "VAULT_PROXY_TOKEN not set" }, 503);
  if ((req.headers.get("authorization") || "") !== `Bearer ${guard}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const { action, folderId, parentId, query, type, limit } = body || {};

  try {
    let data;
    switch (action) {
      case "profile": data = await vaultGet("/user/profile"); break;
      case "storage": data = await vaultGet("/drive/storage-details"); break;
      case "files": data = await vaultGet("/drive/get-files"); break;
      case "folders": data = await vaultGet("/drive/all-folders"); break;
      case "folder": data = await vaultGet("/drive/folder", { folderId }); break;
      case "folderFiles":
        if (!parentId) return json({ error: "parentId is required" }, 400);
        data = await vaultGet("/drive/get-all-folder-files", { parentId }); break;
      case "search":
        if (!query) return json({ error: "query is required" }, 400);
        data = await vaultGet("/drive/search", { query, type }); break;
      case "favorites": data = await vaultGet("/drive/favorites", { limit }); break;
      default: return json({ error: "unknown or non-readonly action" }, 400);
    }
    return json({ ok: true, data });
  } catch (e) {
    return json({ error: "vault_error", message: String((e && e.message) || e), status: e && e.status }, 502);
  }
};

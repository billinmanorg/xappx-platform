// Server-side Twin Vault client. The Vault SDK holds an HMAC signing secret and
// signs every request, so it MUST run server-side only — never in the browser.
// Credentials come from env vars (set on Netlify, from the Client Admin Portal
// → Configurations → Development tab). This module is the one seam the rest of
// XAPPX goes through to reach the Twin Vault, so the SDK version/host is swapped
// in exactly one place.

import Vault from "vault-sdk-staging";

/** True only when all required Vault credentials are present. */
export function vaultConfigured() {
  return Boolean(
    process.env.VAULT_ACCESS_KEY &&
    process.env.VAULT_SECRET_KEY &&
    process.env.VAULT_CLIENT_API_KEY &&
    process.env.VAULT_BASE_URL,
  );
}

let client = null;

/** Lazily construct a single Vault client, or null if not configured. */
export function getVault() {
  if (!vaultConfigured()) return null;
  if (!client) {
    client = new Vault({
      VAULT_ACCESS_KEY: process.env.VAULT_ACCESS_KEY,
      VAULT_SECRET_KEY: process.env.VAULT_SECRET_KEY,
      VAULT_CLIENT_API_KEY: process.env.VAULT_CLIENT_API_KEY,
      VAULT_BASE_URL: process.env.VAULT_BASE_URL,
      VAULT_WS_URL: process.env.VAULT_WS_URL, // optional, for bot chat later
    });
  }
  return client;
}

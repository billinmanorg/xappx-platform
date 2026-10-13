# XAPPX server-side functions (Netlify)

These run server-side only. Set their secrets as **Netlify environment variables**
(Site configuration → Environment variables), never in the repo or the browser.

## `discovery` — AI for the /build flow
| Env var | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | to enable live AI | Without it, `/build` uses the curated fallback. |
| `LLM_MODEL` | optional | Defaults to a Haiku model. |

## `vault` — Twin Vault data layer (read-only MVP)
Credentials come from the **Client Admin Portal → Configurations → Development tab**.
The Vault SDK signs every request with the secret, so it must stay server-side.

| Env var | Required | Notes |
| --- | --- | --- |
| `VAULT_ACCESS_KEY` | yes | From the admin portal. |
| `VAULT_SECRET_KEY` | yes | Signing secret — server-side only, never expose. |
| `VAULT_CLIENT_API_KEY` | yes | From the admin portal. |
| `VAULT_BASE_URL` | yes | The API base URL (https://…) — NOT `vault.twns.ai` (that's the app UI). |
| `VAULT_WS_URL` | optional | `wss://…`, for live bot chat (later). |
| `VAULT_PROXY_TOKEN` | to enable | A shared secret the caller must send as `Authorization: Bearer …`. Until it's set (and until XAPPX session auth is wired), the endpoint stays disabled so it isn't an open proxy. |

Behavior before setup: `vault` returns `{ "configured": false }` and touches nothing.

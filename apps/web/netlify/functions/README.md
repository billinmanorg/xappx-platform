# XAPPX server-side functions (Netlify)

These run server-side only. Set their secrets as **Netlify environment variables**
(Site configuration → Environment variables), never in the repo or the browser.

## `discovery` — AI for the /build flow
| Env var | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | to enable live AI | Without it, `/build` uses the curated fallback. |
| `LLM_MODEL` | optional | Defaults to a Haiku model. |

## `vault` — Twin Vault data layer (read-only MVP)
Calls the Twin Vault REST API (`https://vaultapi.twinprotocol.ai/api/v1`) with a
single secret key in the `x-vault-secret-key` header. That key is full-access,
so it stays server-side. Mint the key in the vault app → **Secret Keys** (it's
shown once). Docs: `GET /instructions?format=markdown`.

| Env var | Required | Notes |
| --- | --- | --- |
| `VAULT_SECRET_KEY` | yes | The `vlt-sk-…` key — server-side only, never expose. This is the only Vault credential needed. |
| `VAULT_BASE_URL` | optional | Defaults to `https://vaultapi.twinprotocol.ai/api/v1`. Override only for another environment. |
| `VAULT_PROXY_TOKEN` | to enable | A shared secret the caller must send as `Authorization: Bearer …` (make one with `openssl rand -hex 32`). Until it's set (and until XAPPX session auth is wired), the endpoint stays disabled so it isn't an open proxy. |

Behavior before setup: `vault` returns `{ "configured": false }` and touches nothing.
Read actions: `profile`, `storage`, `files`, `folders`, `folder`, `folderFiles`, `search`, `favorites`.

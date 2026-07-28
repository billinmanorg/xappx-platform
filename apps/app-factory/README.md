# app-factory — the builder console

The admin console for launching and configuring brands. It is a **pure API
client** (ADR-011): it talks to the platform only through clients-service's
public API — the same calls an external client would make — and connects to no
database of its own. If the console can launch a brand through the API alone,
the API is genuinely complete.

## Screens

| Route | Does | API it drives |
|---|---|---|
| `/` | Brands list | `GET /applications` |
| `/new` → `POST /brands` | Create a brand | `POST /applications` |
| `/brands/:slug` | Configure: product toggles, publish, preview | `GET …/products` |
| `POST /brands/:slug/toggle` | Switch a product on/off | `PUT …/products/:code` |
| `POST /brands/:slug/publish` | Take the brand live | `POST …/publish` |

Forms POST and redirect (Post/Redirect/Get), so a refresh never repeats an
action. "Open member view" links to the web runtime for a live preview.

## ⚠️ No authentication in this build

This is **Stage 1**, an internal tool. It has **no sign-in** and it can create
brands and flip products — so it must not run anywhere but a trusted local
machine until an admin gate is added. That gate is auth code and needs the
platform's human review before it ships.

## Run it

```bash
npm ci && npm run build
CLIENTS_API_BASE=http://localhost:8081 \
WEB_RUNTIME_BASE=http://localhost:8090 \
  npm start        # console on :8096
```

## Not yet (Stage 2)

Editing a brand's colours/copy/domain, legal documents, plans and people all
need API surface that clients-service (and billing-service) do not expose yet —
each is a small endpoint plus a screen. Stage 1 covers create → toggle → publish,
which needs no backend change.

## Tests

```bash
npm test
```

The suite runs the console against a fake clients-service and asserts it renders
the platform's data and drives the right API calls (create, toggle, publish),
refusing a bad slug before it ever reaches the API.

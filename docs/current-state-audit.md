# XAPPX Platform — Current-State Audit

_Prepared in response to the "XAPPX Platform — Next Development Phase" brief (revision 072926)._
_This is the repository audit that brief requires before major changes._

---

## 0. Summary for the reader

XAPPX is **not** a prototype or a single app. It is a **multi-service platform**
already implementing the core promise in the brief — *launching an application is
configuration, not a new software build* — and a good deal of the brief's
"requirements" are **already built**, several of them more rigorously than the
brief assumes (it asks *"if Supabase is used…"*; Supabase is **not** used — this
is a microservices estate on raw PostgreSQL with row-level security).

The gaps are concentrated in the **Factory experience** (dashboard, guided
wizard, richer app list, per-module configuration) and in the **breadth of
modules** (commerce, analytics dashboards, points ledger, export), not in the
foundation. The foundation is sound and should be **extended, not rewritten** —
which is exactly what the brief asks.

---

## 1. Current architecture

A gateway-fronted set of Node/TypeScript (ESM) services, each owning its own
PostgreSQL database, communicating by HTTP APIs and CloudEvents through a
transactional outbox. No shared database; no cross-service foreign keys.

```
                       ┌──────────── gateway (:8080) ────────────┐
   browser  ──────────▶│ auth · tenant resolution · product gate │──┐
                       └──────────────────────────────────────────┘  │  forwards
                                                                       │  X-App-Id / X-Client-Id
   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐          │  X-User-Id / X-Correlation-Id
   │ clients-svc   │   │ identity-svc  │   │ events-svc    │  ◀───────┘
   │ apps/products │   │ users/auth    │   │ log/webhooks  │
   │ /manifest     │   │ memberships   │   │ engagements   │
   └──────┬────────┘   └──────┬────────┘   └──────┬────────┘
          │ own DB            │ own DB            │ own DB
          └─── outbox ────────┴──── relay ────────┘  (drains each outbox → HTTP delivery)

   apps/web-runtime (:8090)  — member-facing runtime, renders each app from its manifest
   apps/app-factory (:8096)  — the builder console (pure API client over clients-service)
```

### Implemented components (have `src/` + tests)
| Component | Role | Tests |
|---|---|---|
| `services/clients-service` | Application registry, products/modules, toggles + dependency enforcement, **manifest resolution**, legal docs | 12 |
| `services/identity-service` | Global users, per-app memberships, roles, sessions, **real auth** (signup/login/scrypt/JWT), known-apps projection | 25 |
| `gateway` | Single public edge: JWT/API-key auth, tenant resolution (host → `X-App-Slug` → JWT claim), product gate (cached manifest), rate limiting, proxy | 12 |
| `services/events-service` | Event log of record, outbound webhooks, per-user engagements (activity history) | 6 |
| `relay` | Outbox drainer → at-least-once HTTP delivery to consumers | 3 |
| `apps/web-runtime` | Member runtime: renders nav/onboarding/pages from the manifest; signup/login UI | 19 |
| `apps/app-factory` | The Factory console: list, create, configure/toggle, publish, preview | 8 |

### Scaffolded-only services (`service.yaml` + `0001` migration + Dockerfile, **no `src/`**)
These are the **future modules** the brief describes; the boundaries are declared
but the logic is not yet written:
`agents-service`, `ai-orchestrator`, `audit-service`, `billing-service`,
`campaigns-service`, `communities-service`, `export-service`, `media-service`,
`referrals-service`, `rewards-service`, `twins-service`, `vault-service`.

### Supporting
- `contracts/` — OpenAPI per service (mostly stubs), AsyncAPI event catalogue, JSON schemas (manifest, cloudevent, problem).
- `packages/design-system/tokens.css` — the dark XAPPX palette (deep navy, cyan→violet gradient).
- `tools/check_brand_terms.py`, `tools/check_event_declarations.py` — CI boundary checks.
- `deploy/` (k8s, terraform, local) — skeleton. `render.yaml` — the live deploy blueprint.

---

## 2. Working features (verified, many tested)

- **Launch an app by configuration** — a new application is a DB row + product toggles; the member app renders from its manifest with no code change. Proven live.
- **Application registry** — `applications` table with `app_id`, `client_id`, `slug`, `status`, `theme`, `copy`, `taxonomy`, `manifest_version`. **Already uses the brief's canonical `application` terminology at the code/DB layer.**
- **Module (product) toggles, non-destructive**, with **dependency enforcement** in the database (e.g. `vault_premium` requires `vault`), translated to a 409 at the API.
- **Manifest resolution** — `GET /applications/:slug/manifest`; nav/onboarding/products gated by active modules; ETag invalidates on any toggle.
- **Config-driven member runtime** — navigation, onboarding and reachable routes come only from the manifest; a disabled module disappears from nav, API and routes together.
- **Real authentication** — signup/login with scrypt-hashed passwords, HS256 JWTs the gateway verifies; member-facing signup/login UI with an http-only cookie.
- **One global user, many app memberships** — exactly the brief's §18 model; `POST /sessions` returns **403 + a join path (never 401)** when a user has no membership for an app.
- **Tenant isolation / RLS** — every tenant table carries `app_id` and is scoped via `current_app_id()`; queries also filter explicitly (defence in depth).
- **API-first Factory** — the console holds no business logic or database; it is a pure client of clients-service (brief §25).
- **Activity & events foundation** — transactional outbox + relay + events-service (log, webhooks, engagements), idempotent consumers (dedupe on CloudEvent id), correlation IDs end to end. This is the substrate the brief's §20 analytics and §21 points engine need.
- **Publishing (basic)** — `POST /applications/:slug/publish` sets `published` and emits `application.published`.
- **Dark XAPPX visual system** with the cyan→violet gradient and "Powered by XAPPX" footer (brief §27).
- **Deployed on Render** — clients-service, web-runtime, app-factory + Postgres are live; identity-service + its DB are being added.

---

## 3. Missing features (the new work in the brief)

- **Terminology**: the Factory/runtime **UI** still says "Brands" / "New brand" (the DB/API already say `application`). The `zap_dev` product must become **XAPPX Development**.
- **Factory dashboard** (§5) — today the home is the app list; no metrics/alerts/activity.
- **Richer app list** (§6) — no logos/placeholders, application type, audience model, member count, health; only 4 statuses (needs 11).
- **Application types + B2B/B2C/B2B2C** (§7).
- **Intelligent New-App wizard** (§8) — today a simple name/slug/products form.
- **Module states beyond on/off** (§11) and **per-module configuration pages** (§13).
- **Formal module registry** (§10) — `products` is a flat table; needs categories, config schemas, icons, declared events/APIs, extraction support.
- **App-admin experience** (§16) and fuller **member runtime** (pricing page, product catalog, password reset, email verification, Google login, module dashboards — §15).
- **Ecommerce/Stripe** (§19), **analytics dashboards** (§20), **points ledger / referrals / tokens** (§21), **application export** (§28).
- **Role-based Factory auth + MFA** (§17) — today the Factory has a single shared-password gate, not roles.
- **The other 12 module services** — scaffolded, not implemented.
- **Docs**: architecture.md, module-registry.md, api.md, testing.md, deployment.md, extraction.md, application-manifest.md (this audit + the plan + open-questions are the first three).

---

## 4. Security risks (honest)

| Risk | Detail | Priority |
|---|---|---|
| **Factory auth is a shared password, not roles** | `app-factory` uses HTTP Basic Auth (one credential). Brief §17 wants platform-superadmin / factory-admin / … roles + MFA. | High |
| **Gateway proxy is JSON-only** | Re-serialises the body as JSON → cannot pass file uploads/downloads → blocks Vault/Media. | High (blocks modules) |
| **clients-service write API is publicly reachable** on the current free deploy (the console is gated; the API is not). | Fine for a short demo; must be closed before real use. | High |
| **No token revocation** | JWTs are stateless/short-lived; logout is client-side. Needs refresh tokens + a denylist. | Medium |
| **RLS bypassed by a superuser DB role** | Mitigated by explicit `current_app_id()` filters, but production should connect as a non-owner role. | Medium |
| **Login not yet rate-limited at identity** | Gateway rate-limits generally; login deserves its own + lockout. | Medium |
| **Webhook signing deferred** | `secret_ref` is stored but deliveries aren't HMAC-signed yet. | Medium |
| **No secrets manager** | Secrets are Render env vars (not committed — good), but there is no dedicated secrets manager (brief §17). | Medium |

**Human review is required on all auth code** before real users (identity `auth.ts`, sessions, the gateway edge, the web-runtime cookie handling) — this is flagged in the code itself.

---

## 5. Technical debt

- `services/clients-service/package.json` `start` points to `dist/main.js`; the build emits `dist/src/main.js` (pre-existing; deploys use an explicit start command).
- Render `fromService` returns a bare host without `.onrender.com`; worked around by marking the cross-service URL env vars `sync: false` and setting full URLs by hand.
- The two Python CI checkers have Windows portability quirks (path separators; cp1252 vs UTF-8) — run via a small normalising wrapper locally; they are correct on the Linux CI runner.
- Contract tests are not written (the OpenAPI files are stubs — only `/healthz`/`/readyz`).
- No CI is confirmed running yet (checkers exist; `.github/workflows` not verified live).
- `web-runtime` / `app-factory` / `relay` lack Dockerfiles (they use Render's native Node runtime); scaffolded services have Dockerfiles.

---

## 6. Database model (current)

Raw **PostgreSQL 16**, **one database per service** (`xappx_<service_name>`), RLS on
tenant tables, numbered additive migrations. **Not Supabase.**

- **clients-service**: `clients`, `applications`, `products`, `app_products`, `legal_documents`, `outbox`, `idempotency_keys`.
- **identity-service**: `users`, `roles`, `memberships`, `sessions`, `known_applications`, `consumed_events`, `credentials`, `outbox`, `idempotency_keys`.
- **events-service**: `events_log`, `webhooks`, `webhook_deliveries`, `engagements`, `outbox`, `idempotency_keys`.
- Scaffolded services carry their own `0001_init.sql` (e.g. `vault`, `rewards` with a ledger, `audit`).

The brief's §26 target model (application_versions, module_definitions, entitlements,
ledger_transactions, reward_rules, etc.) is a **superset** of the above — reached
by additive migrations, per the brief's "safe migrations, do not destroy current
records" rule. Notably, the brief's core entities (`applications`, `users`,
`memberships`, `roles`, `permissions`) already exist.

---

## 7. API endpoints (current)

- **clients-service**: `GET/POST /api/v1/clients`, `GET/POST /api/v1/applications`, `GET /applications/:slug/manifest`, `POST /applications/:slug/publish`, `GET /applications/:slug/products`, `PUT /applications/:slug/products/:code`.
- **identity-service**: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`; `POST/GET /users`, `GET/PUT /users/:id`; `POST/GET /memberships`; `POST /sessions`, `DELETE /sessions/:id`; `POST /internal/events` (relay).
- **events-service**: `POST /internal/events` (ingest), `POST/GET /webhooks`, `POST/GET /engagements`.
- **gateway**: routes `/api/v1/*` per `gateway/routes.yaml` to the services, plus `POST /_internal/cache/invalidate`.

All errors are RFC 9457 problem documents with a `correlation_id`. Write endpoints
honour `Idempotency-Key`. The brief's §25 endpoint list (templates, modules,
manifests, analytics, exports, activity) is a superset to grow into.

---

## 8. Deployment structure

- **Host**: Render (free tier). **Live**: `clients-service`, `web-runtime`, `app-factory`, Postgres `xappx-db`. **Being added**: `identity-service` + `xappx-identity-db`.
- **URLs**: `app-factory-3jf3.onrender.com` (gated console), `web-runtime.onrender.com/<slug>` (member apps), `clients-service-84j5.onrender.com` (API).
- **Blueprint**: `render.yaml` (managed Postgres + services). Cross-service URL env vars are `sync: false` (dashboard-managed) so a Blueprint sync can't clobber them.
- **Constraints**: free services sleep after ~15 min idle (cold-start ~12–30s); free Postgres expires (~30 days) — durability plan: move to a durable free Neon or a paid DB.
- **Source**: GitHub `billinmanorg/xappx-platform` (`main`); Render auto-deploys on push.

---

## 9. Recommended migration plan (high level)

Extend, don't rewrite. Deliver in the brief's phases; several are partly done.
See **`docs/implementation-plan.md`** for the staged detail. Headline sequence:

1. **Phase 0/1 — terminology + registry + list** (this doc + rename Brands→Apps + logos + statuses + richer app list). Low risk; hits acceptance criteria #2–5.
2. **Phase 2 — Factory dashboard** (real metrics with honest zero-states).
3. **Phase 3 — New-App wizard** (types, B2B/B2C/B2B2C, discovery, branding, template/module recommendation, draft manifest).
4. **Phase 4 — module registry + states + config pages + activation workflow** (dependency engine already exists).
5. **Phase 5 — member/admin runtime depth** (pricing, catalog, password reset, admin experience).
6. **Phase 6+ — commerce, analytics, points/referrals/tokens, publishing workflow, export** (each a bounded module over the existing event/outbox substrate).

---

## 10. Files that will change first (Phase 1)

- `apps/app-factory/src/render.ts`, `src/main.ts` — "Brands" → "Apps", `/brands` → `/apps` routes, richer list, logos/placeholders, statuses.
- `apps/web-runtime/src/render.ts` — any "brand" UI copy → "app".
- `services/clients-service/db/seed.sql` + a new migration — rename the `zap_dev` product to `xappx_development`; add columns for `application_type`, `audience_model`, `logo_asset_id`, and the expanded status enum (additive, non-destructive).
- New: `services/clients-service` endpoints/migration for application metadata; docs.

No destructive changes; existing Angel Token / Angel Twin / Twin Protocol records are preserved.

---

## 11. Assumptions requiring confirmation

Tracked in **`docs/open-questions.md`**. The blocking ones: confirm the
microservices-on-Postgres architecture is endorsed (vs. the brief's Supabase
aside); the identity provider/MFA choice; the Stripe timing; and the "decentralized
vault" mechanism that gates the Vault module.

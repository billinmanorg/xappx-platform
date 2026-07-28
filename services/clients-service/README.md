# clients-service

Tenant registry, brand instances, the product toggle system, and manifest resolution.
Everything else on the platform reads the manifest this service produces, so it is
the first service in Phase 1 and the one to keep strictest.

## Run it

```bash
createdb xappx_clients_service
psql -d xappx_clients_service -f db/migrations/0001_init.sql
psql -d xappx_clients_service -f db/seed.sql

npm ci && npm run build
DATABASE_URL=postgres://…/xappx_clients_service npm start   # :8081
```

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/clients` | |
| POST | `/api/v1/clients` | |
| GET | `/api/v1/applications` | Filter with `?client_id=` |
| POST | `/api/v1/applications` | Launch a brand. Accepts `products[]` |
| POST | `/api/v1/applications/:slug/publish` | |
| GET | `/api/v1/applications/:slug/manifest` | ETag-cached; the front end renders from this |
| GET | `/api/v1/applications/:slug/products` | The toggle checklist |
| PUT | `/api/v1/applications/:slug/products/:code` | The toggle |
| GET | `/healthz`, `/readyz` | Readiness includes the database |

## Behaviour worth knowing before you change anything

**The manifest is the contract.** Disabling a product removes its nav entry and its
onboarding step and renumbers what remains. The front end never receives a disabled
product's routes, so there is nothing to hide client-side.

**ETags invalidate themselves.** `applications.manifest_version` is bumped by a
database trigger on every toggle change, and the ETag is derived from it. No cache
purge step exists because none is needed.

**Dependency rules live in the database.** `vault_premium` requires `vault`, and the
constraint holds for every caller, including psql. This service translates the
database error into a 409 problem document; it does not reimplement the rule.

**Turning a product off is not destructive.** If billing reports paying subscribers,
the toggle is refused until the caller sets `override_active_subscribers`. Their files
then enter the six-month retention window rather than being deleted. If billing is
configured but unreachable, the toggle is refused rather than assumed safe — an
unknown subscriber count is never treated as zero.

**Events go through the outbox.** Every state change writes a CloudEvent inside the
same transaction. Nothing publishes to a broker inline.

## Tests

```bash
DATABASE_URL=… npm test
```

Twelve integration tests against a real Postgres, covering: brand creation and
publication by configuration alone, idempotent retries, manifest gating for Angel
Twin (agents off) and Twin Protocol (agents on), per-brand display names, onboarding
renumbering, ETag invalidation on toggle, both dependency directions, outbox writes,
and problem-document error shapes.

# XAPPX Platform

Multi-tenant foundation for launching branded AI applications by configuration.
Fifteen services, each owning its own database, behind one API gateway.

Read `ARCHITECTURE.md` (decisions and their obligations), then `CLAUDE.md` (rules and backlog).

## Layout

| Path | Contents |
|---|---|
| `services/<name>/` | One service: migrations, service manifest, Dockerfile, instructions |
| `gateway/` | Routing, auth, tenant resolution, toggle gating |
| `contracts/` | OpenAPI per service, AsyncAPI event catalogue, shared schemas |
| `deploy/k8s/` | Deployment, Service and HPA per service |
| `deploy/terraform/` | Infrastructure skeleton (databases, broker, storage) |
| `deploy/local/` | docker-compose for local development |
| `tools/` | Boundary checks run by CI |
| `.github/workflows/` | CI: boundary checks, per-service matrix build |

## Local development

```bash
docker compose -f deploy/local/docker-compose.yml up
```

Postgres creates one database per service on first boot. Then run each
service's migrations:

```bash
for d in services/*/; do
  svc=$(basename "$d"); db="xappx_$(echo "$svc" | tr '-' '_')"
  psql "postgres://xappx:xappx@localhost:5432/$db" -v ON_ERROR_STOP=1 \
       -f "$d/db/migrations/0001_init.sql"
done
psql "postgres://xappx:xappx@localhost:5432/xappx_clients_service" \
     -f services/clients-service/db/seed.sql
```

The seed creates the Phase 1 fixture: Angel Twin (agents off), Twin Protocol
(agents on), Angel Token (info-only).

## Verified invariants

Run against a real Postgres 16, all fifteen schemas applying cleanly:

**clients-service**
1. A product cannot be enabled before its dependencies.
2. A product cannot be disabled while another enabled product depends on it.
3. Any toggle change bumps `manifest_version`, invalidating downstream caches.
4. RLS shows each brand only its own toggles.

**rewards-service**
5. A one-sided ledger transaction is rejected.
6. A balanced transaction posts and projects the correct balance.
7. Replaying the same event cannot grant points twice.
8. Completed ledger entries cannot be mutated or deleted.

**audit-service**
9. Audit rows cannot be updated or deleted.

**Repo-wide**
10. No service references another service's database.
11. No service consumes an event nobody publishes.

```bash
psql -d xappx_clients_service -f services/clients-service/db/tests/invariants.sql
psql -d xappx_rewards_service -f services/rewards-service/db/tests/invariants.sql
psql -d xappx_audit_service   -f services/audit-service/db/tests/invariants.sql
python3 tools/check_event_declarations.py
```

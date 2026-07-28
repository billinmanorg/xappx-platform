# events-service

The event log of record, outbound webhooks, and per-user action history. It
subscribes to every topic: the outbox relay delivers each CloudEvent to its
internal ingest, which logs it and fans out to matching webhooks.

## Run it

```bash
createdb xappx_events_service
psql -d xappx_events_service -f db/migrations/0001_init.sql

npm ci && npm run build
DATABASE_URL=postgres://…/xappx_events_service npm start   # :8093
```

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/internal/events` | Ingest a CloudEvent (relay only, not public). Idempotent on the event id |
| POST | `/api/v1/webhooks` | Register an outbound webhook for the brand (`X-App-Id`) |
| GET | `/api/v1/webhooks` | List the brand's webhooks |
| POST | `/api/v1/engagements` | Record a user action |
| GET | `/api/v1/engagements` | The brand's action history; filter with `?user_id=` |
| GET | `/healthz`, `/readyz` | Readiness includes the database |

## Behaviour worth knowing

**The primary key is the dedup.** `events_log.event_id` is the CloudEvent id, so
storing a redelivered event inserts nothing and fans out nothing. Delivery is
at-least-once; duplicates are normal traffic.

**Tenant comes from `X-App-Id`.** The gateway resolves the brand and forwards it,
so this service does not re-derive it. Engagement reads are scoped by
`current_app_id()` in the query, so isolation holds regardless of the DB role.

**Webhook signing is deferred.** `secret_ref` is stored but HMAC signing of
deliveries is intentionally not implemented yet — that is crypto code and needs
the human review the platform requires before it ships.

## Tests

```bash
DATABASE_URL=… npm test
```

Ingest idempotency, webhook fan-out and delivery recording, engagement tenant
isolation, and problem-document error shapes. Every run scopes its own ids so
the suite is re-runnable against a populated database.

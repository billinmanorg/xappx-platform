# relay — the outbox relay

Infrastructure, not a service. It drains each source service's transactional
`outbox` and delivers the CloudEvents to their consumers over HTTP.

## Why it lives outside `services/`

The transactional-outbox pattern (ARCHITECTURE.md) requires that a committed
state change writes its event to the same-transaction `outbox`, and that **a
relay drains it**. Draining means reading each service's own outbox — that is
the relay's entire job. It is delivery infrastructure with no tables of its own,
so it is not a service subject to the no-cross-service-database rule; it never
reads another service's *business* data, only the outbox each service writes for
exactly this purpose.

## What it does per pass

For each source, `drainOnce`:
1. selects unpublished `outbox` rows `FOR UPDATE SKIP LOCKED` (so instances share work),
2. delivers each event to its targets over HTTP,
3. marks a row published only when **every** target accepted it.

A failed delivery leaves the row unpublished for the next pass. Delivery is
at-least-once and consumers deduplicate on the CloudEvent id, so redelivery is
safe.

## Routing

| Event type | Targets |
|---|---|
| *(every event)* | events-service `/internal/events` — the log of record |
| `com.xappx.application.created` | identity-service `/internal/events` — maintains `known_applications` |
| `com.xappx.application.product.*` | gateway `/_internal/cache/invalidate` — drops the toggle cache |

Target URLs come from env (`EVENTS_INGEST_URL`, `IDENTITY_INGEST_URL`,
`GATEWAY_INVALIDATE_URL`). Sources come from `RELAY_SOURCES` (JSON `[{name,
databaseUrl}]`) or the per-service `*_DATABASE_URL` env vars.

## Run it

```bash
npm ci && npm run build
RELAY_SOURCES='[{"name":"clients-service","databaseUrl":"postgres://…/xappx_clients_service"},
                {"name":"identity-service","databaseUrl":"postgres://…/xappx_identity_service"}]' \
  npm start
```

## Tests

```bash
DATABASE_URL=…  npm test    # needs any Postgres; the suite creates its own per-run table
```

Routing by event type, marking published, no re-send of published rows, and the
defer-then-retry path on a failed delivery.

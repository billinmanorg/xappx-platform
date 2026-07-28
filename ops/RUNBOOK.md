# Operations Runbook

Fifteen services, one database each, one broker, one gateway. Most incidents in
an estate this shape are boundary problems, not logic problems.

## Deploying

Per service, in this order. Migrations first, and they must be backwards
compatible with the running version — the old and new versions coexist during a
rollout.

```
kubectl apply -f deploy/k8s/<service>.yaml
```

Expand and contract for anything destructive: add the new column, deploy code
that writes both, backfill, deploy code that reads the new one, then drop the
old column in a later release. Never in one step.

## Request scoping

The gateway resolves tenant context and forwards `X-App-Id`, `X-Client-Id`,
`X-User-Id`, `X-Correlation-Id`. Every service sets the database context before
querying:

```sql
select set_config('xappx.app_id', $1, true);
```

Forgetting it returns empty result sets, not cross-tenant data — RLS fails
closed. Treat an unexplained empty result as a missing scope call.

## Event flow problems

**Symptom: a state change happened but downstream never reacted.**
Check the producer's `outbox` for rows with `published_at is null`. A backlog
means the relay is stopped or the broker is unreachable; the data is safe and
will drain. An empty outbox means the producer never wrote the event — that is
a code bug, not an infrastructure one.

**Symptom: something happened twice.**
The broker delivers at least once, so this is a missing idempotency check in the
consumer, not a broker fault. Deduplicate on the CloudEvent id.

**Symptom: two services disagree about the same fact.**
Expected briefly; the system is eventually consistent across services. If it
persists, a consumer is failing silently — check its dead-letter handling before
assuming the producer is wrong.

## Login failure triage

In order. Most of these are configuration, not code:

1. Watch the auth network call. 400 means credentials or unconfirmed user; 200
   followed by a bounce means session persistence; no call at all means the
   client never initialised.
2. Confirm the deployed bundle carries the right project reference. Build-time
   variables are inlined, so dashboard changes do nothing until a rebuild.
3. Check the redirect URL allowlist includes the exact deployed origin.
4. Confirm the SPA redirect rule exists, or the auth callback 404s.
5. Check the user row directly; transactional email limits can silently prevent
   confirmation mail.
6. **XAPPX-specific:** a user with no `memberships` row for this brand
   authenticates cleanly at identity-service and then resolves to no tenant at
   the gateway. Return 403 with a join path. Do not present it as a login
   failure — auth worked.

## Extraction and cutover

Format is frozen (ARCHITECTURE.md ADR-007); tooling is built on demand.
export-service fans out to every service and records one `export_artifacts` row
per contributor, so a partial export is visible rather than silent. The package
must contain full ledger history, not balances. Validate row counts, file
checksums and ledger sums before any DNS switch, and keep the old deployment
reachable for rollback.

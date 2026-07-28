# XAPPX — Project Instructions

One multi-tenant platform that launches branded apps by configuration. If launching a brand ever requires new code, the platform has failed.

Read `ARCHITECTURE.md` first. It records the microservices decision and, more importantly, the obligations that come with it.

---

## Two rules that outrank everything else

**1. No brand names in code.** No `if (brand === 'angel_twin')`, no `AngelTwinService`, no per-brand file. Brand differences are one of: a product toggle (`app_products`), a config value on the application record, or a manifest field. CI fails on brand names in source.

**2. No cross-service database access.** A service connects to its own database and nothing else. Need another service's data? Call its API or subscribe to its events. CI fails on a connection string or table reference pointing at another service's database.

Break either and the platform stops being what it is for: rule 1 turns configuration back into code, rule 2 turns fifteen services into a distributed monolith.

---

## Layout

```
services/<name>/     one service: src, db/migrations, service.yaml, Dockerfile, CLAUDE.md
gateway/             the only public surface; auth, tenant resolution, toggle gating
contracts/           OpenAPI per service, AsyncAPI, shared JSON schemas
deploy/k8s/          Deployment, Service, HPA per service
deploy/terraform/    infrastructure skeleton
deploy/local/        docker-compose for local development
tools/               boundary checks used by CI
apps/                App Factory, Operations (XAPPX App), Rewards Admin, web runtime
```

Every service declares what it owns and what crosses its boundary in `service.yaml`. CI reads that file: a table not listed under `owns`, or an event not declared, fails the build.

## Standards

| Area | Standard |
|---|---|
| REST | Plural nouns, standard verbs, `/api/v1/...` |
| Errors | RFC 9457 problem+json |
| Idempotency | `Idempotency-Key` on POST/PUT, per-service `idempotency_keys` table |
| Events | CloudEvents v1.0, published through the outbox, consumed idempotently |
| Rewards | Double-entry ledger, entries per transaction sum to zero, one service |
| Multi-tenancy | Every domain table carries `app_id`; RLS enforces it |
| Tracing | `X-Correlation-Id` issued at the gateway, propagated and logged everywhere |

## Distributed-systems obligations

These are not optional. Skipping them is how a microservice estate becomes worse than a monolith.

- **Publish through the outbox.** Write the event to `outbox` in the same transaction as the state change; a relay drains it. Never publish inline.
- **Consume idempotently.** Delivery is at-least-once. Deduplicate on the CloudEvent `id`; the unique index on `reward_transactions.source_event` is the worked example.
- **Assume every remote call fails.** Timeouts, retries with backoff, circuit breakers. A slow service must not become an outage in three others.
- **Never reach for a distributed transaction.** If two services must agree, model it as a saga with a compensating action, or move the invariant inside one service.
- **Version events additively.** Adding a field is fine; changing a meaning is a new event type.

## Human review required

No merge without a human reviewer on **auth, billing, rewards, ledger, export, crypto**. Claude Code may write these; it may not be the only reviewer.

---

## Phased backlog

Do not start a phase before the previous exit test passes.

**Phase 1 — Spine**

*The platform starts empty. No legacy import path in any Phase 1 service (ADR-012).*

1. clients-service: tenancy, applications, product toggles, manifest
2. identity-service: users, memberships, roles, sessions
3. Gateway: auth, tenant resolution, toggle gating, correlation ids
4. events-service and the outbox relay
5. vault-service
6. Web runtime rendering entirely from the manifest

*Exit test:* create a brand through configuration only; toggle a product and watch the front end change with no deploy. `services/clients-service/db/seed.sql` is the fixture.

**Phase 2 — Magic**
7. twins-service, agents-service, ai-orchestrator
8. Chat with documents (vault + AI)

*Exit test:* Twin Protocol runs with Agents on, Angel Twin with Agents off, identical images.

**Phase 3 — First storefronts**
9. campaigns-service, communities-service
10. Engagement and action history reporting
11. Angel Twin migrated onto the platform — built as the generic import side of the frozen export format, not as a one-off script (ADR-012)
12. Century 21 configured, including individual agent pages, bulk team upload

*Exit test:* Virginia works inside the C21 instance; Angel Twin serves from the platform.

**Phase 4 — Economy**
13. rewards-service: catalogue, rules engine, ledger, approvals
14. referrals-service with external proof capture
15. billing-service: usage and subscriptions

*Exit test:* referral credits and points tracked end to end, ledger balanced.

**Gated — do not start without a decision**
Crypto distribution and KYC, full invoicing, extraction tooling, SCIM.

---

## Definition of done for v1

- A new brand launches with zero new code.
- Angel Twin, Twin Protocol and Century 21 all run as configurations of one core.
- One shared analytics module reporting per brand.
- OpenAPI published for Vault and Protocol.
- Every brand has its own legal documents and domain.

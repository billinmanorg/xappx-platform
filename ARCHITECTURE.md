# XAPPX — Architecture Decision Record

**Status:** ADR-001 decided by Bill on 28 July 2026. The rest need April's review before Phase 1 code starts.
**Implements:** XAAPX_Development_Document.pdf.

---

## ADR-001 — Microservices

**Decision.** Follow the development document. Fifteen independently deployable services, each owning its own database, communicating over HTTP through an API gateway and asynchronously over a broker using CloudEvents. Kubernetes for orchestration, Terraform for infrastructure.

**Superseded position.** An earlier draft of this repo kept the modular monolith from Master Plan v1 and argued the microservice split was premature for a team this size. Bill overruled it. The strongest argument for the split is the one in §2.10 and §7 of the document: every app and its data must be extractable so a client can cut over to an isolated deployment. Services that already own separate databases make that a migration; a shared schema makes it an untangling project. That requirement is a product commitment, not a scaling guess, and it justifies the boundary now rather than later.

**What this obligates.** These are not optional extras — they are the cost of the decision, and skipping any of them produces a distributed monolith, which is worse than either option:

| Obligation | Why | Where it lives |
|---|---|---|
| Transactional outbox in every service | A committed state change must not vanish from the event stream, and a broker outage must not roll back business state | `outbox` table in every service migration |
| Idempotent consumers | The broker delivers at least once; duplicates are normal traffic, not incidents | `reward_transactions.source_event` unique index is the worked example |
| No cross-service foreign keys | The referenced row is in another database | External ids are plain uuids, validated at the API edge |
| Correlation ids end to end | A single user action now spans several services; without it, debugging is guesswork | Gateway issues `X-Correlation-Id`, every service propagates and logs it |
| Contract tests per service | Nothing else catches a breaking change before it reaches a consumer | CI job per service |
| Boundary enforcement in CI | Boundaries decay silently otherwise | `.github/workflows/ci.yml` fails on cross-service database references |

**What did not change.** Every contract, schema and invariant from the previous draft carries over unchanged. The split changed where tables live, not what they mean.

---

## ADR-002 — Data ownership and the no-shared-database rule

Each service owns its tables and is the only thing that connects to its database. Another service needs that data? It calls the API or subscribes to the events. A connection string pointing at another service's database is a defect that CI rejects.

| Service | Owns |
|---|---|
| clients-service | clients, applications, products, app_products, legal_documents |
| identity-service | users, roles, memberships, sessions |
| vault-service | vaults, files, file_acl |
| media-service | media_assets, provider_jobs |
| twins-service | twins, twin_training_sources |
| agents-service | agents, prompts |
| ai-orchestrator | ai_routes, ai_requests |
| communities-service | communities, community_members, posts |
| campaigns-service | contents, campaigns, projects |
| rewards-service | action catalogue, programs, rules, accounts, transactions, ledger, redemptions, token batches |
| referrals-service | referrals |
| billing-service | plans, subscriptions, usage_metrics |
| events-service | events_log, webhooks, webhook_deliveries, engagements |
| export-service | export_jobs, export_artifacts |
| audit-service | audit_log, consents |

The document lists no content service; content lives with campaigns rather than becoming a sixteenth service for one table.

**Where consistency is bought back.** Two places needed a deliberate answer rather than a foreign key:

- **identity-service** keeps a `known_applications` projection, maintained from `application.created`, so it can reject a membership for an unknown brand without a synchronous call to clients-service.
- **billing-service** exposes `active_subscribers_by_product`, which clients-service queries before allowing a product to be toggled off. That is a synchronous call on a rare admin path — acceptable, and better than duplicating subscription state.

---

## ADR-003 — The ledger stays inside one service

Every rewards table lives in rewards-service so a points transaction remains a single ACID transaction with a deferred constraint proving debits equal credits.

Splitting accounts from entries across services would require a distributed transaction or a saga for something that must never be eventually consistent. It will be tempting during Phase 4 to move balances into a "wallet service." Don't.

---

## ADR-004 — Product toggles are first-class, not generic feature flags

The document stores features as a `feature_flags` JSON blob on `applications`. Replaced with a seeded `products` catalogue and an `app_products` join table with dependency triggers, per-brand display names and an audit trail.

A JSON blob cannot enforce that Vault Premium requires Vault, cannot answer "which brands have Agents on," and cannot be audited. Generic feature flags still exist for experiments in `applications.feature_flags` — a different, lower-stakes mechanism.

Toggle changes bump `applications.manifest_version`, which is what invalidates the gateway's toggle cache and every downstream manifest ETag.

---

## ADR-005 — Ledger transactions need a grouping row

The document's `ledger_entries` has no column tying the two sides of a transaction together, which makes "credits equal debits" unverifiable and reversals impossible to trace. Added `reward_transactions`, with a deferred constraint trigger enforcing that entries sum to zero and a trigger making completed entries immutable.

---

## ADR-006 — RFC 9457, not 7807

The document cites RFC 7807 in §4; the earlier blueprint cites 9457. 9457 obsoletes 7807 and is wire-compatible. Standardised on 9457.

---

## ADR-007 — Scope gates carried forward

Master Plan v1 deferred several items that the document specifies in full. They stay deferred, with schema in place so they are not retrofits.

| Item | Position |
|---|---|
| Crypto distribution, KYC, FINRA/SEC | Gated. `token_batches` exists; no implementation in v1 |
| Full invoicing | Usage and subscription state in v1; invoicing via processor later |
| Extraction tooling | Format frozen now, tooling built when a client actually cuts over |
| SCIM provisioning | Deferred until a B2B client asks |

Freezing the export format early is what keeps the extractability promise honest without building the machinery yet.

---

## ADR-008 — Reference markers in the source document

The development document carries bracketed citation markers throughout that resolve to no bibliography in the file. The standards claims are correct and match the actual specifications, but do not reproduce those markers in anything client-facing.


---

## ADR-009 — Retention on downgrade: six months, then free plan

**Decision.** When a user loses a paid product — cancellation, or a brand toggling the product off — their files stay in place for six months. At the end of that window the files are deleted and the account reverts to the free plan. Nothing is deleted at the moment of downgrade.

This also answers the toggle-off question the development document never addressed: disabling a paid product for a brand does not destroy subscriber data, so the toggle stops being a destructive action.

**How it is built.**

- billing-service owns the fact that a subscription ended and emits `com.xappx.subscription.downgraded` carrying `retention_until`.
- vault-service consumes it and opens a `retention_holds` row. Files are readable and downloadable but frozen — the user is over the free quota, so they cannot add more until they resubscribe.
- Resubscribing restores the hold. It never deletes anything, and the clock does not restart on a redelivered event: `retention_holds.source_event` is unique.
- The deletion job reads the `retention_due` view. Nothing is deletable before `delete_after`.
- The window is data, not a constant: `retention_policies.window_months` defaults to 6 and can differ per brand, and `reason = 'legal_hold'` can extend it.

**Two consequences worth planning for.**

1. **Storage is paid for six months after revenue stops.** `retention_window_open` in billing-service exists to make that forecastable rather than a surprise on the hosting bill.
2. **Deletion scope is not yet decided.** `retention_policies.deletion_scope` defaults to `over_free_quota` — delete only what exceeds the free allowance — with `all_premium` as the alternative. The mechanism is built either way; the policy needs a decision, and it changes what a user finds when they come back on day 181.

Warning notifications default to 30, 7 and 1 days before deletion.

---

## ADR-009a — Twin Points and Twin Tokens

**Decision.** The XAPPX economy runs on **Twin Points**. Points convert to **Twin Tokens** later.

**How the ledger handles this.** The ledger is currency-agnostic by design: `reward_programs.currency` carries `twin_points` today, and a token program is another program row with a different currency. Conversion is then a transfer between two programs — a debit in points, a credit in tokens, inside one balanced transaction — and never an edit to a completed entry. `token_batches` already exists for the distribution side.

**What stays gated (ADR-007).** Conversion is not implemented in v1. Jurisdiction checks and identity verification have to land before any payout, and `clients.jurisdiction` and `token_batches.kyc_verified` are the hooks for that. The currency exists now so conversion is not retrofitted onto a ledger that already holds live balances — which is the expensive version of this.

**Naming.** "Twin Points" and "Twin Tokens" are the product names. They are not per-brand labels: a brand can rename a *product* through `app_products.display_name`, but the currency is platform-wide, or the ledger stops being comparable across brands.

---

## ADR-010 — Infrastructure ownership

XAPPX Inc. owns and operates the infrastructure. No external hosting partner.

That settles the accountability question but not the staffing one: fifteen services, a broker, a cluster and fifteen databases still need a named person on call. Until that person exists, favour managed services over self-hosted ones everywhere the choice arises — managed Postgres, managed broker, managed secrets — because the operational surface, not the licence cost, is what a small team cannot absorb.

---

## ADR-011 — App Factory stays separate

The App Factory remains its own control-plane application, not a module inside the XAPPX App. It talks to the platform only through the public APIs — the same ones an external client would use.

This is the stricter of the two options and the more useful one: if the App Factory can launch a brand through the public API alone, then the API is genuinely complete, and merging the two later stays cheap. The reverse is not true.

---

## ADR-012 — Angel Twin migrates in Phase 3, not Phase 1

**Decision.** Angel Twin's current users, vaults, and history stay on its existing stack until Phase 3. The platform starts clean.

**What this means for Phase 1.** identity-service and vault-service ship with no import path, no id-mapping table, and no reconciliation step. Nothing in the spine is shaped around legacy data. Angel Twin can launch on its current stack in the meantime without that launch creating platform work.

**What Phase 3 inherits.** A real cutover: live users with live vaults, moved without losing history. Id mapping and reconciliation get designed then, against data that actually exists rather than data we imagined.

**The part worth planning for now.** This migration is the same operation as the client extraction in §7 of the development document, run in the opposite direction. Both move configuration, identity, vault files with checksums, and full history between two isolated deployments. Build Phase 3 as the generic import side of the frozen export format, not as an Angel Twin script — otherwise the first paying client who wants to cut over pays for the same work twice, and the format stops being exercised by anything that runs regularly.

**Still to answer before Phase 3 planning starts, not before Phase 1:** whether twin training data, video credits, and referral proof come across with users and vaults. The referral records matter most — each carries a 7,500 point Angel AI credit, so losing them in a migration is a real loss to real people, and their proof of origin is external to the platform.

---

## Open decisions still blocking Phase 1

**Decided 28 July:** App Factory stays separate (ADR-011). Infrastructure owned by XAPPX Inc. (ADR-010). Retention on downgrade is six months, then free plan (ADR-009). Angel Twin migrates in Phase 3, clean slate in Phase 1 (ADR-012).

**Nothing now blocks Phase 1.** The remaining questions are scoped to later phases:

1. **Deletion scope at the end of the retention window** — everything above the free quota, or all premium content (ADR-009). Needed before Phase 4.
2. **What makes the vault decentralized.** The product is a decentralized data vault; the schema as built shows an opaque `storage_key`, a checksum and a KMS key reference, which is equally consistent with ordinary object storage. The mechanism needs naming before Phase 1 closes — content addressing, where key custody sits, what a node or replica is — because it changes the vault schema and the export format, and because the brand claim should be verifiable from the code.
3. Twin agent site branding, per-brand Vault Premium naming — cosmetic, config fields.

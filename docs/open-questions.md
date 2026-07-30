# XAPPX Platform — Open Questions & Assumptions

_Per the brief's §33. We do **not** stop development for non-blocking questions:
we use safe defaults, record the assumption, and keep the system configurable.
Blocking items need a decision before the dependent work starts._

---

## A. Blocking (need a decision before the dependent work)

### A1. Architecture endorsement — microservices on Postgres (not Supabase)
The brief says *"if Supabase is used, implement RLS."* **Supabase is not used.** The
platform is a microservices estate on raw PostgreSQL with RLS, an outbox/relay
event bus, and a gateway. This is more robust than a single Supabase app but is a
different shape than the brief may assume.
**Question:** Confirm we continue on this architecture (recommended — it already
delivers the config-not-code promise). _Assumption if silent: yes, continue._

### A2. Factory authentication & roles provider
The Factory currently has a single shared password. The brief wants roles
(platform-superadmin, factory-admin, implementation-manager, developer, QA,
support, app-admin, client-decision-maker, member) + **MFA**.
**Question:** Build roles on our own identity-service (JWT + a `roles`/permissions
model — we already have the tables), or adopt an external IdP (Auth0/Clerk) for
MFA out of the box? _Assumption if silent: extend our identity-service; add TOTP
MFA later. This is auth code and needs a human reviewer either way._

### A3. The "decentralized vault" mechanism
`vault-service` is scaffolded but the brief and ARCHITECTURE both leave the
decentralized storage model undecided (content addressing, key custody, what a
node/replica is). This **blocks Vault, Vault Premium, chat-with-documents, and
media storage**, and it is crypto-adjacent (needs review).
**Question:** Decide the vault mechanism, or approve a **centralized object-store
MVP** (S3-compatible) now with the decentralized model deferred. _Assumption if
silent: centralized MVP first, clearly labelled, migratable later._

### A4. Gateway must carry non-JSON bodies before Vault/Media
The gateway proxy currently re-serialises JSON only, so file upload/download
cannot pass through it. This must be fixed (stream raw bodies) before Vault and
Media ship. _No product decision needed — flagged so it's scheduled before Phase 4._

---

## B. Important, non-blocking (proceeding with a safe default)

### B1. Application status set
Adopting the brief's 11 statuses. _Default: additive enum; existing
draft/published preserved; new records default to `draft`._

### B2. Stripe timing & account model
Commerce is Phase 6. _Default: build XAPPX-owned products/entitlements first;
wire Stripe test mode when we reach Phase 6; one Stripe account per client,
configured per application._

### B3. AI provider for the wizard's free-text/voice discovery
The wizard's conversational step needs an LLM. _Default: make the provider
configurable (Anthropic Claude as the default, per the platform's own tooling);
the wizard works without it via structured questions if no key is set._

### B4. Logo generation for the placeholder
_Default: render a polished initials-based placeholder (brand colour + monogram)
when no logo is uploaded; no external image generation required._

### B5. Deployment durability
Free Render Postgres expires (~30 days) and services sleep. _Default for now: keep
free tier + move databases to a durable free Neon; add a keep-alive ping. Paid
always-on is a cost decision for when real users arrive._

### B6. Video "any combination" rule
Confirmed by the brief: a 4-video plan permits 4 of the same eligible type.
_Default: implement as configured, no per-type forcing._

---

## C. Future product decisions (record, revisit later)

- **Token distribution / KYC / crypto** — gated; requires compliance configuration and approvals (brief §21). Points and Token stay **separate switches**.
- **Native mobile** — the brief lists "future native mobile"; web-responsive first.
- **Export → true independence** — every module must declare export support (brief §28); design the extraction profile per module as each module is built.
- **Operations app (Level 2)** — shares the Factory frontend initially; separate permissions/domain later.
- **Custom domains per app** — `applications.primary_domain` exists; automated domain provisioning/SSL is a later infra task.

---

## Process note
Before any **destructive migration**, **auth-provider change**, **deployment-architecture
change**, or **replacing a working service**, we request explicit approval (brief §33).
Everything in Section B proceeds now under the stated defaults.

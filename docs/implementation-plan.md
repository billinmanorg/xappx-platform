# XAPPX Platform — Staged Implementation Plan

_Response to the next-phase brief (rev 072926). Mapped to the brief's own phases
(§29), marking what already exists. We **extend, not rewrite**; every stage
follows the brief's §30 checklist (what exists → what changes → files → migration
→ backend → frontend → tests → lint/build → docs → risks → manual QA)._

Legend: ✅ done · 🟡 partial · ⬜ new

---

## Phase 0 — Audit & stabilization
| Item | Status |
|---|---|
| Repository audit (`docs/current-state-audit.md`) | ✅ this deliverable |
| Current schema documented | ✅ (audit §6) |
| Authentication review | 🟡 auth exists; needs human security review + roles/MFA (Phase 1/5) |
| Fix critical bugs | 🟡 deploy wiring fixed; JSON-proxy + Factory-roles outstanding |
| Preserve Angel Token / Angel Twin / Twin Protocol records | ✅ (seed preserved; migrations additive) |
| Tests around current functionality | ✅ ~73 tests across 7 components |
| `docs/open-questions.md` | ✅ this deliverable |

## Phase 1 — Terminology & application registry  ← **start here**
| Item | Status | Notes |
|---|---|---|
| Remove obsolete terminology (Brands→Apps, zap_dev→xappx_development) | ⬜ | DB/API already use `application`; change is UI copy + routes + one product code |
| Improve app list (logos/placeholder, type, audience, member count, health, actions) | ⬜ | |
| Application statuses (11) | ⬜ | today: draft/published/suspended/archived → add Discovery, Configuring, In Development, Testing, Pending Approval, Paused, Archived, Exporting, Independent |
| Application manifest (versioned, machine-readable) | ✅ | `manifest_version` + resolver exist; formalize schema (`docs/application-manifest.md`) + version compare/rollback ⬜ |
| Preserve current configure behavior | ✅ | |
| Add `application_type`, `audience_model`, logo fields (additive migration) | ⬜ | |

## Phase 2 — Factory dashboard
| Item | Status |
|---|---|
| Impressive platform dashboard (cards: total/published/draft apps, users, modules, activity) | ⬜ |
| Honest **zero-states** (no fake numbers) | ⬜ |
| Alerts / required actions, recent activity, "Create New App" | ⬜ |
| Data source: aggregate over clients-service + events-service + identity-service | ⬜ (APIs exist to build on) |

## Phase 3 — Intelligent New-App wizard
| Item | Status |
|---|---|
| App-type + B2B/B2C/B2B2C selection | ⬜ |
| User discovery, business/workflow discovery | ⬜ |
| Branding (upload logo/brand guide → vault; extract theme for **approval**, never silent) | ⬜ |
| Template + module recommendation | ⬜ |
| Optional AI free-text/voice discovery → draft manifest | ⬜ (needs AI-provider decision) |
| Generate draft application manifest + backlog | ⬜ |

## Phase 4 — Module registry, states, configuration
| Item | Status |
|---|---|
| Formalize `products` → `module_definitions` (categories, icons, config schema, declared events/APIs, extraction) | ⬜ |
| Module **states** (12, not boolean) | ⬜ |
| Dependency engine (confirm → select missing → configure in order → validate → audit) | 🟡 enforcement exists in DB; workflow UI ⬜ |
| Per-module configuration pages (Twins, Agents, Vault, Video, Community, Points, Token, XAPPX Development) | ⬜ |
| Non-destructive disable + "Additional Features" area | 🟡 non-destructive exists; UI ⬜ |

## Phase 5 — Member & admin runtime
| Item | Status |
|---|---|
| Member runtime: theme/logo/nav from manifest | ✅ |
| Signup/login/password-reset/email-verify/Google | 🟡 signup+login ✅; reset/verify/Google ⬜ |
| Member dashboards & module pages, empty/loading/error states, responsive nav | ⬜ |
| **Configuration-driven pricing page + product catalog** | ⬜ |
| App-admin experience (manage users/modules/content/analytics, scoped to one app) | ⬜ |

## Phase 6 — Commerce & analytics
| Item | Status |
|---|---|
| Stripe commerce module (products/prices/subscriptions/trials/webhooks/reconciliation) | ⬜ (billing-service scaffolded) |
| XAPPX-owned entitlements (Stripe not the source of truth) | ⬜ |
| Activity tracking (page/nav/button/form/purchase/module events) | 🟡 event substrate + engagements ✅; the event catalogue + capture UI ⬜ |
| Analytics dashboards (funnels, usage, conversion) | ⬜ |

## Phase 7 — Points, referrals, tokens
| Item | Status |
|---|---|
| Points **ledger** (immutable, balanced, projected balance) | 🟡 rewards-service scaffolded with a ledger migration; logic ⬜ |
| Rules engine over activity events | ⬜ |
| Referral links / QR / attribution / qualification / clawback | ⬜ (referrals-service scaffolded) |
| Token support (separate switch from Points; **no private keys stored**) | ⬜ |

## Phase 8 — QA & publishing
| Item | Status |
|---|---|
| Publishing workflow (Draft→Review→QA→Client→Legal→Approved→Published→Paused→Archived) | 🟡 basic publish ✅; workflow ⬜ |
| Pre-publish validation checklist | ⬜ |
| Automated smoke tests per generated app; configurable test users | ⬜ |
| Preview URL / version history / rollback / publish notes | 🟡 preview via web-runtime ✅; rollback/history ⬜ |

## Phase 9 — Extraction & developer APIs
| Item | Status |
|---|---|
| Full application export (manifest, data, vault, ledger, config w/o secrets) | ⬜ (export-service scaffolded) |
| OpenAPI docs, developer portal, webhooks, SDKs | 🟡 webhooks in events-service ✅; the rest ⬜ |

---

## Delivery principles (from the brief)
- Extend the existing stack; no framework rewrite without a documented blocking problem.
- Safe, additive migrations; never destroy Angel Token / Angel Twin / Twin Protocol.
- Every app: public + member + admin experiences; configurable branding; own legal docs; logo/placeholder; B2B/B2C/B2B2C; separate users/memberships; tenant-scoped data; exportable.
- Modules are **configurable**, not merely switched on; dependencies enforced; disable is non-destructive; nav generated from active modules.
- Points use an auditable ledger; points and token features stay separate switches.
- Factory requires real (role-based) auth before public release.
- Config-only changes must not require a code deployment; custom work is a bounded module.

## Recommended first cut (this milestone)
Phase 1 slice that hits acceptance criteria #2–5 with low risk:
1. **Brands → Apps** across Factory + runtime UI (+ `zap_dev` → `xappx_development`).
2. **Logos / initials placeholder** + richer app cards + the expanded status set.
3. **Factory dashboard v1** with real counts and honest zero-states.
Then Phase 3's wizard, which is the brief's centrepiece.

# referrals-service

**Purpose.** Referral registration, qualification and conversion.

**The rule that matters most here.** External proof (such as an Angel AI referral email) is stored on the referral row, never inferred from timing.

## Ownership
- Owns: `referrals`
- Database: `xappx_referrals_service` — its own. No other service connects to it.
- External identifiers held as plain uuids with no foreign keys: `app_id, referrer_id, referee_id`
- Publishes: com.xappx.referral.registered, com.xappx.referral.qualified, com.xappx.referral.converted
- Consumes: com.xappx.user.created

## Non-negotiables
- **No cross-service database access.** Need another service's data? Call its API or subscribe to its events. A connection string pointing at another service's database is a defect.
- **No cross-service foreign keys.** External ids are validated at the API edge, never by the database.
- **Publish through the outbox.** Write the event to `outbox` in the same transaction as the state change. A relay drains it. Never publish to the broker inline — a broker failure must not roll back business state, and a committed change must not vanish from the stream.
- **Consume idempotently.** Delivery is at-least-once. Deduplicate on the CloudEvent `id`.
- **Scope every query by `app_id`,** including admin paths.
- **No brand names in code.** Brand differences are toggles or config.
- Errors are RFC 9457 problem documents.

## Tests required before merge
- Unit tests for this service's own logic.
- Tenant isolation: brand A cannot read brand B through any endpoint.
- Consumer idempotency: replaying the same event twice changes state once.
- Contract test against `contracts/openapi/referrals-service.v1.yaml`.

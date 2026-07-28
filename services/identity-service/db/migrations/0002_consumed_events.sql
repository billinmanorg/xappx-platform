-- identity-service · 0002 — idempotent-consumer dedup log
--
-- Delivery is at-least-once, so a consumer must deduplicate on the CloudEvent
-- id. This table is the worked example for this service: the application.created
-- handler records the event id here before touching the known_applications
-- projection, and a redelivery of the same id is a no-op. The unique primary key
-- is what makes "replaying the same event changes state once" true.
--
-- Additive migration. 0001 has already run; it is never edited.

create table consumed_events (
  event_id    uuid primary key,          -- CloudEvent id; the dedup key
  event_type  text not null,
  consumed_at timestamptz not null default now()
);

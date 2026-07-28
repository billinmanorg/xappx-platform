import type { PoolClient } from "pg";
import { withTenant } from "./db.js";

/**
 * Inbound event handling.
 *
 * Delivery is at-least-once, so this deduplicates on the CloudEvent id: an event
 * whose id is already in consumed_events is a no-op. `consume` returns true when
 * the event was applied and false when it was a duplicate.
 *
 * There is no live broker in Phase 1 (the relay is item 4). The tests drive this
 * directly, which is also how a redelivery is simulated.
 */
const APPLICATION_CREATED = "com.xappx.application.created";

export interface CloudEvent {
  id: string;
  type: string;
  data?: Record<string, unknown>;
}

export async function consume(event: CloudEvent): Promise<boolean> {
  if (!event?.id || !event?.type) return false;
  return withTenant(null, async (c) => {
    const { rows } = await c.query(
      `insert into consumed_events (event_id, event_type)
       values ($1,$2) on conflict (event_id) do nothing
       returning event_id`,
      [event.id, event.type],
    );
    if (!rows[0]) return false; // already consumed — a normal at-least-once duplicate

    if (event.type === APPLICATION_CREATED) await onApplicationCreated(c, event);
    return true;
  });
}

/**
 * Maintain the known_applications projection so a membership for an unknown
 * brand can be rejected without a synchronous call to clients-service.
 */
async function onApplicationCreated(c: PoolClient, event: CloudEvent) {
  const d = (event.data ?? {}) as { app_id?: string; client_id?: string; slug?: string };
  if (!d.app_id || !d.client_id || !d.slug) return;
  await c.query(
    `insert into known_applications (app_id, client_id, slug)
     values ($1,$2,$3)
     on conflict (app_id) do update
       set client_id = excluded.client_id, slug = excluded.slug, synced_at = now()`,
    [d.app_id, d.client_id, d.slug],
  );
}

import { withTenant } from "./db.js";

/**
 * Ingest is the "consume every topic" side of this service. The relay delivers
 * each CloudEvent here; we record it in the log of record and fan out to any
 * matching webhook.
 *
 * events_log.event_id is the CloudEvent id, so the primary key IS the dedup:
 * a redelivery of the same id inserts nothing and fans out nothing. Delivery is
 * at-least-once and duplicates are normal traffic.
 */
export interface CloudEvent {
  id: string;
  type: string;
  source?: string;
  subject?: string;
  time?: string;
  appid?: string;
  data?: Record<string, unknown>;
}

interface Hook {
  webhook_id: string;
  url: string;
}

export async function ingest(event: CloudEvent): Promise<boolean> {
  if (!event?.id || !event?.type) return false;
  const appId = event.appid ?? (event.data?.app_id as string | undefined) ?? null;
  const clientId = (event.data?.client_id as string | undefined) ?? null;

  const result = await withTenant(null, async (c) => {
    const { rows } = await c.query(
      `insert into events_log (event_id, client_id, app_id, type, source, subject, data, occurred_at)
       values ($1,$2,$3,$4,$5,$6,coalesce($7,'{}'::jsonb),coalesce($8::timestamptz, now()))
       on conflict (event_id) do nothing
       returning event_id`,
      [event.id, clientId, appId, event.type, event.source ?? "unknown",
       event.subject ?? null, JSON.stringify(event.data ?? {}), event.time ?? null],
    );
    if (!rows[0]) return { stored: false, hooks: [] as Hook[] };

    const hooks: Hook[] = appId
      ? (await c.query(
          `select webhook_id, url from webhooks
            where app_id = $1 and active
              and (cardinality(event_types) = 0 or $2 = any(event_types))`,
          [appId, event.type],
        )).rows
      : [];
    return { stored: true, hooks };
  });

  // Deliver outside the ingest transaction — a slow endpoint must not hold a lock.
  if (result.stored) {
    for (const hook of result.hooks) await deliver(hook, event);
  }
  return result.stored;
}

async function deliver(hook: Hook, event: CloudEvent): Promise<void> {
  let status = 0;
  let error: string | null = null;
  try {
    const r = await fetch(hook.url, {
      method: "POST",
      headers: { "content-type": "application/json", "X-XAPPX-Event-Type": event.type },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });
    status = r.status;
    if (!r.ok) error = `HTTP ${r.status}`;
  } catch {
    error = "delivery failed";
  }
  const ok = status >= 200 && status < 300;
  await withTenant(null, async (c) => {
    await c.query(
      `insert into webhook_deliveries
         (webhook_id, event_id, status_code, attempts, last_error, delivered_at, next_retry_at)
       values ($1,$2,$3,1,$4,$5,$6)`,
      [
        hook.webhook_id, event.id, status || null, error,
        ok ? new Date().toISOString() : null,
        ok ? null : new Date(Date.now() + 60_000).toISOString(),
      ],
    );
  });
}

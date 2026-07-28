import type { Pool } from "pg";

/**
 * Drain one pass of an outbox. Reads the unpublished rows with FOR UPDATE SKIP
 * LOCKED (so several relay instances can share the work), delivers each event to
 * its targets over HTTP, and marks a row published only when every target
 * accepted it. A row whose delivery failed is left unpublished and retried on
 * the next pass — delivery is at-least-once and consumers deduplicate on the
 * event id, so a redelivery is safe.
 */
export type Deliver = (url: string, event: unknown) => Promise<boolean>;

export interface DrainOptions {
  routes: (type: string) => string[];
  table?: string;
  batch?: number;
  deliver?: Deliver;
}

export async function httpDeliver(url: string, event: unknown): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function safeTable(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`unsafe table name: ${name}`);
  return name;
}

export async function drainOnce(
  pool: Pool,
  opts: DrainOptions,
): Promise<{ delivered: number; deferred: number }> {
  const table = safeTable(opts.table ?? "outbox");
  const batch = opts.batch ?? 50;
  const deliver = opts.deliver ?? httpDeliver;

  const c = await pool.connect();
  let delivered = 0;
  let deferred = 0;
  try {
    await c.query("begin");
    const { rows } = await c.query(
      `select outbox_id, payload from ${table}
        where published_at is null
        order by occurred_at
        limit ${batch}
        for update skip locked`,
    );
    for (const row of rows) {
      const event = row.payload as { type?: string };
      const targets = opts.routes(String(event?.type ?? ""));
      let allOk = true;
      for (const target of targets) {
        if (!(await deliver(target, event))) allOk = false;
      }
      if (allOk) {
        await c.query(`update ${table} set published_at = now() where outbox_id = $1`, [row.outbox_id]);
        delivered++;
      } else {
        deferred++; // leave unpublished; next pass retries. Consumers dedupe on event id.
      }
    }
    await c.query("commit");
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  return { delivered, deferred };
}

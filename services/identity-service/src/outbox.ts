import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const SOURCE = "https://api.xappx.com/services/identity-service";

/**
 * Writes a CloudEvent to the outbox inside the caller's transaction. A relay
 * drains it. Publishing inline would mean a broker outage rolls back business
 * state, or a committed change never reaches the stream.
 */
export async function emit(
  c: PoolClient,
  opts: {
    aggregate: string;
    type: string;
    subject?: string;
    appId?: string;
    correlationId?: string;
    data: Record<string, unknown>;
  },
) {
  const envelope = {
    specversion: "1.0",
    type: opts.type,
    source: SOURCE,
    id: randomUUID(),
    time: new Date().toISOString(),
    subject: opts.subject,
    datacontenttype: "application/json",
    correlationid: opts.correlationId,
    appid: opts.appId,
    data: opts.data,
  };
  await c.query(
    `insert into outbox (aggregate, event_type, subject, payload)
     values ($1,$2,$3,$4)`,
    [opts.aggregate, opts.type, opts.subject ?? null, envelope],
  );
  return envelope.id;
}

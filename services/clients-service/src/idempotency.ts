import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { conflict } from "./errors.js";

const hash = (b: unknown) => createHash("sha256").update(JSON.stringify(b ?? null)).digest("hex");

/**
 * Replays the stored response when a key is reused with the same body, and
 * rejects reuse with a different body. Retries are safe; accidental key reuse
 * is not silently honoured.
 */
export async function replay(
  c: PoolClient,
  key: string | undefined,
  appId: string,
  endpoint: string,
  body: unknown,
): Promise<{ status: number; body: unknown } | null> {
  if (!key) return null;
  const { rows } = await c.query(
    `select request_hash, status_code, response_body
       from idempotency_keys where app_id=$1 and key=$2 and endpoint=$3`,
    [appId, key, endpoint],
  );
  const prior = rows[0];
  if (!prior) return null;
  if (prior.request_hash !== hash(body)) {
    throw conflict(
      "This Idempotency-Key was already used with a different request body.",
      "https://api.xappx.com/problems/idempotency-key-reuse",
    );
  }
  return { status: prior.status_code, body: prior.response_body };
}

export async function remember(
  c: PoolClient,
  key: string | undefined,
  appId: string,
  endpoint: string,
  body: unknown,
  status: number,
  response: unknown,
) {
  if (!key) return;
  await c.query(
    `insert into idempotency_keys (key, app_id, endpoint, request_hash, status_code, response_body)
     values ($1,$2,$3,$4,$5,$6) on conflict do nothing`,
    [key, appId, endpoint, hash(body), status, response],
  );
}

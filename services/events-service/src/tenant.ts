import { badRequest } from "./errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The brand for a request comes from X-App-Id, which the gateway resolved and
 * forwarded so this service does not re-derive it. A body app_id is accepted as
 * a fallback for direct/testing calls. Either way it is validated here.
 */
export function requireAppId(
  getHeader: (name: string) => string | undefined,
  bodyAppId?: unknown,
): string {
  const raw = getHeader("X-App-Id") ?? (typeof bodyAppId === "string" ? bodyAppId : "");
  if (!UUID.test(raw)) throw badRequest("X-App-Id header (or app_id) is required and must be a uuid");
  return raw;
}

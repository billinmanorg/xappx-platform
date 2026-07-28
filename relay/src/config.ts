/**
 * Relay routing. Every event goes to events-service (the log of record, which
 * subscribes to every topic). Specific event types also go to the consumer that
 * needs them: application.created maintains identity-service's known_applications
 * projection, and application.product.* invalidates the gateway's toggle cache.
 *
 * Targets are plain URLs; the relay speaks only HTTP to consumers. It reads each
 * source's outbox over that source's own connection — that is the relay's entire
 * purpose (ARCHITECTURE: "a relay drains it") and why it lives outside services/.
 */
const url = (name: string, fallback: string) => (process.env[name] ?? fallback).replace(/\/$/, "");

const EVENTS_INGEST = url("EVENTS_INGEST_URL", "http://localhost:8093/internal/events");
const IDENTITY_INGEST = url("IDENTITY_INGEST_URL", "http://localhost:8082/internal/events");
const GATEWAY_INVALIDATE = url("GATEWAY_INVALIDATE_URL", "http://localhost:8080/_internal/cache/invalidate");

export function routesFor(type: string): string[] {
  const targets: string[] = [EVENTS_INGEST];
  if (type === "com.xappx.application.created") targets.push(IDENTITY_INGEST);
  if (type.startsWith("com.xappx.application.product.")) targets.push(GATEWAY_INVALIDATE);
  return targets;
}

export interface Source {
  name: string;
  databaseUrl: string;
}

/**
 * Which outboxes to drain. RELAY_SOURCES is a JSON array of {name, databaseUrl};
 * otherwise the well-known Phase-1 services are used if their DATABASE_URLs are set.
 */
export function parseSources(): Source[] {
  const raw = process.env.RELAY_SOURCES;
  if (raw) {
    try {
      return (JSON.parse(raw) as Source[]).filter((s) => s.name && s.databaseUrl);
    } catch {
      return [];
    }
  }
  return [
    { name: "clients-service", databaseUrl: process.env.CLIENTS_DATABASE_URL ?? "" },
    { name: "identity-service", databaseUrl: process.env.IDENTITY_DATABASE_URL ?? "" },
    { name: "events-service", databaseUrl: process.env.EVENTS_DATABASE_URL ?? "" },
  ].filter((s) => s.databaseUrl);
}

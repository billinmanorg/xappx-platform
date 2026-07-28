import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

/**
 * The gateway is configured, not coded. routes.yaml is the whole surface: which
 * prefix goes to which service, which routes require a product, how tenants
 * resolve, and the rate limits. This module parses it into a typed shape and
 * answers the questions the pipeline asks (which route, which service URL).
 */

export type TenantSource =
  | { kind: "host" }
  | { kind: "header"; header: string }
  | { kind: "jwt_claim"; claim: string };

export interface RouteRule {
  prefix: string;
  service: string;
  requires_product?: string;
}

export interface RateRule {
  requests: number;
  perMs: number;
}

export interface Config {
  listen: number;
  auth: { jwt: { issuer: string; audience: string }; apiKeyHeader: string };
  tenant: { from: TenantSource[]; onMissing: number; forwards: string[] };
  productGate: { source: string; cacheTtlMs: number };
  rateLimits: { default: RateRule; byRoute: (RateRule & { path: string })[] };
  routes: RouteRule[];
}

/** "60s" / "1m" / "500ms" -> milliseconds. */
export function durationMs(v: string | number): number {
  if (typeof v === "number") return v;
  const m = /^(\d+)\s*(ms|s|m|h)?$/.exec(v.trim());
  if (!m) throw new Error(`Unparseable duration: ${v}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case "ms": return n;
    case "m": return n * 60_000;
    case "h": return n * 3_600_000;
    case "s":
    default: return n * 1_000;
  }
}

function tenantSource(raw: unknown): TenantSource {
  if (raw === "host") return { kind: "host" };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.header === "string") return { kind: "header", header: o.header };
    if (typeof o.jwt_claim === "string") return { kind: "jwt_claim", claim: o.jwt_claim };
  }
  throw new Error(`Unrecognised tenant_resolution source: ${JSON.stringify(raw)}`);
}

export function loadConfig(path?: string): Config {
  const file = path ?? process.env.GATEWAY_ROUTES ?? fileURLToPath(new URL("../../routes.yaml", import.meta.url));
  const doc = parseYaml(readFileSync(file, "utf8")) as any;

  return {
    listen: Number(doc.listen ?? 8080),
    auth: {
      jwt: { issuer: doc.auth?.jwt?.issuer ?? "", audience: doc.auth?.jwt?.audience ?? "" },
      apiKeyHeader: doc.auth?.api_keys?.header ?? "X-API-Key",
    },
    tenant: {
      from: (doc.tenant_resolution?.from ?? []).map(tenantSource),
      onMissing: Number(doc.tenant_resolution?.on_missing ?? 403),
      forwards: doc.tenant_resolution?.forwards ?? [],
    },
    productGate: {
      source: doc.product_gate?.source ?? "clients-service",
      cacheTtlMs: durationMs(doc.product_gate?.cache_ttl ?? "60s"),
    },
    rateLimits: {
      default: {
        requests: Number(doc.rate_limits?.default?.requests ?? 600),
        perMs: durationMs(doc.rate_limits?.default?.per ?? "1m"),
      },
      byRoute: (doc.rate_limits?.by_route ?? []).map((r: any) => ({
        path: String(r.path),
        requests: Number(r.requests),
        perMs: durationMs(r.per),
      })),
    },
    routes: (doc.routes ?? []).map((r: any) => ({
      prefix: String(r.prefix),
      service: String(r.service),
      requires_product: r.requires_product ? String(r.requires_product) : undefined,
    })),
  };
}

/** Longest-prefix match, so /api/v1/applications wins over a hypothetical /api/v1. */
export function matchRoute(cfg: Config, path: string): RouteRule | null {
  let best: RouteRule | null = null;
  for (const r of cfg.routes) {
    if (path === r.prefix || path.startsWith(r.prefix + "/")) {
      if (!best || r.prefix.length > best.prefix.length) best = r;
    }
  }
  return best;
}

/** A route's rate limit: the most specific by_route glob, else the default. */
export function rateRuleFor(cfg: Config, path: string): RateRule {
  for (const r of cfg.rateLimits.byRoute) {
    const re = new RegExp("^" + r.path.replace(/[.]/g, "\\.").replace(/\*/g, ".*") + "$");
    if (re.test(path)) return r;
  }
  return cfg.rateLimits.default;
}

const DEFAULT_PORTS: Record<string, number> = {
  "clients-service": 8081,
  "identity-service": 8082,
};

/**
 * Where a service actually lives. Env override per service
 * (e.g. CLIENTS_SERVICE_URL); otherwise a localhost default for the two services
 * that exist. An unconfigured service resolves to null and the proxy returns 502
 * rather than guessing.
 */
export function serviceBaseUrl(service: string): string | null {
  const env = process.env[service.toUpperCase().replace(/-/g, "_") + "_URL"];
  if (env) return env.replace(/\/$/, "");
  const port = DEFAULT_PORTS[service];
  return port ? `http://localhost:${port}` : null;
}

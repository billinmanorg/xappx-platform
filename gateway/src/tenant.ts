import { serviceBaseUrl, type Config } from "./config.js";
import type { Principal } from "./auth.js";

/**
 * Resolve which brand a request is for, in the configured precedence: host,
 * then X-App-Slug, then a JWT claim. The gateway forwards the resolved app_id
 * and client_id downstream so no service re-derives them.
 *
 * The directory of brands comes from clients-service and is cached, because
 * resolving a tenant happens on every request and must not be a synchronous
 * round-trip each time. A stale entry is served if clients-service is briefly
 * unreachable rather than failing every request.
 */
export interface Tenant {
  app_id: string;
  client_id: string;
  slug: string;
  primary_domain: string | null;
}

interface AppRecord {
  app_id: string;
  client_id: string;
  slug: string;
  primary_domain: string | null;
}

export class TenantDirectory {
  private apps: AppRecord[] = [];
  private fetchedAt = 0;
  private readonly ttlMs: number;

  constructor(private cfg: Config, ttlMs?: number) {
    this.ttlMs = ttlMs ?? cfg.productGate.cacheTtlMs;
  }

  private async refresh(): Promise<void> {
    const base = serviceBaseUrl(this.cfg.productGate.source);
    if (!base) throw new Error("clients-service is not configured");
    const r = await fetch(`${base}/api/v1/applications`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) throw new Error(`applications lookup failed: ${r.status}`);
    const j = (await r.json()) as { data?: AppRecord[] };
    this.apps = j.data ?? [];
    this.fetchedAt = Date.now();
  }

  private async ensureFresh(): Promise<void> {
    if (this.fetchedAt && Date.now() - this.fetchedAt < this.ttlMs) return;
    try {
      await this.refresh();
    } catch (e) {
      if (!this.fetchedAt) throw e; // no data at all — cannot serve stale
      // else: keep serving the last good directory until clients-service returns
    }
  }

  async resolve(
    getHeader: (name: string) => string | undefined,
    host: string | undefined,
    principal: Principal,
  ): Promise<Tenant | null> {
    await this.ensureFresh();

    for (const src of this.cfg.tenant.from) {
      let found: AppRecord | undefined;
      if (src.kind === "host") {
        if (host) found = this.apps.find((a) => a.primary_domain != null && a.primary_domain === host);
      } else if (src.kind === "header") {
        const slug = getHeader(src.header);
        if (slug) found = this.apps.find((a) => a.slug === slug);
      } else if (src.kind === "jwt_claim") {
        // The spec's claim is app_id, captured on the principal.
        const claim = src.claim === "app_id" ? principal.appIdClaim : undefined;
        if (claim) found = this.apps.find((a) => a.app_id === claim);
      }
      if (found) {
        return {
          app_id: found.app_id,
          client_id: found.client_id,
          slug: found.slug,
          primary_domain: found.primary_domain,
        };
      }
    }
    return null;
  }
}

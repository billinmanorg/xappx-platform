import { serviceBaseUrl, type Config } from "./config.js";
import { serviceUnavailable } from "./errors.js";

/**
 * The edge product check. A route that requires a product is refused unless the
 * brand has that product enabled, read from the clients-service manifest and
 * cached for the configured TTL. Toggle changes publish
 * com.xappx.application.product.*, which the relay turns into an invalidate()
 * call, so a switch takes effect before the TTL would expire.
 *
 * This is a speed optimisation, not the safety boundary: the target service
 * checks the toggle again at its own edge. A false positive here is corrected
 * there; the gateway just avoids the round-trip on the common path.
 */
export class ProductGate {
  private cache = new Map<string, { at: number; enabled: Set<string> }>();

  constructor(private cfg: Config) {}

  /** Called by the relay on com.xappx.application.product.*; clears one brand or all. */
  invalidate(slug?: string): void {
    if (slug) this.cache.delete(slug);
    else this.cache.clear();
  }

  private async enabledProducts(slug: string): Promise<Set<string>> {
    const hit = this.cache.get(slug);
    if (hit && Date.now() - hit.at < this.cfg.productGate.cacheTtlMs) return hit.enabled;

    const base = serviceBaseUrl(this.cfg.productGate.source);
    if (!base) throw serviceUnavailable("clients-service is not configured");

    let r: Response;
    try {
      r = await fetch(`${base}/api/v1/applications/${encodeURIComponent(slug)}/manifest`, {
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      throw serviceUnavailable("The product manifest could not be fetched.");
    }
    if (!r.ok) throw serviceUnavailable(`Manifest lookup failed (${r.status}).`);

    const m = (await r.json()) as { products?: { code: string; enabled: boolean }[] };
    const enabled = new Set((m.products ?? []).filter((p) => p.enabled).map((p) => p.code));
    this.cache.set(slug, { at: Date.now(), enabled });
    return enabled;
  }

  async isEnabled(slug: string, product: string): Promise<boolean> {
    return (await this.enabledProducts(slug)).has(product);
  }
}
